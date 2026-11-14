package com.shift.vehicle

import ai.pleos.playground.vehicle.Vehicle
import ai.pleos.playground.vehicle.api.Seat
import ai.pleos.playground.vehicle.api.model.area.SeatArea
import ai.pleos.playground.vehicle.api.model.capability.AccessType
import ai.pleos.playground.vehicle.constant.area.SeatValue
import ai.pleos.playground.vehicle.constant.control.MoveControl
import android.content.Context
import android.os.Handler
import kotlin.math.abs

internal data class PleosSeatAxis(val position: Int, val minimum: Int, val maximum: Int)
internal data class PleosSeatState(val height: PleosSeatAxis?, val foreAft: PleosSeatAxis?)

internal class PleosVehicle(
    private val context: Context,
    private val main: Handler,
    private val parked: () -> Boolean,
    private val confirmParked: ((Boolean) -> Unit) -> Unit,
) {
    private enum class Axis { HEIGHT, FORE_AFT }

    private val driver = SeatArea(SeatValue.ROW_1_LEFT)
    private var vehicle: Vehicle? = null
    private var seatRequest: SeatRequest? = null

    fun start() {
        if (vehicle != null) return
        vehicle = runCatching {
            Vehicle(context).also { it.initialize() }
        }.getOrNull()
    }

    fun stop() {
        val sdk = vehicle ?: return
        val commandToStop = seatRequest?.takingMotion() == true
        cancelSeat()
        vehicle = null
        if (commandToStop) {
            // STOP is asynchronous; keep the binding briefly after dispatch.
            main.postDelayed({ runCatching { sdk.release() } }, 500)
        } else {
            runCatching { sdk.release() }
        }
    }

    fun readSeat(callback: (Result<PleosSeatState>) -> Unit) {
        val sdk = vehicle
        if (sdk == null || !parked()) {
            callback(Result.failure(IllegalStateException("주차가 확인된 뒤 좌석 상태를 볼 수 있어요.")))
            return
        }
        val seat = sdk.getSeat()
        var completed = false
        val timeout = Runnable {
            if (!completed && vehicle === sdk) {
                completed = true
                callback(Result.failure(IllegalStateException("좌석 응답을 받지 못했어요.")))
            }
        }
        main.postDelayed(timeout, 5_000)
        readAxis(seat, Axis.HEIGHT) { height ->
            if (completed || vehicle !== sdk) return@readAxis
            readAxis(seat, Axis.FORE_AFT) foreAft@{ foreAft ->
                if (completed || vehicle !== sdk) return@foreAft
                completed = true
                main.removeCallbacks(timeout)
                when {
                    !parked() -> callback(
                        Result.failure(IllegalStateException("주차 상태를 다시 확인해 주세요.")),
                    )
                    height == null && foreAft == null -> callback(
                        Result.failure(IllegalStateException("차량에서 지원하는 운전석 범위를 확인하지 못했어요.")),
                    )
                    else -> callback(Result.success(PleosSeatState(height, foreAft)))
                }
            }
        }
    }

    fun applySeat(height: Int, foreAft: Int, callback: (PleosActionResult) -> Unit) {
        val sdk = vehicle
        when {
            sdk == null || !parked() ->
                callback(PleosActionResult(false, "주차가 확인된 뒤 좌석을 조절할 수 있어요."))
            seatRequest != null ->
                callback(PleosActionResult(false, "좌석 설정을 적용하고 있어요."))
            else -> {
                val request = SeatRequest(sdk, height, foreAft, callback)
                seatRequest = request
                request.start()
            }
        }
    }

    fun cancelSeat() {
        val request = seatRequest ?: return
        seatRequest = null
        request.close()
    }

    private fun readAxis(seat: Seat, axis: Axis, callback: (PleosSeatAxis?) -> Unit) {
        val onBounds = { access: AccessType, min: Int?, max: Int? ->
            if ((access == AccessType.READ || access == AccessType.READ_WRITE) &&
                min != null && max != null && min < max
            ) {
                position(seat, axis) { pos ->
                    callback(if (pos != null && pos in min..max) PleosSeatAxis(pos, min, max) else null)
                }
            } else {
                callback(null)
            }
        }
        runCatching {
            when (axis) {
                Axis.HEIGHT -> seat.checkSeatHeightPositionCapabilities(
                    { config, bounds -> main.post { onBounds(config.accessType, bounds[driver]?.minValue, bounds[driver]?.maxValue) } },
                    { main.post { callback(null) } },
                )
                Axis.FORE_AFT -> seat.checkSeatForeAftPositionCapabilities(
                    { config, bounds -> main.post { onBounds(config.accessType, bounds[driver]?.minValue, bounds[driver]?.maxValue) } },
                    { main.post { callback(null) } },
                )
            }
        }.onFailure { main.post { callback(null) } }
    }

    private fun position(seat: Seat, axis: Axis, callback: (Int?) -> Unit) {
        val read: (Int?) -> Unit = { main.post { callback(it) } }
        val fail: (Exception) -> Unit = { main.post { callback(null) } }
        runCatching {
            when (axis) {
                Axis.HEIGHT -> seat.getCurrentSeatHeightPosition(driver, read, fail)
                Axis.FORE_AFT -> seat.getCurrentSeatForeAftPosition(driver, read, fail)
            }
        }.onFailure { main.post { callback(null) } }
    }

    private fun canMove(seat: Seat, axis: Axis, callback: (Boolean) -> Unit) {
        val read: (Boolean) -> Unit = { main.post { callback(it) } }
        val fail: (Exception) -> Unit = { read(false) }
        runCatching {
            when (axis) {
                Axis.HEIGHT -> seat.checkMoveSeatHeightCapabilities(
                    { config, areas -> read(config.accessType.permitsWrite() && driver in areas) }, fail,
                )
                Axis.FORE_AFT -> seat.checkMoveSeatForeAftCapabilities(
                    { config, areas -> read(config.accessType.permitsWrite() && driver in areas) }, fail,
                )
            }
        }.onFailure { read(false) }
    }

    private fun AccessType.permitsWrite() = this == AccessType.WRITE || this == AccessType.READ_WRITE

    private fun command(seat: Seat, axis: Axis, direction: MoveControl, callback: (Boolean) -> Unit) {
        val complete: (SeatArea, MoveControl?) -> Unit = { area, move ->
            main.post { callback(area == driver && move == direction) }
        }
        val fail: (Exception) -> Unit = { main.post { callback(false) } }
        runCatching {
            when (axis) {
                Axis.HEIGHT -> seat.moveSeatHeight(driver, direction, complete, fail)
                Axis.FORE_AFT -> seat.moveSeatForeAft(driver, direction, complete, fail)
            }
        }.onFailure { main.post { callback(false) } }
    }

    private inner class SeatRequest(
        private val sdk: Vehicle,
        private val height: Int,
        private val foreAft: Int,
        private val callback: (PleosActionResult) -> Unit,
    ) {
        private val seat = sdk.getSeat()
        private var activeAxis: Axis? = null
        private var pulse = 0
        private var stopPulse: Runnable? = null
        private val timeout = Runnable { finish(false, "좌석 목표 위치에 도달했는지 확인하지 못했어요.") }

        fun start() {
            main.postDelayed(timeout, 12_000)
            readAxis(seat, Axis.HEIGHT) heightBounds@{ heightBounds ->
                if (!canContinue()) return@heightBounds
                readAxis(seat, Axis.FORE_AFT) foreAftBounds@{ foreAftBounds ->
                    if (!canContinue()) return@foreAftBounds
                    if (heightBounds == null && foreAftBounds == null ||
                        heightBounds != null && height !in heightBounds.minimum..heightBounds.maximum ||
                        foreAftBounds != null && foreAft !in foreAftBounds.minimum..foreAftBounds.maximum
                    ) {
                        finish(false, "현재 차량의 운전석 지원 범위를 확인해 주세요.")
                        return@foreAftBounds
                    }
                    prepare(Axis.HEIGHT, height, heightBounds) {
                        prepare(Axis.FORE_AFT, foreAft, foreAftBounds) {
                            val full = heightBounds != null && foreAftBounds != null
                            finish(
                                full,
                                if (full) "운전석 높이와 앞뒤 위치를 확인했어요."
                                else "지원되는 좌석 위치 한 가지만 확인했어요.",
                            )
                        }
                    }
                }
            }
        }

        private fun prepare(axis: Axis, target: Int, bounds: PleosSeatAxis?, next: () -> Unit) {
            if (!canContinue()) return
            if (bounds == null) {
                next()
                return
            }
            canMove(seat, axis) { supported ->
                if (canContinue()) {
                    if (supported) moveToward(axis, target, bounds, previous = null, next)
                    else finish(false, "차량에서 이 좌석 방향의 조절을 지원하지 않아요.")
                }
            }
        }

        private fun moveToward(
            axis: Axis,
            target: Int,
            bounds: PleosSeatAxis,
            previous: Int?,
            next: () -> Unit,
        ) {
            position(seat, axis) { current ->
                if (!canContinue()) return@position
                when {
                    current == null || current !in bounds.minimum..bounds.maximum ->
                        finish(false, "현재 좌석 위치를 확인할 수 없어요.")
                    abs(current.toLong() - target) <= 1L -> next()
                    previous != null && abs(current.toLong() - target) >= abs(previous.toLong() - target) ->
                        finish(false, "좌석이 목표 방향으로 움직이지 않아 조절을 중단했어요.")
                    else -> {
                        confirmParked gearCheck@{ confirmed ->
                            if (seatRequest !== this) return@gearCheck
                            if (!confirmed || vehicle !== sdk || !canContinue()) {
                                finish(false, "주차 상태를 다시 확인해 주세요.")
                                return@gearCheck
                            }
                            val direction = if (current < target) MoveControl.FORWARD else MoveControl.BACKWARD
                            movePulse(axis, direction) { moveToward(axis, target, bounds, current, next) }
                        }
                    }
                }
            }
        }

        private fun movePulse(axis: Axis, direction: MoveControl, next: () -> Unit) {
            val currentPulse = ++pulse
            activeAxis = axis
            // Arm STOP before movement so a missing acknowledgement still ends the pulse.
            val stop = Runnable {
                command(seat, axis, MoveControl.STOP) { stopped ->
                    if (seatRequest === this && pulse == currentPulse) {
                        if (!stopped) {
                            finish(false, "좌석 움직임 정지를 확인하지 못했어요.")
                        } else {
                            activeAxis = null
                            next()
                        }
                    }
                }
            }
            stopPulse = stop
            main.postDelayed(stop, 250)
            command(seat, axis, direction) { moved ->
                if (!moved && seatRequest === this && pulse == currentPulse) {
                    finish(false, "좌석 이동을 요청하지 못했어요.")
                }
            }
        }

        private fun canContinue(): Boolean = seatRequest === this && parked()

        private fun finish(success: Boolean, message: String) {
            if (seatRequest !== this) return
            cancelSeat()
            callback(PleosActionResult(success, message))
        }

        fun takingMotion(): Boolean = activeAxis != null

        fun close() {
            main.removeCallbacks(timeout)
            stopPulse?.let(main::removeCallbacks)
            activeAxis?.let { command(seat, it, MoveControl.STOP) {} }
            activeAxis = null
        }
    }
}
