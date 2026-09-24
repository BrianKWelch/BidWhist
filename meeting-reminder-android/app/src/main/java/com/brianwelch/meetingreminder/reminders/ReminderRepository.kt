package com.brianwelch.meetingreminder.reminders

import com.brianwelch.meetingreminder.data.ReminderDao
import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.data.ReminderStatus
import com.brianwelch.meetingreminder.model.EventLookup
import com.brianwelch.meetingreminder.model.Meeting
import com.brianwelch.meetingreminder.reminders.ReminderMath.AlarmAction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant

/**
 * The single place that changes reminders. Every mutation keeps the database
 * and AlarmManager in step, under one lock, so an alarm firing while the app
 * refreshes cannot double-notify or resurrect a deleted reminder.
 */
class ReminderRepository(
    private val dao: ReminderDao,
    private val scheduler: ReminderScheduler,
    private val notifier: ReminderNotifier,
    private val clock: () -> Instant = Instant::now,
) {
    private val lock = Mutex()

    val reminders: Flow<List<ReminderEntity>> = dao.observeAll()

    suspend fun byEventId(eventId: String): ReminderEntity? = dao.byEventId(eventId)

    /**
     * Creates or replaces the reminder for [meeting]. There is at most one
     * reminder per meeting, so picking a new time simply moves it.
     */
    suspend fun set(meeting: Meeting, remindAt: Instant, offsetMinutes: Int?, accountId: String): ReminderEntity =
        lock.withLock {
            val now = clock()
            ReminderMath.validate(remindAt, meeting.start, now)?.let {
                throw IllegalArgumentException(ReminderMath.problemText(it))
            }
            val existing = dao.byEventId(meeting.id)
            val row = ReminderEntity(
                id = existing?.id ?: 0,
                eventId = meeting.id,
                accountId = accountId,
                title = meeting.title,
                startUtcMillis = meeting.start.toEpochMilli(),
                endUtcMillis = meeting.end.toEpochMilli(),
                remindAtUtcMillis = remindAt.toEpochMilli(),
                offsetMinutes = offsetMinutes,
                joinUrl = meeting.joinUrl,
                status = ReminderStatus.SCHEDULED,
                previousStartUtcMillis = null,
                createdAtUtcMillis = existing?.createdAtUtcMillis ?: now.toEpochMilli(),
                updatedAtUtcMillis = now.toEpochMilli(),
                lastSyncedAtUtcMillis = now.toEpochMilli(),
            )
            val saved = if (existing == null) row.copy(id = dao.insert(row)) else row.also { dao.update(it) }
            notifier.cancel(saved.id)
            applyAlarm(saved, now)
        }

    suspend fun delete(eventId: String) {
        lock.withLock {
            val r = dao.byEventId(eventId) ?: return
            scheduler.cancel(r.id)
            notifier.cancel(r.id)
            dao.delete(r.id)
        }
    }

    /** Called when an alarm is delivered. */
    suspend fun onAlarm(reminderId: Long) {
        lock.withLock {
            val r = dao.byId(reminderId) ?: return
            if (r.status != ReminderStatus.SCHEDULED) return
            val now = clock()
            // An alarm armed for an older time (the reminder was changed since) is re-armed, not shown.
            if (r.remindAtUtcMillis - now.toEpochMilli() > ReminderMath.FIRE_TOLERANCE.toMillis()) {
                scheduler.schedule(r.id, r.remindAtUtcMillis)
            } else {
                fire(r, now)
            }
        }
    }

    /**
     * Re-arms every alarm from the database. Safe to call any number of times:
     * after boot, app update, clock/zone change and every app start.
     */
    suspend fun rearmAll() {
        lock.withLock {
            val now = clock()
            dao.all().forEach { applyAlarm(it, now) }
        }
    }

    /**
     * Brings stored reminders in line with Microsoft 365. [windowMeetings] is the
     * list just fetched; anything not in it is looked up by id so a meeting moved
     * far into the future is not mistaken for a deleted one.
     */
    suspend fun sync(windowMeetings: List<Meeting>, lookup: suspend (String) -> EventLookup) {
        val byId = windowMeetings.associateBy { it.id }
        val now = clock()
        val candidates = lock.withLock { dao.all() }

        for (r in candidates) {
            if (now.toEpochMilli() - r.endUtcMillis > ReminderReconciler.RETENTION.toMillis()) {
                delete(r.eventId)
                continue
            }
            // Past meetings whose reminder is done: nothing useful to learn from Graph.
            if (r.endUtcMillis < now.toEpochMilli() && r.status != ReminderStatus.SCHEDULED) continue

            val result = byId[r.eventId]?.let { EventLookup.Found(it) } ?: lookup(r.eventId)

            lock.withLock {
                // Re-read under the lock: the user may have changed or deleted it meanwhile.
                val current = dao.byId(r.id) ?: return@withLock
                when (val outcome = ReminderReconciler.reconcile(current, result, clock())) {
                    ReminderReconciler.Outcome.Unchanged -> Unit
                    is ReminderReconciler.Outcome.Updated -> {
                        dao.update(outcome.reminder)
                        if (outcome.rearm) applyAlarm(outcome.reminder, clock())
                    }
                    is ReminderReconciler.Outcome.Cancelled -> {
                        scheduler.cancel(current.id)
                        dao.update(outcome.reminder)
                    }
                }
            }
        }
    }

    /** Must be called with [lock] held. Returns the row as stored afterwards. */
    private suspend fun applyAlarm(r: ReminderEntity, now: Instant): ReminderEntity =
        when (ReminderMath.alarmAction(r, now)) {
            AlarmAction.SCHEDULE -> r.also { scheduler.schedule(it.id, it.remindAtUtcMillis) }
            AlarmAction.FIRE_NOW -> fire(r, now)
            AlarmAction.MARK_MISSED -> {
                scheduler.cancel(r.id)
                r.copy(status = ReminderStatus.MISSED, updatedAtUtcMillis = now.toEpochMilli()).also { dao.update(it) }
            }
            AlarmAction.NONE -> r.also { scheduler.cancel(it.id) }
        }

    private suspend fun fire(r: ReminderEntity, now: Instant): ReminderEntity {
        notifier.show(r, now)
        scheduler.cancel(r.id)
        return r.copy(status = ReminderStatus.FIRED, updatedAtUtcMillis = now.toEpochMilli()).also { dao.update(it) }
    }
}
