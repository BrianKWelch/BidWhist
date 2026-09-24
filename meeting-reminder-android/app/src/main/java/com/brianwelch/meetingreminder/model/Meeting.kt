package com.brianwelch.meetingreminder.model

import java.time.Instant

/**
 * One calendar event as read from Microsoft Graph. Held in memory only: the
 * app persists nothing from Graph except the few fields a reminder needs
 * (see ReminderEntity).
 */
data class Meeting(
    val id: String,
    val title: String,
    val start: Instant,
    val end: Instant,
    val isAllDay: Boolean = false,
    val isCancelled: Boolean = false,
    val joinUrl: String? = null,
    val location: String? = null,
    val organizer: String? = null,
    /** Graph responseStatus.response: "accepted", "declined", "organizer", ... */
    val response: String? = null,
) {
    val isDeclined: Boolean get() = response.equals("declined", ignoreCase = true)
}

/** Result of looking up one event by id. */
sealed interface EventLookup {
    data class Found(val meeting: Meeting) : EventLookup
    /** Graph answered 404: the event was deleted (or the id no longer resolves). */
    data object NotFound : EventLookup
    /** Network/auth/server problem: nothing is known, so nothing should change. */
    data object Unknown : EventLookup
}
