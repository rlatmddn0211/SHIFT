package com.shift.vehicle

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val api = VehicleLoginApi()
    private val workspaceApi = WorkspaceApi()
    private val network = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val platform by lazy { PleosPlatform(this, ::onParkedChanged) }
    private lateinit var loginView: VehicleLoginView
    private var mode = VehicleLoginView.Purpose.LOGIN
    private var challenge: VehicleLoginApi.Challenge? = null
    private var logoutChallenge: VehicleLoginApi.LogoutChallenge? = null
    private var session: VehicleLoginApi.Session? = null
    private var workspace: Workspace? = null
    private var workController: VehicleWorkController? = null
    private var pendingNavigation: PleosDestination? = null
    private var cancelPending = false
    private var visible = false
    @Volatile private var generation = 0
    private var consecutiveFailures = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        loginView = VehicleLoginView(this, ::retryCurrentMode, ::cancelSessionFlow)
        setContentView(loginView)
    }

    override fun onStart() {
        super.onStart()
        visible = true
        val currentSession = session
        val currentChallenge = challenge
        when {
            currentSession != null && canCancelFlow() -> cancelSessionFlow()
            currentSession != null -> checkSession(currentSession, reopen = true)
            !platform.parked -> showStatusLoading("주차가 확인되면 로그인 QR을 표시합니다.")
            currentChallenge != null -> pollLogin(currentChallenge)
            else -> beginLogin()
        }
        platform.start()
    }

    override fun onStop() {
        visible = false
        invalidatePendingCallbacks()
        cancelHiddenSessionFlow()
        clearWorkspace()
        platform.stop()
        showStatusLoading("차량 세션을 확인하고 있습니다.")
        super.onStop()
    }

    override fun onDestroy() {
        clearWorkspace()
        platform.close()
        network.shutdown()
        super.onDestroy()
    }

    private fun beginLogin(handover: Boolean = false) {
        if (!visible) return
        if (!platform.parked) {
            if (handover) return
            invalidatePendingCallbacks()
            clearWorkspace()
            pendingNavigation = null
            challenge = null
            logoutChallenge = null
            session = null
            mode = VehicleLoginView.Purpose.LOGIN
            showStatusLoading("주차가 확인되면 로그인 QR을 표시합니다.")
            return
        }
        if (handover && (session == null || !platform.parked)) return
        invalidatePendingCallbacks()
        clearWorkspace()
        pendingNavigation = null
        mode = if (handover) VehicleLoginView.Purpose.HANDOVER else VehicleLoginView.Purpose.LOGIN
        cancelPending = false
        challenge = null
        logoutChallenge = null
        if (!handover) session = null
        showStatusLoading("로그인 요청을 준비하고 있습니다.")
        perform(operation = {
            val request = api.begin()
            request to makeQr(request.approvalUrl)
        }, discard = { (request, _) -> api.cancel(request) }) { result ->
            result.onSuccess { (request, qr) ->
                challenge = request
                loginView.showRequest(qr, request.pin, mode)
                pollLogin(request)
            }.onFailure {
                statusError("로그인 서버에 연결할 수 없습니다.")
            }
        }
    }

    private fun pollLogin(request: VehicleLoginApi.Challenge) {
        perform(operation = { api.approval(request) }) { result ->
            result.onSuccess { approval ->
                consecutiveFailures = 0
                when (approval) {
                    VehicleLoginApi.Approval.Pending -> schedule(POLL_INTERVAL) { pollLogin(request) }
                    VehicleLoginApi.Approval.Expired -> loginError("QR과 PIN의 유효 시간이 지났습니다.")
                    VehicleLoginApi.Approval.Locked -> loginError("PIN 입력 횟수를 초과했습니다.")
                    VehicleLoginApi.Approval.Replaced -> loginError("다른 로그인 요청이 시작되었습니다.")
                    is VehicleLoginApi.Approval.Approved -> openWorkspace(approval.session)
                }
            }.onFailure {
                retryPolling("휴대폰 승인 상태를 확인할 수 없습니다.") { pollLogin(request) }
            }
        }
    }

    private fun loginError(message: String) {
        challenge = null
        statusError(message)
    }

    private fun openWorkspace(approved: VehicleLoginApi.Session) {
        invalidatePendingCallbacks()
        clearWorkspace()
        if (session !== approved) pendingNavigation = null
        mode = VehicleLoginView.Purpose.WORKSPACE
        cancelPending = false
        challenge = null
        logoutChallenge = null
        session = approved
        showStatusLoading("오늘 방문 업무를 불러오고 있습니다.")
        loadWorkspace(approved)
    }

    private fun loadWorkspace(approved: VehicleLoginApi.Session, refresh: Boolean = false) {
        perform(operation = { workspaceApi.load(approved.token) }) { result ->
            result.onSuccess { loaded ->
                workspace = loaded
                if (workController == null) {
                    workController = VehicleWorkController(
                        this, platform, approved, workspaceApi,
                        canWork = { visible && platform.parked && session === approved && mode == VehicleLoginView.Purpose.WORKSPACE },
                        notifyChanged = { if (visible && session === approved) loadWorkspace(approved, refresh = true) },
                        onSessionEnded = { if (visible && session === approved) beginLogin() },
                        onNavigationPending = { if (session === approved) pendingNavigation = it },
                    )
                }
                renderWorkspace()
                if (!refresh) schedule(SESSION_CHECK_INTERVAL) { checkSession(approved) }
            }.onFailure { error ->
                if (error is WorkspaceSessionEnded) {
                    beginLogin()
                } else {
                    workspace = null
                    workController?.clear()
                    statusError("오늘 방문 업무를 불러오지 못했습니다.")
                }
            }
        }
    }

    private fun renderWorkspace() {
        val current = workspace ?: return
        val approved = session ?: return
        val availability = if (platform.parked) VehicleAvailability.PARKED else VehicleAvailability.RESTRICTED
        setContentView(VehicleWorkScreen(this, current, approved.employeeName, availability, ::handleWork))
        if (platform.parked) pendingNavigation?.let { destination ->
            pendingNavigation = null
            workController?.resumeNavigation(destination)
        }
    }

    private fun checkSession(approved: VehicleLoginApi.Session, reopen: Boolean = false) {
        perform(operation = { api.isActive(approved) }) { result ->
            result.onSuccess { active ->
                consecutiveFailures = 0
                when {
                    !active -> beginLogin()
                    reopen -> openWorkspace(approved)
                    else -> schedule(SESSION_CHECK_INTERVAL) { checkSession(approved) }
                }
            }.onFailure {
                if (!reopen) {
                    clearWorkspace()
                    showStatusLoading("차량 세션을 다시 확인하고 있습니다.")
                }
                if (++consecutiveFailures < 3) schedule(POLL_INTERVAL) { checkSession(approved, reopen = true) }
                else statusError("차량 세션을 확인할 수 없습니다.")
            }
        }
    }

    private fun handleWork(action: VehicleWorkAction) {
        val current = workspace ?: return
        if (!visible || !platform.parked) return
        when (action) {
            VehicleWorkAction.Logout -> workController?.confirmLogout(::beginLogout)
            VehicleWorkAction.ChangeDriver -> beginLogin(handover = true)
            VehicleWorkAction.Refresh -> session?.let { openWorkspace(it) }
            else -> workController?.show(action, current)
        }
    }

    private fun beginLogout() {
        val approved = session ?: return
        if (!visible || !platform.parked) return
        invalidatePendingCallbacks()
        clearWorkspace()
        pendingNavigation = null
        mode = VehicleLoginView.Purpose.LOGOUT
        cancelPending = false
        logoutChallenge = null
        showStatusLoading("로그아웃 요청을 준비하고 있습니다.")
        perform(operation = {
            val request = api.beginLogout(approved)
            request to makeQr(request.approvalUrl)
        }, discard = { (request, _) ->
            api.cancelLogout(approved, request)
        }) { result ->
            result.onSuccess { (request, qr) ->
                logoutChallenge = request
                loginView.showRequest(qr, null, mode)
                pollLogout(approved, request)
            }.onFailure { error ->
                if (error is VehicleLoginApi.InactiveSessionException) beginLogin()
                else statusError("로그아웃 QR을 열 수 없습니다.")
            }
        }
    }

    private fun pollLogout(approved: VehicleLoginApi.Session, request: VehicleLoginApi.LogoutChallenge) {
        perform(operation = { api.logoutStatus(approved, request) }) { result ->
            result.onSuccess { status ->
                consecutiveFailures = 0
                when (status) {
                    VehicleLoginApi.LogoutStatus.PENDING -> schedule(POLL_INTERVAL) { pollLogout(approved, request) }
                    VehicleLoginApi.LogoutStatus.APPROVED -> {
                        beginLogin()
                        Toast.makeText(this, "차량 로그아웃을 완료했습니다.", Toast.LENGTH_SHORT).show()
                    }
                    VehicleLoginApi.LogoutStatus.EXPIRED -> {
                        logoutChallenge = null
                        statusError("로그아웃 QR의 유효 시간이 지났습니다.")
                    }
                    VehicleLoginApi.LogoutStatus.REPLACED -> checkSession(approved, reopen = true)
                }
            }.onFailure {
                retryPolling("로그아웃 승인 상태를 확인할 수 없습니다.") { pollLogout(approved, request) }
            }
        }
    }

    private fun cancelSessionFlow() {
        val approved = session ?: return
        val login = challenge
        val logout = logoutChallenge
        cancelPending = true
        invalidatePendingCallbacks()
        showStatusLoading("차량 세션을 확인하고 있습니다.")
        perform(operation = {
            if (logout != null) api.cancelLogout(approved, logout)
            login?.let { api.cancel(it) }
        }) { result ->
            result.onSuccess { canceled ->
                cancelPending = false
                challenge = null
                logoutChallenge = null
                val next = (canceled as? VehicleLoginApi.Approval.Approved)?.session ?: approved
                session = next
                mode = VehicleLoginView.Purpose.WORKSPACE
                checkSession(next, reopen = true)
            }.onFailure {
                // The cancel may not have reached the server. Keep the QR hidden and offer a retry.
                statusError("요청 취소를 확인할 수 없습니다.", allowCancel = true)
            }
        }
    }

    private fun cancelHiddenSessionFlow() {
        val approved = session
        val login = challenge
        val logout = logoutChallenge
        if (login == null && logout == null) return
        if (approved == null) challenge = null
        network.execute {
            runCatching { login?.let { api.cancel(it) } }
            if (approved != null && logout != null) runCatching { api.cancelLogout(approved, logout) }
        }
    }

    private fun onParkedChanged(parked: Boolean) {
        if (!visible) return
        if (!parked) {
            pendingNavigation = null
            workController?.clear()
            if (mode == VehicleLoginView.Purpose.LOGIN && session == null) {
                val request = challenge
                if (request != null) network.execute { runCatching { api.cancel(request) } }
                beginLogin()
                return
            }
            if (mode == VehicleLoginView.Purpose.LOGOUT || mode == VehicleLoginView.Purpose.HANDOVER) {
                cancelSessionFlow()
                return
            }
        } else if (mode == VehicleLoginView.Purpose.LOGIN && session == null) {
            val current = challenge
            if (current == null) beginLogin() else pollLogin(current)
        }
        if (mode == VehicleLoginView.Purpose.WORKSPACE) renderWorkspace()
    }

    private fun retryCurrentMode() {
        if (cancelPending) {
            cancelSessionFlow()
            return
        }
        when (mode) {
            VehicleLoginView.Purpose.LOGIN -> retryLoginStatus(handover = false)
            VehicleLoginView.Purpose.WORKSPACE -> session?.let { invalidatePendingCallbacks(); checkSession(it, reopen = true) }
            VehicleLoginView.Purpose.HANDOVER -> if (platform.parked) retryLoginStatus(handover = true) else cancelSessionFlow()
            VehicleLoginView.Purpose.LOGOUT -> {
                val approved = session ?: return
                val request = logoutChallenge
                when {
                    !platform.parked -> cancelSessionFlow()
                    request == null -> beginLogout()
                    else -> {
                        invalidatePendingCallbacks()
                        showStatusLoading("로그아웃 승인 상태를 확인하고 있습니다.")
                        perform(operation = { api.logoutStatus(approved, request) to makeQr(request.approvalUrl) }) { result ->
                            result.onSuccess { (status, qr) ->
                                if (status == VehicleLoginApi.LogoutStatus.PENDING) loginView.showRequest(qr, null, mode)
                                pollLogout(approved, request)
                            }.onFailure { statusError("로그아웃 승인 상태를 확인할 수 없습니다.") }
                        }
                    }
                }
            }
        }
    }

    private fun retryLoginStatus(handover: Boolean) {
        val request = challenge
        if (request == null) {
            beginLogin(handover)
            return
        }
        invalidatePendingCallbacks()
        showStatusLoading("휴대폰 승인 상태를 확인하고 있습니다.")
        perform(operation = { api.approval(request) to makeQr(request.approvalUrl) }) { result ->
            result.onSuccess { (status, qr) ->
                if (status is VehicleLoginApi.Approval.Pending) loginView.showRequest(qr, request.pin, mode)
                pollLogin(request)
            }.onFailure { statusError("휴대폰 승인 상태를 확인할 수 없습니다.") }
        }
    }

    private fun retryPolling(message: String, retry: () -> Unit) {
        if (++consecutiveFailures < 3) schedule(POLL_INTERVAL, retry)
        else statusError(message)
    }

    private fun showStatusLoading(message: String) {
        if (loginView.parent == null) setContentView(loginView)
        loginView.showLoading(mode, message)
    }

    private fun statusError(message: String, allowCancel: Boolean = canCancelFlow()) {
        if (loginView.parent == null) setContentView(loginView)
        loginView.showError(message, cancelable = allowCancel)
    }

    private fun canCancelFlow() = mode == VehicleLoginView.Purpose.LOGOUT || mode == VehicleLoginView.Purpose.HANDOVER

    private fun clearWorkspace() {
        workController?.close()
        workController = null
        workspace = null
    }

    private fun invalidatePendingCallbacks() {
        generation++
        main.removeCallbacksAndMessages(null)
        consecutiveFailures = 0
    }

    private fun <T> perform(operation: () -> T, discard: ((T) -> Unit)? = null, done: (Result<T>) -> Unit) {
        val current = generation
        network.execute {
            val result = try {
                Result.success(operation())
            } catch (error: Exception) {
                Result.failure(error)
            }
            if (current != generation) {
                if (discard != null) result.onSuccess { value -> runCatching { discard(value) } }
                return@execute
            }
            main.post {
                if (visible && current == generation) done(result)
                else if (discard != null && !network.isShutdown) {
                    result.onSuccess { value -> network.execute { runCatching { discard(value) } } }
                }
            }
        }
    }

    private fun schedule(delay: Long, operation: () -> Unit) {
        val current = generation
        main.postDelayed({ if (visible && current == generation) operation() }, delay)
    }

    private fun makeQr(url: String): Bitmap {
        val size = 720
        val matrix = QRCodeWriter().encode(url, BarcodeFormat.QR_CODE, size, size)
        val pixels = IntArray(size * size) { index ->
            if (matrix[index % size, index / size]) Color.BLACK else Color.WHITE
        }
        return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
    }

    private companion object {
        const val POLL_INTERVAL = 1_000L
        const val SESSION_CHECK_INTERVAL = 5_000L
    }
}
