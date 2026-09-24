package com.brianwelch.meetingreminder.reminders

import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.data.ReminderStatus
import com.brianwelch.meetingreminder.reminders.ReminderMath.AlarmAction
import com.brianwelch.meetingreminder.reminders.ReminderMath.Problem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

class ReminderMathTest {

    private val start = Instant.parse("2026-09-25T14:00:00Z")

    @Test fun presetSubtractsAbsoluteDuration() {
        assertEquals(Instant.parse("2026-09-25T13:45:00Z"), ReminderMath.remindAt(start, 15))
        assertEquals(Instant.parse("2026-09-25T13:00:00Z"), ReminderMath.remindAt(start, 60))
    }

    @Test fun reminderAcrossDstChangeIsExactlyOneHourEarlier() {
        // US DST ends 2026-11-01 at 02:00 EDT -> 01:00 EST. A 02:30 EST meeting with a 1-hour
        // reminder must fire 60 real minutes earlier, even though the wall clock repeats 01:xx.
        val ny = ZoneId.of("America/New_York")
        val meeting = ZonedDateTime.of(2026, 11, 1, 2, 30, 0, 0, ny).toInstant()
        val remind = ReminderMath.remindAt(meeting, 60)
        assertEquals(Duration.ofHours(1), Duration.between(remind, meeting))
        assertEquals(Instant.parse("2026-11-01T06:30:00Z"), remind)
    }

    @Test fun reminderIsIndependentOfDisplayZone() {
        // Created in Columbus, phone later in Guam: stored instant is identical, only rendering differs.
        val remind = ReminderMath.remindAt(start, 10)
        val inColumbus = remind.atZone(ZoneId.of("America/New_York"))
        val inGuam = remind.atZone(ZoneId.of("Pacific/Guam"))
        assertEquals(inColumbus.toInstant(), inGuam.toInstant())
        assertEquals(9, inColumbus.hour)   // 09:50 EDT
        assertEquals(23, inGuam.hour)      // 23:50 ChST
    }

    @Test fun availability() {
        val now = Instant.parse("2026-09-25T13:50:00Z")
        assertTrue(ReminderMath.isAvailable(start, 5, now))
        assertFalse(ReminderMath.isAvailable(start, 10, now)) // exactly now: not in the future
        assertFalse(ReminderMath.isAvailable(start, 15, now))
    }

    @Test fun validation() {
        val now = Instant.parse("2026-09-25T12:00:00Z")
        assertNull(ReminderMath.validate(Instant.parse("2026-09-25T13:00:00Z"), start, now))
        assertEquals(Problem.IN_PAST, ReminderMath.validate(Instant.parse("2026-09-25T11:00:00Z"), start, now))
        assertEquals(Problem.AFTER_START, ReminderMath.validate(Instant.parse("2026-09-25T14:01:00Z"), start, now))
        assertEquals(Problem.MEETING_STARTED, ReminderMath.validate(now, start, start.plusSeconds(1)))
        assertEquals(Problem.TOO_EARLY, ReminderMath.validate(start.minus(Duration.ofDays(8)), start, start.minus(Duration.ofDays(9))))
    }

    @Test fun labels() {
        assertEquals("5 minutes before", ReminderMath.offsetLabel(5))
        assertEquals("1 minute before", ReminderMath.offsetLabel(1))
        assertEquals("1 hour before", ReminderMath.offsetLabel(60))
        assertEquals("1 hour 30 minutes before", ReminderMath.offsetLabel(90))
        assertEquals("2 days before", ReminderMath.offsetLabel(2880))
        assertEquals("At start time", ReminderMath.offsetLabel(0))
    }

    @Test fun notificationTitleRoundsToNearestMinute() {
        assertEquals("Meeting in 15 minutes", ReminderMath.notificationTitle(start, start.minusSeconds(15 * 60 - 1)))
        assertEquals("Meeting in 15 minutes", ReminderMath.notificationTitle(start, start.minusSeconds(15 * 60 + 5)))
        assertEquals("Meeting in 1 minute", ReminderMath.notificationTitle(start, start.minusSeconds(60)))
        assertEquals("Meeting in 1 hour", ReminderMath.notificationTitle(start, start.minusSeconds(3600)))
        assertEquals("Meeting in 1 hour 30 minutes", ReminderMath.notificationTitle(start, start.minusSeconds(5400)))
        assertEquals("Meeting starting now", ReminderMath.notificationTitle(start, start.minusSeconds(10)))
        assertEquals("Meeting started 3 minutes ago", ReminderMath.notificationTitle(start, start.plusSeconds(180)))
    }

    private fun reminder(remindAt: Instant, status: ReminderStatus = ReminderStatus.SCHEDULED) = ReminderEntity(
        id = 1, eventId = "e", accountId = "a", title = "t",
        startUtcMillis = start.toEpochMilli(), endUtcMillis = start.plusSeconds(1800).toEpochMilli(),
        remindAtUtcMillis = remindAt.toEpochMilli(), offsetMinutes = 15, joinUrl = null, status = status,
        createdAtUtcMillis = 0, updatedAtUtcMillis = 0,
    )

    @Test fun alarmActions() {
        val r = reminder(start.minusSeconds(900))
        assertEquals(AlarmAction.SCHEDULE, ReminderMath.alarmAction(r, start.minusSeconds(3600)))
        // Phone was off at the reminder time; meeting not started yet: fire now.
        assertEquals(AlarmAction.FIRE_NOW, ReminderMath.alarmAction(r, start.minusSeconds(60)))
        // Meeting started 5 minutes ago: still useful (join button).
        assertEquals(AlarmAction.FIRE_NOW, ReminderMath.alarmAction(r, start.plusSeconds(300)))
        // Meeting started 20 minutes ago: missed.
        assertEquals(AlarmAction.MARK_MISSED, ReminderMath.alarmAction(r, start.plusSeconds(1200)))
        assertEquals(AlarmAction.NONE, ReminderMath.alarmAction(reminder(start, ReminderStatus.FIRED), start.minusSeconds(3600)))
    }
}
