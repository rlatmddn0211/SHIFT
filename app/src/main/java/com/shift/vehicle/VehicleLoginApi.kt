package com.shift.vehicle

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

internal class VehicleLoginApi(private val origin: String = BuildConfig.SHIFT_API_ORIGIN) {
    data class Challenge(val id: String, val approvalUrl: String, val pin: String, val expiresAt: Long)
    data class LogoutChallenge(val id: String, val approvalUrl: String, val expiresAt: Long)
    data class Session(val token: String, val employeeName: String)

    enum class LogoutStatus { PENDING, APPROVED, EXPIRED, REPLACED }

    sealed interface Approval {
        data object Pending : Approval
        data object Expired : Approval
        data object Locked : Approval
        data object Replaced : Approval
        data class Approved(val session: Session) : Approval
    }

    fun begin(): Challenge {
        val response = request("POST", REQUESTS)
        if (response.code !in 200..299) throw IOException("Login request rejected")
        return response.body.run {
            Challenge(getString("requestId"), getString("approvalUrl"), getString("pin"), getLong("expiresAt"))
        }
    }

    fun approval(challenge: Challenge): Approval = loginStatus("GET", challenge)

    fun cancel(challenge: Challenge): Approval = loginStatus("DELETE", challenge)

    private fun loginStatus(method: String, challenge: Challenge): Approval {
        val response = request(method, "$REQUESTS/${challenge.id}")
        if (response.code == 404 || response.code == 410) return Approval.Expired
        if (response.code != 200) throw IOException("Approval status unavailable")
        return response.body.run {
            when (getString("status")) {
                "pending" -> Approval.Pending
                "expired" -> Approval.Expired
                "locked" -> Approval.Locked
                "replaced" -> Approval.Replaced
                "approved" -> Approval.Approved(Session(getString("sessionToken"), getString("employeeName")))
                else -> throw IOException("Unexpected approval status")
            }
        }
    }

    fun beginLogout(session: Session): LogoutChallenge {
        val response = request("POST", LOGOUTS, session.token)
        if (response.code == 401) throw InactiveSessionException()
        if (response.code != 201) throw IOException("Logout request rejected")
        return response.body.run {
            LogoutChallenge(getString("requestId"), getString("approvalUrl"), getLong("expiresAt"))
        }
    }

    fun logoutStatus(session: Session, challenge: LogoutChallenge): LogoutStatus =
        logoutStatus("GET", session, challenge)

    fun cancelLogout(session: Session, challenge: LogoutChallenge): LogoutStatus =
        logoutStatus("DELETE", session, challenge)

    private fun logoutStatus(method: String, session: Session, challenge: LogoutChallenge): LogoutStatus {
        val response = request(method, "$LOGOUTS/${challenge.id}", session.token)
        if (response.code == 404 || response.code == 410) return LogoutStatus.EXPIRED
        if (response.code != 200) throw IOException("Logout status unavailable")
        return when (response.body.getString("status")) {
            "pending" -> LogoutStatus.PENDING
            "approved" -> LogoutStatus.APPROVED
            "expired" -> LogoutStatus.EXPIRED
            "replaced" -> LogoutStatus.REPLACED
            else -> throw IOException("Unexpected logout status")
        }
    }

    fun isActive(session: Session): Boolean = when (request("GET", "$VEHICLE/session", session.token).code) {
        200 -> true
        401 -> false
        else -> throw IOException("Session status unavailable")
    }

    private fun request(method: String, path: String, token: String? = null): Response {
        if (origin.isBlank()) throw IOException("SHIFT API origin is unset")
        val connection = URL("$origin$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 3_000
            connection.readTimeout = 3_000
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Accept", "application/json")
            if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
            if (method == "POST") {
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(0)
                connection.outputStream.close()
            }
            val code = connection.responseCode
            val body = if (code in 200..299) {
                connection.inputStream.bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) }
            } else {
                JSONObject()
            }
            return Response(code, body)
        } finally {
            connection.disconnect()
        }
    }

    private data class Response(val code: Int, val body: JSONObject)

    class InactiveSessionException : IOException("Vehicle session is inactive")

    private companion object {
        const val VEHICLE = "/api/vehicles/hyundai-demo-01"
        const val REQUESTS = "$VEHICLE/login-requests"
        const val LOGOUTS = "$VEHICLE/logout-requests"
    }
}
