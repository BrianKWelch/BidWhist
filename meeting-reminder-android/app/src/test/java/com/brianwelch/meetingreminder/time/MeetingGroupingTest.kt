package com.brianwelch.meetingreminder.time

import com.brianwelch.meetingreminder.model.Meeting
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

class MeetingGroupingTest {

    private fun m(id: String, start: String, minutes: Long = 30, allDay: Boolean = false, cancelled: Boolean = false) =
        Instant.parse(start).let { Meeting(id, id, it, it.plusSeconds(minutes * 60), allDay, cancelled) }

    private val meetings = listOf(
        m("late-today-utc", "2026-09-25T02:00:00Z"),   // Thu 22:00 EDT / Wed 16:00 HST
        m("morning", "2026-09-25T14:00:00Z"),          // Fri 10:00 EDT / Fri 04:00 HST
        m("tomorrow", "2026-09-26T15:00:00Z"),
        m("next-week", "2026-09-29T15:00:00Z"),
        m("ended", "2026-09-24T12:00:00Z"),
        m("allday", "2026-09-25T00:00:00Z", 1440, allDay = true),
        m("cancelled", "2026-09-25T16:00:00Z", cancelled = true),
    )

    @Test fun groupsByPhonesCurrentZone() {
        val now = Instant.parse("2026-09-25T01:00:00Z")

        val columbus = MeetingGrouping.group(meetings, now, ZoneId.of("America/New_York"))
        // Columbus: now is Thu 21:00. 22:00 Thu is today; Fri 10:00 is tomorrow.
        assertEquals(listOf("late-today-utc"), columbus[DaySection.TODAY]!!.map { it.id })
        assertEquals(listOf("morning"), columbus[DaySection.TOMORROW]!!.map { it.id })
        assertEquals(listOf("tomorrow", "next-week"), columbus[DaySection.UPCOMING]!!.map { it.id })

        val hawaii = MeetingGrouping.group(meetings, now, ZoneId.of("Pacific/Honolulu"))
        // Honolulu: now is Thu 15:00. Thu 16:00 is today, Fri 04:00 is tomorrow, Sat 05:00 is upcoming.
        assertEquals(listOf("late-today-utc"), hawaii[DaySection.TODAY]!!.map { it.id })
        assertEquals(listOf("morning"), hawaii[DaySection.TOMORROW]!!.map { it.id })
        assertEquals(listOf("tomorrow", "next-week"), hawaii[DaySection.UPCOMING]!!.map { it.id })

        // Twelve hours later (Fri 03:00 in Honolulu) the Friday meeting has slid from TOMORROW to TODAY.
        val hawaiiNextDay = MeetingGrouping.group(meetings, now.plusSeconds(12 * 3600), ZoneId.of("Pacific/Honolulu"))
        assertEquals(listOf("morning"), hawaiiNextDay[DaySection.TODAY]!!.map { it.id })
        assertNull(hawaiiNextDay[DaySection.UPCOMING]?.firstOrNull { it.id == "late-today-utc" })

        val guam = MeetingGrouping.group(meetings, now, ZoneId.of("Pacific/Guam"))
        // Guam: now is Fri 11:00. The 12:00 Fri meeting is today, the Sat 00:00 one is tomorrow.
        assertEquals(listOf("late-today-utc"), guam[DaySection.TODAY]!!.map { it.id })
        assertEquals(listOf("morning"), guam[DaySection.TOMORROW]!!.map { it.id })
    }

    @Test fun hidesEndedAllDayAndCancelled() {
        val now = Instant.parse("2026-09-25T01:00:00Z")
        val all = MeetingGrouping.group(meetings, now, ZoneId.of("America/New_York")).values.flatten().map { it.id }
        assertTrue("ended" !in all && "allday" !in all && "cancelled" !in all)
    }

    @Test fun inProgressMeetingFromBeforeMidnightIsToday() {
        val ny = ZoneId.of("America/New_York")
        val overnight = m("overnight", "2026-09-25T03:30:00Z", minutes = 120) // 23:30 -> 01:30 EDT
        val now = Instant.parse("2026-09-25T04:30:00Z") // 00:30 EDT next day
        assertEquals(listOf("overnight"), MeetingGrouping.group(listOf(overnight), now, ny)[DaySection.TODAY]!!.map { it.id })
    }

    @Test fun timeTextInEachZone() {
        val start = Instant.parse("2026-09-25T14:00:00Z")
        val end = start.plusSeconds(1800)
        assertEquals("10:00 AM – 10:30 AM", TimeText.range(start, end, ZoneId.of("America/New_York"), locale = Locale.US))
        assertEquals("4:00 AM – 4:30 AM", TimeText.range(start, end, ZoneId.of("Pacific/Honolulu"), locale = Locale.US))
        assertEquals("14:00 – 14:30", TimeText.range(start, end, ZoneId.of("UTC"), use24h = true, locale = Locale.US))
        assertEquals("HST", TimeText.zoneAbbreviation(ZoneId.of("Pacific/Honolulu"), start, Locale.US))
    }

    @Test fun extraZonesLineSkipsSameOffsetAndNotesDay() {
        val start = Instant.parse("2026-09-25T14:00:00Z")
        val line = TimeText.extraZonesLine(
            start, ZoneId.of("Pacific/Honolulu"),
            listOf("America/New_York", "Pacific/Guam", "Pacific/Honolulu"), locale = Locale.US,
        )
        // Honolulu itself is skipped (same as phone). Guam is already Saturday.
        assertEquals("Eastern 10:00 AM · Guam 12:00 AM Sat", line)
        assertNull(TimeText.extraZonesLine(start, ZoneId.of("America/New_York"), listOf("America/New_York"), locale = Locale.US))
    }

    @Test fun crossMidnightRangeShowsEndDate() {
        val start = Instant.parse("2026-09-25T03:30:00Z")
        assertEquals(
            "11:30 PM – 1:30 AM (Fri, Sep 25)",
            TimeText.range(start, start.plusSeconds(7200), ZoneId.of("America/New_York"), locale = Locale.US),
        )
    }
}
