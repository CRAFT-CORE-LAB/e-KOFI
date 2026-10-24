package com.ekofi.nfc

import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class ApiClient(var baseUrl: String) {
    var token: String? = null

    fun login(email: String, password: String): JSONObject {
        val body = JSONObject()
            .put("email", email)
            .put("password", password)
        val response = request("POST", "/auth/login", body, auth = false)
        token = response.getString("accessToken")
        return response
    }

    fun registerCard(studentId: String, cardUid: String, authToken: String?): JSONObject {
        val body = JSONObject()
            .put("studentId", studentId)
            .put("cardUid", cardUid)
        if (!authToken.isNullOrBlank()) {
            body.put("authToken", authToken)
        }
        return request("POST", "/cards/register", body)
    }

    fun resolveCard(cardUid: String, authToken: String): JSONObject {
        val body = JSONObject()
            .put("cardUid", cardUid)
            .put("authToken", authToken)
        return request("POST", "/cards/resolve", body)
    }

    private fun request(
        method: String,
        path: String,
        body: JSONObject?,
        auth: Boolean = true,
    ): JSONObject {
        val url = URL(baseUrl.trimEnd('/') + path)
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.setRequestProperty("Content-Type", "application/json")
        connection.connectTimeout = 15000
        connection.readTimeout = 15000
        if (auth && token != null) {
            connection.setRequestProperty("Authorization", "Bearer $token")
        }
        if (body != null) {
            connection.doOutput = true
            OutputStreamWriter(connection.outputStream).use { it.write(body.toString()) }
        }
        val stream = if (connection.responseCode in 200..299) {
            connection.inputStream
        } else {
            connection.errorStream
        }
        val text = stream.bufferedReader().use { it.readText() }
        if (connection.responseCode !in 200..299) {
            val message = runCatching { JSONObject(text).opt("message")?.toString() }.getOrNull()
                ?: text
            throw IllegalStateException(message)
        }
        return if (text.isBlank()) JSONObject() else JSONObject(text)
    }
}
