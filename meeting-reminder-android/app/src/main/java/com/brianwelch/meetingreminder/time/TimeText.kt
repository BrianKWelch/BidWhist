package com.brianwelch.meetingreminder.time

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * All user-facing time text. Every function takes the zone explicitly; the UI
 * passes ZoneId.systemDefault() read at render time, so a phone that lands in
 * Honolulu shows Honolulu times on the next redraw without touching stored data.
 */
object TimeText {

    /** Extra zones the user can switch on in Settings, in display order. */
    val EXTRA_ZONES: List<Pair<String, String>> = listOf(
        "America/New_York" to "Eastern (Columbus)",
        "Pacific/Guam" to "Guam",
        "Pacific/Honolulu" to "Hawaii",
    )

    fun time(instant: Instant, zone: ZoneId, use24h: Boolean = false, locale: Locale = Locale.getDefault()): String =
        DateTimeFormatter.ofPattern(if (use24h) "HH:mm" else "h:mm a", locale).format(instant.atZone(zone))

    /** "10:00 AM – 10:30 AM". Adds the end date when the meeting crosses midnight. */
    fun range(start: Instant, end: Instant, zone: ZoneId, use24h: Boolean = false, locale: Locale = Locale.getDefault()): String {
        val s = start.atZone(zone)
        val e = end.atZone(zone)
        val endText = time(end, zone, use24h, locale)
        val suffix = if (e.toLocalDate() != s.toLocalDate()) " (${shortDate(e.toLocalDate(), locale)})" else ""
        return "${time(start, zone, use24h, locale)} – $endText$suffix"
    }

    /** "EDT", "HST", "ChST"... falls back to "GMT+10" style when no short name exists. */
    fun zoneAbbreviation(zone: ZoneId, at: Instant, locale: Locale = Locale.getDefault()): String {
        val short = DateTimeFormatter.ofPattern("zzz", locale).format(at.atZone(zone))
        return short.ifBlank { zone.getDisplayName(TextStyle.SHORT, locale) }
    }

    fun shortDate(date: LocalDate, locale: Locale = Locale.getDefault()): String =
        DateTimeFormatter.ofPattern("EEE, MMM d", locale).format(date)

    /** "Today", "Tomorrow", "Yesterday" or "Thu, Sep 26". */
    fun dayLabel(instant: Instant, zone: ZoneId, now: Instant, locale: Locale = Locale.getDefault()): String {
        val date = instant.atZone(zone).toLocalDate()
        val today = now.atZone(zone).toLocalDate()
        return when (date) {
            today -> "Today"
            today.plusDays(1) -> "Tomorrow"
            today.minusDays(1) -> "Yesterday"
            else -> shortDate(date, locale)
        }
    }

    /**
     * Secondary line for the extra zones, skipping any zone that currently shows
     * the same wall-clock time as the phone. Example: "Eastern 4:00 PM · Guam 6:00 AM Fri".
     */
    fun extraZonesLine(
        start: Instant,
        localZone: ZoneId,
        extraZoneIds: List<String>,
        use24h: Boolean = false,
        locale: Locale = Locale.getDefault(),
    ): String? {
        val localOffset = localZone.rules.getOffset(start)
        val localDate = start.atZone(localZone).toLocalDate()
        val parts = EXTRA_ZONES.filter { it.first in extraZoneIds }.mapNotNull { (id, label) ->
            val zone = ZoneId.of(id)
            if (zone.rules.getOffset(start) == localOffset) return@mapNotNull null
            val zoned = start.atZone(zone)
            val dayNote = if (zoned.toLocalDate() != localDate) {
                " " + zoned.dayOfWeek.getDisplayName(TextStyle.SHORT, locale)
            } else ""
            "${label.substringBefore(" (")} ${time(start, zone, use24h, locale)}$dayNote"
        }
        return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
    }
}
