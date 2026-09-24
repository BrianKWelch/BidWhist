package com.brianwelch.meetingreminder.graph

import com.brianwelch.meetingreminder.model.Meeting
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

/** Turns Graph event JSON into [Meeting]s. Pure: no Android, no network. */
object GraphParser {

    data class Page(val meetings: List<Meeting>, val nextLink: String?)

    fun parsePage(json: String): Page {
        val root = JSONObject(json)
        val items = root.optJSONArray("value")
        val meetings = buildList {
            if (items != null) for (i in 0 until items.length()) {
                items.optJSONObject(i)?.let { parseEvent(it) }?.let { add(it) }
            }
        }
        val next = root.optString("@odata.nextLink").takeIf { it.isNotBlank() }
        return Page(meetings, next)
    }

    fun parseEvent(json: String): Meeting? = parseEvent(JSONObject(json))

    fun parseEvent(o: JSONObject): Meeting? {
        val id = o.optString("id").takeIf { it.isNotBlank() } ?: return null
        val start = parseDateTime(o.optJSONObject("start")) ?: return null
        val end = parseDateTime(o.optJSONObject("end")) ?: start

        val onlineJoin = o.optJSONObject("onlineMeeting")?.optString("joinUrl")?.takeIf { it.isNotBlank() }
        val legacyJoin = o.optString("onlineMeetingUrl").takeIf { it.isNotBlank() && it != "null" }
        val location = o.optJSONObject("location")?.optString("displayName")?.takeIf { it.isNotBlank() }
        val locationUri = o.optJSONObject("location")?.optString("locationUri")?.takeIf { it.isNotBlank() }
        val body = o.optJSONObject("body")?.optString("content")
        val bodyPreview = o.optString("bodyPreview").takeIf { it.isNotBlank() }

        val joinUrl = onlineJoin?.let { JoinUrlExtractor.unwrapSafeLink(it) }
            ?: legacyJoin?.takeIf { JoinUrlExtractor.isMeetingUrl(it) }
            ?: JoinUrlExtractor.extract(location, locationUri, bodyPreview, body)

        val subject = o.optString("subject").trim().takeIf { it.isNotEmpty() && it != "null" }
        return Meeting(
            id = id,
            title = subject ?: "(No title)",
            start = start,
            end = if (end.isBefore(start)) start else end,
            isAllDay = o.optBoolean("isAllDay", false),
            isCancelled = o.optBoolean("isCancelled", false),
            joinUrl = joinUrl,
            location = location,
            organizer = o.optJSONObject("organizer")?.optJSONObject("emailAddress")
                ?.optString("name")?.takeIf { it.isNotBlank() },
            response = o.optJSONObject("responseStatus")?.optString("response")?.takeIf { it.isNotBlank() },
        )
    }

    /**
     * Graph dateTimeTimeZone: {"dateTime":"2026-09-24T14:00:00.0000000","timeZone":"UTC"}.
     * The client asks for UTC, but other zones are handled in case a proxy or
     * a future caller drops the Prefer header.
     */
    fun parseDateTime(o: JSONObject?): Instant? {
        if (o == null) return null
        val raw = o.optString("dateTime").takeIf { it.isNotBlank() } ?: return null
        val local = runCatching { LocalDateTime.parse(raw.trimFractionTo9()) }.getOrNull() ?: return null
        val zone = zoneFor(o.optString("timeZone"))
        return local.atZone(zone).toInstant()
    }

    fun zoneFor(name: String?): ZoneId {
        if (name.isNullOrBlank() || name.equals("UTC", true) || name.equals("tzone://Microsoft/Utc", true)) {
            return ZoneOffset.UTC
        }
        WINDOWS_ZONES[name]?.let { return ZoneId.of(it) }
        return runCatching { ZoneId.of(name) }.getOrDefault(ZoneOffset.UTC)
    }

    private fun String.trimFractionTo9(): String {
        val dot = indexOf('.')
        if (dot < 0) return this
        val fraction = substring(dot + 1).takeWhile { it.isDigit() }
        return if (fraction.length <= 9) this else substring(0, dot + 1) + fraction.take(9)
    }

    /** Windows zone names Outlook commonly returns, mapped to IANA ids. */
    private val WINDOWS_ZONES = mapOf(
        "Eastern Standard Time" to "America/New_York",
        "Central Standard Time" to "America/Chicago",
        "Mountain Standard Time" to "America/Denver",
        "US Mountain Standard Time" to "America/Phoenix",
        "Pacific Standard Time" to "America/Los_Angeles",
        "Alaskan Standard Time" to "America/Anchorage",
        "Hawaiian Standard Time" to "Pacific/Honolulu",
        "West Pacific Standard Time" to "Pacific/Guam",
        "GMT Standard Time" to "Europe/London",
        "W. Europe Standard Time" to "Europe/Berlin",
        "Romance Standard Time" to "Europe/Paris",
        "Tokyo Standard Time" to "Asia/Tokyo",
        "India Standard Time" to "Asia/Kolkata",
        "AUS Eastern Standard Time" to "Australia/Sydney",
    )
}
