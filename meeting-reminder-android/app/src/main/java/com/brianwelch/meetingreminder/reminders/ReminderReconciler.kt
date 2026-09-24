package com.brianwelch.meetingreminder.reminders

import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.data.ReminderStatus
import com.brianwelch.meetingreminder.model.EventLookup
import java.time.Duration
import java.time.Instant

/**
 * Decides how a stored reminder should change given the latest Graph data for
 * its meeting. Pure and deterministic so it can run from the app today and from
 * a background sync worker later without changes.
 */
object ReminderReconciler {

    sealed interface Outcome {
        data object Unchanged : Outcome
        /** Save [reminder]; if [rearm] the alarm must be (re)scheduled from it. */
        data class Updated(val reminder: ReminderEntity, val rearm: Boolean) : Outcome
        /** Meeting is gone: save [reminder] (status MEETING_CANCELLED) and cancel its alarm. */
        data class Cancelled(val reminder: ReminderEntity) : Outcome
    }

    fun reconcile(r: ReminderEntity, lookup: EventLookup, now: Instant): Outcome {
        val nowMs = now.toEpochMilli()
        return when (lookup) {
            EventLookup.Unknown -> Outcome.Unchanged

            EventLookup.NotFound -> cancelled(r, nowMs)

            is EventLookup.Found -> {
                val m = lookup.meeting
                if (m.isCancelled) return cancelled(r, nowMs)

                val newStart = m.start.toEpochMilli()
                val newEnd = m.end.toEpochMilli()
                val moved = newStart != r.startUtcMillis
                val restored = r.status == ReminderStatus.MEETING_CANCELLED

                if (!moved && !restored) {
                    val metaChanged = m.title != r.title || m.joinUrl != r.joinUrl || newEnd != r.endUtcMillis
                    return if (metaChanged) {
                        Outcome.Updated(
                            r.copy(
                                title = m.title, joinUrl = m.joinUrl, endUtcMillis = newEnd,
                                updatedAtUtcMillis = nowMs, lastSyncedAtUtcMillis = nowMs,
                            ),
                            rearm = false,
                        )
                    } else Outcome.Unchanged
                }

                // Keep the user's intent: same lead time for a preset/offset reminder,
                // same shift as the meeting for a reminder pinned to a clock time.
                val newRemindAt = if (r.offsetMinutes != null) {
                    ReminderMath.remindAt(m.start, r.offsetMinutes).toEpochMilli()
                } else {
                    r.remindAtUtcMillis + (newStart - r.startUtcMillis)
                }

                // A reminder that already fired is re-armed only if the meeting moved
                // later and the new reminder time is still ahead.
                val shouldArm = when (r.status) {
                    ReminderStatus.SCHEDULED -> true
                    ReminderStatus.MEETING_CANCELLED -> true
                    ReminderStatus.FIRED, ReminderStatus.MISSED -> newRemindAt > nowMs
                }

                Outcome.Updated(
                    r.copy(
                        title = m.title,
                        joinUrl = m.joinUrl,
                        startUtcMillis = newStart,
                        endUtcMillis = newEnd,
                        remindAtUtcMillis = newRemindAt,
                        status = if (shouldArm) ReminderStatus.SCHEDULED else r.status,
                        previousStartUtcMillis = if (moved) r.startUtcMillis else r.previousStartUtcMillis,
                        updatedAtUtcMillis = nowMs,
                        lastSyncedAtUtcMillis = nowMs,
                    ),
                    rearm = shouldArm,
                )
            }
        }
    }

    private fun cancelled(r: ReminderEntity, nowMs: Long): Outcome =
        if (r.status == ReminderStatus.MEETING_CANCELLED) Outcome.Unchanged
        else Outcome.Cancelled(
            r.copy(status = ReminderStatus.MEETING_CANCELLED, updatedAtUtcMillis = nowMs, lastSyncedAtUtcMillis = nowMs),
        )

    /** Reminders whose meeting ended this long ago are removed during housekeeping. */
    val RETENTION: Duration = Duration.ofDays(7)
}
