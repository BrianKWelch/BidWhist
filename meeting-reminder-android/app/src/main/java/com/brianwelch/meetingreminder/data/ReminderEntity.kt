package com.brianwelch.meetingreminder.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

enum class ReminderStatus {
    /** Alarm is armed (or will fire immediately if its time passed while the phone was off). */
    SCHEDULED,
    /** Notification was shown. */
    FIRED,
    /** Graph reports the meeting cancelled or deleted; alarm cancelled. */
    MEETING_CANCELLED,
    /** Reminder time passed while the phone was off and the meeting is already under way. */
    MISSED,
}

/**
 * One user-chosen reminder. Deliberately minimal: only what is needed to fire
 * the notification and to re-match the meeting on the next refresh.
 *
 * All instants are UTC epoch milliseconds, so reminders are immune to time
 * zone changes and DST. [offsetMinutes] is kept (rather than only the absolute
 * time) so a background sync can move the reminder when the meeting moves.
 */
@Entity(
    tableName = "reminders",
    indices = [Index(value = ["eventId"], unique = true)],
)
data class ReminderEntity(
    /** Row id, also the AlarmManager / notification request code. */
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** Microsoft Graph event id (ImmutableId format). One reminder per event. */
    val eventId: String,
    /** MSAL account id that owns the event; lets V2 hold several accounts. */
    val accountId: String,
    val title: String,
    val startUtcMillis: Long,
    val endUtcMillis: Long,
    val remindAtUtcMillis: Long,
    /** Minutes before start; null when the user picked a specific clock time. */
    val offsetMinutes: Int?,
    val joinUrl: String?,
    val status: ReminderStatus,
    /** Set when a refresh found the meeting at a new time; UI shows "was 10:00 AM". */
    val previousStartUtcMillis: Long? = null,
    val createdAtUtcMillis: Long,
    val updatedAtUtcMillis: Long,
    val lastSyncedAtUtcMillis: Long? = null,
)
