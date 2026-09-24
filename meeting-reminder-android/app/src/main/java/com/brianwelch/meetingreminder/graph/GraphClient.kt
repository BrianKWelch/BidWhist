package com.brianwelch.meetingreminder.graph

import com.brianwelch.meetingreminder.auth.AuthConfig
import com.brianwelch.meetingreminder.auth.AuthRequiredException
import com.brianwelch.meetingreminder.model.EventLookup
import com.brianwelch.meetingreminder.model.Meeting
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant

class GraphException(val status: Int, message: String) : IOException(message)

/**
 * Read-only Microsoft Graph client.
 *
 * READ-ONLY GUARANTEE: every request goes through [get], which hard-codes the
 * HTTP method to GET. There is no code path that can create, update, delete or
 * respond to an event, change its reminder, or notify attendees. The token is
 * also limited to Calendars.Read, so Graph itself would reject any write.
 */
class GraphClient(private val accessToken: suspend () -> String) {

    private val select = listOf(
        "id", "subject", "start", "end", "isAllDay", "isCancelled",
        "onlineMeeting", "onlineMeetingUrl", "location", "body", "bodyPreview",
        "organizer", "responseStatus",
    ).joinToString(",")

    /** Every occurrence (recurring instances expanded) between [from] and [to]. */
    suspend fun calendarView(from: Instant, to: Instant): List<Meeting> = withContext(Dispatchers.IO) {
        val token = accessToken()
        val results = mutableListOf<Meeting>()
        var url: String? = AuthConfig.GRAPH_BASE + "/me/calendarView" +
            "?startDateTime=" + enc(from.toString()) +
            "&endDateTime=" + enc(to.toString()) +
            "&\$select=" + enc(select) +
            "&\$orderby=" + enc("start/dateTime") +
            "&\$top=100"
        var pages = 0
        while (url != null && pages < MAX_PAGES) {
            val page = GraphParser.parsePage(get(url, token))
            results += page.meetings
            url = page.nextLink
            pages++
        }
        results
    }

    /** Looks up one event to tell "moved outside the list window" apart from "deleted". */
    suspend fun event(id: String): EventLookup = withContext(Dispatchers.IO) {
        try {
            val json = get(AuthConfig.GRAPH_BASE + "/me/events/" + enc(id) + "?\$select=" + enc(select), accessToken())
            GraphParser.parseEvent(json)?.let { EventLookup.Found(it) } ?: EventLookup.Unknown
        } catch (e: GraphException) {
            if (e.status == 404) EventLookup.NotFound else EventLookup.Unknown
        } catch (e: AuthRequiredException) {
            throw e
        } catch (e: IOException) {
            EventLookup.Unknown
        }
    }

    private suspend fun get(url: String, token: String): String {
        var attempt = 0
        while (true) {
            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = METHOD
                connectTimeout = 15_000
                readTimeout = 30_000
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Accept", "application/json")
                // UTC times (converted to the phone's zone only for display), plain-text
                // bodies (only scanned for a join link, never stored), and ids that stay
                // stable if the event moves folders (future background sync).
                addRequestProperty("Prefer", "outlook.timezone=\"UTC\"")
                addRequestProperty("Prefer", "outlook.body-content-type=\"text\"")
                addRequestProperty("Prefer", "IdType=\"ImmutableId\"")
            }
            try {
                val code = conn.responseCode
                if (code in 200..299) return conn.inputStream.bufferedReader().use { it.readText() }

                val body = runCatching { conn.errorStream?.bufferedReader()?.use { it.readText() } }.getOrNull()
                if (code == 401) throw AuthRequiredException()
                if ((code == 429 || code == 503 || code == 504) && attempt < 2) {
                    val waitSec = conn.getHeaderField("Retry-After")?.toLongOrNull()?.coerceIn(1, 10) ?: 2L
                    attempt++
                    delay(waitSec * 1000)
                    continue
                }
                throw GraphException(code, errorMessage(code, body))
            } finally {
                conn.disconnect()
            }
        }
    }

    private fun errorMessage(code: Int, body: String?): String {
        val detail = runCatching { JSONObject(body!!).getJSONObject("error").getString("message") }.getOrNull()
        return when (code) {
            403 -> "Microsoft 365 denied calendar access (403). Your admin may need to approve Calendars.Read."
            else -> "Microsoft 365 error $code" + (detail?.let { ": $it" } ?: "")
        }
    }

    private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    private companion object {
        /** The only HTTP method this client can send. */
        const val METHOD = "GET"
        const val MAX_PAGES = 20
    }
}
