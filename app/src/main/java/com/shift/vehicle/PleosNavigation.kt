package com.shift.vehicle

import ai.pleos.playground.navi.constants.NaviErrorCode
import ai.pleos.playground.navi.data.DestinationInfo
import ai.pleos.playground.navi.data.RouteInfo
import ai.pleos.playground.navi.data.RouteStartInfo
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import android.content.Context
import android.os.Handler

internal class PleosNavigation(
    private val context: Context,
    private val main: Handler,
) {
    private var pending: RouteRequest? = null

    fun navigate(destination: PleosDestination, callback: (PleosActionResult) -> Unit) =
        open(destination, checkOnly = false, callback)

    fun confirmDestination(destination: PleosDestination, callback: (PleosActionResult) -> Unit) =
        open(destination, checkOnly = true, callback)

    private fun open(
        destination: PleosDestination,
        checkOnly: Boolean,
        callback: (PleosActionResult) -> Unit,
    ) {
        if (pending != null) {
            callback(PleosActionResult(false, "이전 내비게이션 요청을 확인하고 있어요."))
            return
        }
        if (destination.title.isBlank() || destination.address.isBlank() ||
            destination.poiId.isBlank() || destination.poiSubId.isBlank() ||
            destination.latitude !in -90.0..90.0 || destination.longitude !in -180.0..180.0
        ) {
            callback(PleosActionResult(false, "Pleos에서 확인된 목적지 좌표와 장소 ID가 필요해요."))
            return
        }
        try {
            val request = RouteRequest(destination, checkOnly, callback)
            pending = request
            request.start()
        } catch (_: RuntimeException) {
            stop()
            callback(PleosActionResult(false, "Pleos 내비게이션에 연결하지 못했어요."))
        }
    }

    fun stop() {
        val request = pending ?: return
        pending = null
        request.close()
    }

    private inner class RouteRequest(
        private val destination: PleosDestination,
        private val checkOnly: Boolean,
        private val callback: (PleosActionResult) -> Unit,
    ) {
        private val helper = NaviHelper(context)
        private var routeSent = false
        private var verifying = false
        private val timeout = Runnable { finish(false, "Pleos에서 요청한 목적지를 확인하지 못했어요.") }
        private val listener = object : NaviHelperEventListener {
            override fun onRoutingCompleted() {
                main.post {
                    if (pending !== this@RouteRequest || !routeSent) return@post
                    verify()
                }
            }

            override fun onRouteStarted(routeStartInfo: RouteStartInfo) {
                main.post {
                    if (pending === this@RouteRequest && routeSent && !verifying) verify()
                }
            }

            override fun onDestinationInfo(destinationInfo: DestinationInfo) {
                main.post {
                    if (pending !== this@RouteRequest || !verifying) return@post
                    // The provider omits the sub-ID in replies for the route's default entry.
                    val subId = destinationInfo.poiSubId.orEmpty().ifBlank { "0" }
                    if (destinationInfo.poiId == destination.poiId && subId == destination.poiSubId) {
                        finish(true, "Pleos 내비게이션에서 요청한 목적지를 확인했어요.")
                    } else if (checkOnly) {
                        finish(false, "Pleos에서 현재 안내 중인 목적지가 요청과 일치하지 않아요.")
                    }
                }
            }

            override fun onError(errorCode: NaviErrorCode) {
                main.post { finish(false, "Pleos 내비게이션 요청에 실패했어요. (${errorCode.name})") }
            }
        }

        fun start() {
            main.postDelayed(timeout, if (checkOnly) 6_000 else 20_000)
            helper.initialize(
                {
                    main.post { send() }
                },
                {
                    main.post { finish(false, "Pleos 내비게이션 서비스에 연결하지 못했어요.") }
                },
            )
        }

        private fun send() {
            if (pending !== this || routeSent || verifying) return
            runCatching {
                helper.addListener(listener)
                if (checkOnly) {
                    verify()
                    return
                }
                routeSent = true
                helper.requestRoute(
                    RouteInfo(
                        latitude = destination.latitude,
                        longitude = destination.longitude,
                        poiName = destination.title,
                        poiId = destination.poiId,
                        poiSubId = destination.poiSubId,
                        address = destination.address,
                    ),
                )
            }.onFailure { finish(false, "Pleos에 경로를 요청하지 못했어요.") }
        }

        private fun verify() {
            verifying = true
            runCatching { helper.getDestinationInfo() }.onFailure {
                finish(false, "Pleos에서 설정한 목적지를 확인하지 못했어요.")
            }
        }

        private fun finish(success: Boolean, message: String) {
            if (pending !== this) return
            stop()
            callback(PleosActionResult(success, message))
        }

        fun close() {
            main.removeCallbacks(timeout)
            runCatching { helper.removeListener(listener) }
            runCatching { helper.release() }
        }
    }
}
