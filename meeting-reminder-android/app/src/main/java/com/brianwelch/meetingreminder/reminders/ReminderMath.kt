package com.brianwelch.meetingreminder.reminders

import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.data.ReminderStatus
import java.time.Duration
import java.time.Instant

/** Pure reminder arithmetic. Always Instant minus Duration; never wall-clock maths. */
object ReminderMath {

    val PRESETS: List<Int> = listOf(5, 10, 15, 30, 60)

    /**
     * A reminder whose time passed while the phone was off still fires if the
     * meeting started no more than this long ago; later than that it is marked missed.
     */
    val LATE_FIRE_GRACE: Duration = Duration.ofMinutes(10)

    /** Alarms may be delivered a little early or late; within this window the alarm is "on time". */
    val FIRE_TOLERANCE: Duration = Duration.ofMinutes(1)

    const val MAX_OFFSET_MINUTES = 7 * 24 * 60

    fun remindAt(start: Instant, offsetMinutes: Int): Instant =
        start.minus(Duration.ofMinutes(offsetMinutes.toLong()))

    /** A preset can be chosen only while its reminder time is still in the future. */
    fun isAvailable(start: Instant, offsetMinutes: Int, now: Instant): Boolean =
        remindAt(start, offsetMinutes).isAfter(now)

    enum class Problem { IN_PAST, AFTER_START, TOO_EARLY, MEETING_STARTED }

    /** Null means the time is acceptable. */
    fun validate(remindAt: Instant, start: Instant, now: Instant): Problem? = when {
        !start.isAfter(now) -> Problem.MEETING_STARTED
        remindAt.isAfter(start) -> Problem.AFTER_START
        !remindAt.isAfter(now) -> Problem.IN_PAST
        Duration.between(remindAt, start).toMinutes() > MAX_OFFSET_MINUTES -> Problem.TOO_EARLY
        else -> null
    }

    fun problemText(p: Problem): String = when (p) {
        Problem.MEETING_STARTED -> "This meeting has already started."
        Problem.AFTER_START -> "Pick a time before the meeting starts."
        Problem.IN_PAST -> "That time has already passed."
        Problem.TOO_EARLY -> "Reminders can be at most 7 days before the meeting."
    }

    /** "5 minutes before", "1 hour before", "1 hour 30 minutes before", "2 days before". */
    fun offsetLabel(offsetMinutes: Int): String {
        if (offsetMinutes == 0) return "At start time"
        val days = offsetMinutes / (24 * 60)
        val hours = (offsetMinutes % (24 * 60)) / 60
        val minutes = offsetMinutes % 60
        val parts = buildList {
            if (days > 0) add(plural(days, "day"))
            if (hours > 0) add(plural(hours, "hour"))
            if (minutes > 0) add(plural(minutes, "minute"))
        }
        return parts.joinToString(" ") + " before"
    }

    fun offsetOf(start: Instant, remindAt: Instant): Int =
        Duration.between(remindAt, start).toMinutes().toInt()

    /** Text for the notification title, computed when it fires (handles late delivery). */
    fun notificationTitle(start: Instant, now: Instant): String {
        val seconds = Duration.between(now, start).seconds
        val minutes = Math.floorDiv(seconds + 30, 60) // nearest minute
        return when {
            minutes >= 60 && minutes % 60 == 0L -> "Meeting in ${plural((minutes / 60).toInt(), "hour")}"
            minutes >= 60 -> "Meeting in ${plural((minutes / 60).toInt(), "hour")} ${plural((minutes % 60).toInt(), "minute")}"
            minutes >= 1 -> "Meeting in ${plural(minutes.toInt(), "minute")}"
            minutes > -1 -> "Meeting starting now"
            else -> "Meeting started ${plural((-minutes).toInt(), "minute")} ago"
        }
    }

    enum class AlarmAction { SCHEDULE, FIRE_NOW, MARK_MISSED, NONE }

    /** What the scheduler should do with a stored reminder right now. */
    fun alarmAction(r: ReminderEntity, now: Instant): AlarmAction {
        if (r.status != ReminderStatus.SCHEDULED) return AlarmAction.NONE
        val remindAt = Instant.ofEpochMilli(r.remindAtUtcMillis)
        if (remindAt.isAfter(now)) return AlarmAction.SCHEDULE
        val start = Instant.ofEpochMilli(r.startUtcMillis)
        return if (now.isBefore(start.plus(LATE_FIRE_GRACE))) AlarmAction.FIRE_NOW else AlarmAction.MARK_MISSED
    }

    private fun plural(n: Int, unit: String) = if (n == 1) "1 $unit" else "$n ${unit}s"
}
