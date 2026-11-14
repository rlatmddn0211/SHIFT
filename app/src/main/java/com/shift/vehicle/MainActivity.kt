package com.shift.vehicle

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val api = VehicleLoginApi()
    private val network = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private lateinit var loginView: VehicleLoginView
    private var challenge: VehicleLoginApi.Challenge? = null
    private var session: VehicleLoginApi.Session? = null
    private var preview: AlertDialog? = null
    private var visible = false
    private var generation = 0
    private var consecutiveFailures = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        loginView = VehicleLoginView(this, ::beginLogin)
        setContentView(loginView)
    }

    override fun onStart() {
        super.onStart()
        visible = true
        val currentSession = session
        val currentChallenge = challenge
        when {
            currentSession != null -> checkSession(currentSession, reopen = true)
            currentChallenge != null -> poll(currentChallenge)
            else -> beginLogin()
        }
    }

    override fun onStop() {
        visible = false
        generation++
        main.removeCallbacksAndMessages(null)
        preview?.dismiss()
        if (session != null) {
            setContentView(loginView)
            loginView.showLoading()
        }
        super.onStop()
    }

    override fun onDestroy() {
        preview?.dismiss()
        network.shutdownNow()
        super.onDestroy()
    }

    private fun beginLogin() {
        if (!visible) return
        generation++
        main.removeCallbacksAndMessages(null)
        challenge = null
        session = null
        consecutiveFailures = 0
        preview?.dismiss()
        if (loginView.parent == null) setContentView(loginView)
        loginView.showLoading()
        perform({
            val request = api.begin()
            request to makeQr(request.approvalUrl)
        }) { result ->
            result.onSuccess { (request, qr) ->
                challenge = request
                loginView.showRequest(qr, request.pin)
                poll(request)
            }.onFailure {
                loginView.showError("로그인 서버에 연결할 수 없습니다.")
            }
        }
    }

    private fun poll(request: VehicleLoginApi.Challenge) {
        perform({ api.approval(request) }) { result ->
            result.onSuccess { approval ->
                consecutiveFailures = 0
                when (approval) {
                    VehicleLoginApi.Approval.Pending -> schedule(POLL_INTERVAL) { poll(request) }
                    VehicleLoginApi.Approval.Expired -> endRequest("QR과 PIN의 유효 시간이 지났습니다.")
                    VehicleLoginApi.Approval.Locked -> endRequest("PIN 입력 횟수를 초과했습니다.")
                    VehicleLoginApi.Approval.Replaced -> endRequest("다른 로그인 요청이 시작되었습니다.")
                    is VehicleLoginApi.Approval.Approved -> showVisits(approval.session)
                }
            }.onFailure {
                if (++consecutiveFailures < 3) {
                    schedule(POLL_INTERVAL) { poll(request) }
                } else {
                    endRequest("휴대폰 승인 상태를 확인할 수 없습니다.")
                }
            }
        }
    }

    private fun endRequest(message: String) {
        challenge = null
        loginView.showError(message)
    }

    private fun showVisits(approved: VehicleLoginApi.Session) {
        challenge = null
        session = approved
        setContentView(TodayVisitsView(this, ::previewDestination, approved.employeeName))
        schedule(SESSION_CHECK_INTERVAL) { checkSession(approved) }
    }

    private fun checkSession(approved: VehicleLoginApi.Session, reopen: Boolean = false) {
        perform({ api.isActive(approved) }) { result ->
            result.onSuccess { active ->
                consecutiveFailures = 0
                when {
                    !active -> beginLogin()
                    reopen -> showVisits(approved)
                    else -> schedule(SESSION_CHECK_INTERVAL) { checkSession(approved) }
                }
            }.onFailure {
                if (++consecutiveFailures < 3) {
                    schedule(SESSION_CHECK_INTERVAL) { checkSession(approved, reopen) }
                } else {
                    beginLogin()
                }
            }
        }
    }

    private fun <T> perform(operation: () -> T, done: (Result<T>) -> Unit) {
        val current = generation
        network.execute {
            val result = try {
                Result.success(operation())
            } catch (error: Exception) {
                Result.failure(error)
            }
            main.post { if (visible && current == generation) done(result) }
        }
    }

    private fun schedule(delay: Long, operation: () -> Unit) {
        main.postDelayed({ if (visible) operation() }, delay)
    }

    private fun makeQr(url: String): Bitmap {
        val size = 720
        val matrix = QRCodeWriter().encode(url, BarcodeFormat.QR_CODE, size, size)
        val pixels = IntArray(size * size) { index ->
            if (matrix[index % size, index / size]) Color.BLACK else Color.WHITE
        }
        return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
    }

    private fun previewDestination(address: String) {
        preview = AlertDialog.Builder(this)
            .setTitle(R.string.destination_preview_title)
            .setMessage(getString(R.string.destination_preview_message, address))
            .setPositiveButton(android.R.string.ok, null)
            .setOnDismissListener { preview = null }
            .show()
    }

    private companion object {
        const val POLL_INTERVAL = 1_000L
        const val SESSION_CHECK_INTERVAL = 5_000L
    }
}
