package com.shift.vehicle

import android.car.Car
import android.car.VehicleGear
import android.car.VehiclePropertyIds
import android.car.drivingstate.CarUxRestrictions
import android.car.drivingstate.CarUxRestrictionsManager
import android.car.hardware.CarPropertyValue
import android.car.hardware.property.CarPropertyManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executors

internal data class PleosDestination(
    val title: String,
    val address: String,
    val latitude: Double,
    val longitude: Double,
    val poiId: String = "",
    val poiSubId: String = "0",
)

internal data class PleosActionResult(val success: Boolean, val message: String)

internal class PleosPlatform(
    context: Context,
    private val onParkedChanged: (Boolean) -> Unit,
) {
    private val app = context.applicationContext
    private val carContext = context
    private val main = Handler(Looper.getMainLooper())
    private val navigation = PleosNavigation(app, main)
    private val speech = PleosSpeech(app, main)
    private val vehicle = PleosVehicle(app, main, { parked }, ::confirmParked)
    private val gearReader = Executors.newSingleThreadExecutor()
    private var car: Car? = null
    private var restrictions: CarUxRestrictionsManager? = null
    private var properties: CarPropertyManager? = null
    private var gearEvents: CarPropertyManager.CarPropertyEventCallback? = null
    private var epoch = 0
    private var active = false
    private var unrestricted = false
    private var inPark = false
    private var gearRevision = 0

    var parked: Boolean = false
        private set

    fun start() {
        if (active) return
        active = true
        val currentEpoch = ++epoch
        try {
            car = Car.createCar(carContext, main, Car.CAR_WAIT_TIMEOUT_DO_NOT_WAIT) { connected, ready ->
                if (!active || epoch != currentEpoch) return@createCar
                if (!ready) {
                    restrictions = null
                    properties = null
                    gearEvents = null
                    inPark = false
                    gearRevision++
                    updateRestrictions(null)
                    return@createCar
                }
                restrictions = runCatching {
                    connected.getCarManager(Car.CAR_UX_RESTRICTION_SERVICE) as? CarUxRestrictionsManager
                }.getOrNull()
                val manager = restrictions
                runCatching {
                    manager?.registerListener { value ->
                        if (active && epoch == currentEpoch && restrictions === manager) {
                            updateRestrictions(value)
                        }
                    }
                }
                updateRestrictions(runCatching { manager?.currentCarUxRestrictions }.getOrNull())
                monitorGear(connected, currentEpoch)
            }
        } catch (_: LinkageError) {
            updateRestrictions(null)
        } catch (_: RuntimeException) {
            updateRestrictions(null)
        }
        vehicle.start()
    }

    fun stop() {
        if (!active) return
        active = false
        epoch++
        stopSpeech()
        vehicle.stop()
        navigation.stop()
        runCatching { restrictions?.unregisterListener() }
        gearEvents?.let { listener -> runCatching { properties?.unregisterCallback(listener) } }
        runCatching { car?.disconnect() }
        restrictions = null
        properties = null
        gearEvents = null
        car = null
        inPark = false
        gearRevision++
        updateRestrictions(null)
    }

    fun close() {
        stop()
        gearReader.shutdown()
    }

    fun navigate(destination: PleosDestination, callback: (PleosActionResult) -> Unit) {
        if (parked) navigation.navigate(destination, callback)
        else callback(PleosActionResult(false, "주차가 확인된 뒤 목적지를 전송할 수 있어요."))
    }

    fun readSeat(callback: (Result<PleosSeatState>) -> Unit) =
        vehicle.readSeat(callback)

    fun applySeat(height: Int, foreAft: Int, callback: (PleosActionResult) -> Unit) =
        vehicle.applySeat(height, foreAft, callback)

    fun cancelSeat() = vehicle.cancelSeat()

    fun speak(text: String, callback: (PleosActionResult) -> Unit) {
        if (parked) speech.speak(text, callback)
        else callback(PleosActionResult(false, "주차가 확인된 뒤 브리핑을 들을 수 있어요."))
    }

    fun listen(callback: (Result<String>) -> Unit) {
        if (parked) speech.listen(callback)
        else callback(Result.failure(IllegalStateException("주차가 확인된 뒤 녹음할 수 있어요.")))
    }

    fun stopSpeech() = speech.stop()

    private fun monitorGear(connected: Car, currentEpoch: Int) {
        val propertyManager = runCatching {
            connected.getCarManager(Car.PROPERTY_SERVICE) as? CarPropertyManager
        }.getOrNull() ?: return
        val listener = object : CarPropertyManager.CarPropertyEventCallback {
            override fun onChangeEvent(value: CarPropertyValue<*>) {
                if (active && epoch == currentEpoch && properties === propertyManager) {
                    gearRevision++
                    inPark = value.isPark()
                    updateParked()
                }
            }

            override fun onErrorEvent(propertyId: Int, areaId: Int) {
                if (active && epoch == currentEpoch && properties === propertyManager) {
                    gearRevision++
                    inPark = false
                    updateParked()
                }
            }
        }
        properties = propertyManager
        gearEvents = listener
        val registered = runCatching {
            propertyManager.registerCallback(
                listener,
                VehiclePropertyIds.GEAR_SELECTION,
                CarPropertyManager.SENSOR_RATE_ONCHANGE,
            )
        }.getOrDefault(false)
        if (registered) {
            confirmParked {}
        } else {
            properties = null
            gearEvents = null
        }
    }

    private fun confirmParked(callback: (Boolean) -> Unit) {
        val manager = properties
        if (manager == null || !active) {
            callback(false)
            return
        }
        val revision = gearRevision
        val requestEpoch = epoch
        gearReader.execute {
            val current = runCatching {
                manager.getProperty<Int>(VehiclePropertyIds.GEAR_SELECTION, 0)
            }.getOrNull()
            val isPark = current?.isPark() == true
            main.post {
                if (!active || epoch != requestEpoch || properties !== manager) {
                    callback(false)
                    return@post
                }
                // A subscription event received during the read takes precedence over that read.
                if (gearRevision == revision) {
                    inPark = isPark
                    updateParked()
                }
                callback(parked && isPark)
            }
        }
    }

    // API 34 property errors are reported by CarPropertyValue#getStatus().
    @Suppress("DEPRECATION")
    private fun CarPropertyValue<*>.isPark() =
        status == CarPropertyValue.STATUS_AVAILABLE && value == VehicleGear.GEAR_PARK

    private fun updateRestrictions(value: CarUxRestrictions?) {
        unrestricted = value != null &&
            !value.isRequiresDistractionOptimization &&
            value.activeRestrictions == CarUxRestrictions.UX_RESTRICTIONS_BASELINE
        updateParked()
    }

    private fun updateParked() {
        val next = active && unrestricted && inPark
        if (parked == next) return
        parked = next
        if (!parked) {
            cancelSeat()
            stopSpeech()
            navigation.stop()
        }
        onParkedChanged(parked)
    }
}
