package com.brianwelch.meetingreminder.reminders

import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.data.ReminderStatus
import com.brianwelch.meetingreminder.model.EventLookup
import com.brianwelch.meetingreminder.model.Meeting
import com.brianwelch.meetingreminder.reminders.ReminderReconciler.Outcome
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class ReminderReconcilerTest {

    private val start = Instant.parse("2026-09-25T14:00:00Z")
    private val end = start.plusSeconds(1800)
    private val now = Instant.parse("2026-09-25T10:00:00Z")

    private fun reminder(
        offset: Int? = 15,
        remindAt: Instant = start.minusSeconds(900),
        status: ReminderStatus = ReminderStatus.SCHEDULED,
    ) = ReminderEntity(
        id = 7, eventId = "evt", accountId = "acct", title = "Weekly",
        startUtcMillis = start.toEpochMilli(), endUtcMillis = end.toEpochMilli(),
        remindAtUtcMillis = remindAt.toEpochMilli(), offsetMinutes = offset,
        joinUrl = "https://zoom.us/j/1", status = status, createdAtUtcMillis = 0, updatedAtUtcMillis = 0,
    )

    private fun meeting(s: Instant = start, e: Instant = end, cancelled: Boolean = false, title: String = "Weekly") =
        Meeting(id = "evt", title = title, start = s, end = e, isCancelled = cancelled, joinUrl = "https://zoom.us/j/1")

    @Test fun unchangedMeetingIsNoOp() {
        assertEquals(Outcome.Unchanged, ReminderReconciler.reconcile(reminder(), EventLookup.Found(meeting()), now))
    }

    @Test fun unknownNeverChangesAnything() {
        assertEquals(Outcome.Unchanged, ReminderReconciler.reconcile(reminder(), EventLookup.Unknown, now))
    }

    @Test fun deletedMeetingCancelsReminder() {
        val o = ReminderReconciler.reconcile(reminder(), EventLookup.NotFound, now)
        assertTrue(o is Outcome.Cancelled)
        assertEquals(ReminderStatus.MEETING_CANCELLED, (o as Outcome.Cancelled).reminder.status)
    }

    @Test fun cancelledFlagCancelsReminderOnlyOnce() {
        val o = ReminderReconciler.reconcile(reminder(), EventLookup.Found(meeting(cancelled = true)), now)
        assertTrue(o is Outcome.Cancelled)
        val again = ReminderReconciler.reconcile((o as Outcome.Cancelled).reminder, EventLookup.NotFound, now)
        assertEquals(Outcome.Unchanged, again)
    }

    @Test fun movedMeetingKeepsOffset() {
        val newStart = start.plusSeconds(2 * 3600)
        val o = ReminderReconciler.reconcile(reminder(), EventLookup.Found(meeting(newStart, newStart.plusSeconds(1800))), now)
        o as Outcome.Updated
        assertTrue(o.rearm)
        assertEquals(newStart.minusSeconds(900).toEpochMilli(), o.reminder.remindAtUtcMillis)
        assertEquals(start.toEpochMilli(), o.reminder.previousStartUtcMillis)
        assertEquals(ReminderStatus.SCHEDULED, o.reminder.status)
    }

    @Test fun movedMeetingShiftsCustomClockTimeBySameDelta() {
        val custom = start.minusSeconds(3 * 3600) // 11:00Z for a 14:00Z meeting, no offset stored
        val newStart = start.plusSeconds(24 * 3600)
        val o = ReminderReconciler.reconcile(
            reminder(offset = null, remindAt = custom),
            EventLookup.Found(meeting(newStart, newStart.plusSeconds(1800))), now,
        ) as Outcome.Updated
        assertEquals(custom.plusSeconds(24 * 3600).toEpochMilli(), o.reminder.remindAtUtcMillis)
    }

    @Test fun titleChangeUpdatesWithoutRearm() {
        val o = ReminderReconciler.reconcile(reminder(), EventLookup.Found(meeting(title = "Weekly (moved room)")), now)
        o as Outcome.Updated
        assertFalse(o.rearm)
        assertEquals("Weekly (moved room)", o.reminder.title)
    }

    @Test fun firedReminderReArmsWhenMeetingPushedLater() {
        val later = start.plusSeconds(24 * 3600)
        val o = ReminderReconciler.reconcile(
            reminder(status = ReminderStatus.FIRED),
            EventLookup.Found(meeting(later, later.plusSeconds(1800))),
            start.plusSeconds(60),
        ) as Outcome.Updated
        assertTrue(o.rearm)
        assertEquals(ReminderStatus.SCHEDULED, o.reminder.status)
    }

    @Test fun firedReminderStaysFiredWhenMeetingPulledEarlier() {
        val earlier = start.minusSeconds(600)
        val o = ReminderReconciler.reconcile(
            reminder(status = ReminderStatus.FIRED),
            EventLookup.Found(meeting(earlier, end)),
            start.minusSeconds(300),
        ) as Outcome.Updated
        assertFalse(o.rearm)
        assertEquals(ReminderStatus.FIRED, o.reminder.status)
    }

    @Test fun restoredMeetingReArms() {
        val o = ReminderReconciler.reconcile(
            reminder(status = ReminderStatus.MEETING_CANCELLED), EventLookup.Found(meeting()), now,
        ) as Outcome.Updated
        assertTrue(o.rearm)
        assertEquals(ReminderStatus.SCHEDULED, o.reminder.status)
    }
}
