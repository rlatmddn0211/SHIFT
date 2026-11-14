package com.shift.vehicle

import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal data class Visit(
    val id: String,
    val time: String,
    val title: String,
    val address: String,
    val latitude: Double?,
    val longitude: Double?,
    val poiId: String?,
    val poiName: String?,
    val changedFrom: String?,
    val evidence: String?,
    val sourceUrl: String?,
)

internal data class WorkMessage(val subject: String, val preview: String, val receivedAt: String, val sender: String)
internal data class WorkNote(val id: String, val title: String)
internal data class DriverProfile(val seatHeight: Int, val seatPosition: Int, val speakBriefing: Boolean)
internal data class WorkBriefing(val text: String, val source: String)
internal data class Workspace(
    val source: String,
    val visits: List<Visit>,
    val messages: List<WorkMessage>,
    val notes: List<WorkNote>,
    val profile: DriverProfile,
    val briefing: WorkBriefing,
)

internal class WorkspaceApi(private val origin: String = BuildConfig.SHIFT_API_ORIGIN) {
    fun load(token: String): Workspace = request("GET", PATH, token).run {
        val settings = getJSONObject("profile")
        val brief = getJSONObject("briefing")
        Workspace(
            source = getString("source"),
            visits = getJSONArray("visits").items().map {
                Visit(
                    it.getString("id"), it.optString("time"), it.getString("title"), it.optString("address"),
                    it.numberOrNull("latitude"), it.numberOrNull("longitude"),
                    it.stringOrNull("poiId"), it.stringOrNull("poiName"), it.stringOrNull("changedFrom"),
                    it.stringOrNull("evidence"), it.stringOrNull("sourceUrl"),
                )
            },
            messages = getJSONArray("messages").items().map {
                WorkMessage(it.getString("subject"), it.optString("preview"), it.optString("receivedAt"), it.optString("sender"))
            },
            notes = getJSONArray("notes").items().map { WorkNote(it.getString("id"), it.getString("title")) },
            profile = DriverProfile(settings.getInt("seatHeight"), settings.getInt("seatPosition"), settings.getBoolean("speakBriefing")),
            briefing = WorkBriefing(brief.optString("text"), brief.getString("source")),
        )
    }

    fun saveNote(token: String, text: String, visitId: String?, requestId: String): String {
        val body = JSONObject().put("text", text).put("requestId", requestId)
        if (visitId != null) body.put("visitId", visitId)
        return request("POST", "$PATH/notes", token, body).getString("source")
    }

    fun readNote(token: String, id: String): String {
        val segment = URLEncoder.encode(id, "UTF-8").replace("+", "%20")
        return request("GET", "$PATH/notes/$segment", token).getString("text")
    }

    private fun request(method: String, path: String, token: String, body: JSONObject? = null): JSONObject {
        val connection = URL("$origin$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 3_000
            connection.readTimeout = 12_000
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { it.write(bytes) }
            }
            val code = connection.responseCode
            if (code == 401) throw WorkspaceSessionEnded()
            if (code !in 200..299) throw IOException("Workspace request failed")
            return connection.inputStream.bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) }
        } finally {
            connection.disconnect()
        }
    }

    private fun JSONArray.items(): List<JSONObject> = List(length(), ::getJSONObject)
    private fun JSONObject.stringOrNull(key: String): String? = optString(key, "").takeIf { !isNull(key) && it.isNotBlank() }
    private fun JSONObject.numberOrNull(key: String): Double? = optDouble(key).takeIf { it.isFinite() }

    private companion object {
        const val PATH = "/api/vehicles/hyundai-demo-01/workspace"
    }
}

internal class WorkspaceSessionEnded : IOException()
