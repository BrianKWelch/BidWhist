package com.brianwelch.meetingreminder.graph

import java.net.URI
import java.net.URLDecoder

/**
 * Finds an online-meeting join link (Teams, Zoom, ZoomGov, Webex, Google Meet)
 * in free text such as an event's location or body. Graph's own
 * onlineMeeting.joinUrl is preferred by the caller; this is the fallback for
 * meetings where the link was pasted into the invite.
 */
object JoinUrlExtractor {

    private val urlRegex = Regex("""https?://[^\s<>"'\]\[(){}|\\^`]+""", RegexOption.IGNORE_CASE)
    private const val TRAILING = ".,;:!?*'\""

    /** Returns the first meeting link found, scanning [texts] in the order given. */
    fun extract(vararg texts: String?): String? {
        for (text in texts) {
            if (text.isNullOrBlank()) continue
            val cleanText = text.replace("&amp;", "&")
            for (match in urlRegex.findAll(cleanText)) {
                val url = unwrapSafeLink(match.value.trimEnd { it in TRAILING })
                if (isMeetingUrl(url)) return url
            }
        }
        return null
    }

    fun isMeetingUrl(url: String): Boolean {
        val uri = runCatching { URI(url) }.getOrNull() ?: return false
        if (!uri.scheme.equals("https", true) && !uri.scheme.equals("http", true)) return false
        val host = uri.host?.lowercase() ?: return false
        val path = uri.rawPath?.lowercase().orEmpty()
        return when {
            host.endsWith("teams.microsoft.com") || host.endsWith("teams.microsoft.us") ->
                path.startsWith("/l/meetup-join") || path.startsWith("/meet/") || path.startsWith("/l/meet")
            host == "teams.live.com" -> path.startsWith("/meet")
            host.endsWith("zoom.us") || host.endsWith("zoomgov.com") ->
                path.startsWith("/j/") || path.startsWith("/w/") || path.startsWith("/my/") || path.startsWith("/s/")
            host.endsWith("webex.com") -> path.isNotEmpty() && path != "/"
            host == "meet.google.com" -> path.length > 1
            else -> false
        }
    }

    /**
     * Microsoft Defender rewrites links as
     * https://nam12.safelinks.protection.outlook.com/?url=<encoded>&data=...
     * The real target sits in the url parameter.
     */
    fun unwrapSafeLink(url: String): String {
        val uri = runCatching { URI(url) }.getOrNull() ?: return url
        val host = uri.host?.lowercase() ?: return url
        if (!host.endsWith("safelinks.protection.outlook.com")) return url
        val query = uri.rawQuery ?: return url
        val target = query.split('&')
            .firstOrNull { it.startsWith("url=", ignoreCase = true) }
            ?.substringAfter('=')
            ?: return url
        return runCatching { URLDecoder.decode(target, "UTF-8") }.getOrDefault(url)
    }
}
