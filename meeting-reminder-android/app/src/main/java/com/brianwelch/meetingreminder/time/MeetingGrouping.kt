package com.brianwelch.meetingreminder.time

import com.brianwelch.meetingreminder.model.Meeting
import java.time.Instant
import java.time.ZoneId

enum class DaySection(val title: String) { TODAY("TODAY"), TOMORROW("TOMORROW"), UPCOMING("UPCOMING") }

object MeetingGrouping {

    /**
     * Buckets meetings by the phone's current local day. Hidden: all-day items,
     * cancelled meetings, and meetings that have already ended. A meeting still
     * in progress that began before local midnight counts as today.
     */
    fun group(meetings: List<Meeting>, now: Instant, zone: ZoneId): Map<DaySection, List<Meeting>> {
        val today = now.atZone(zone).toLocalDate()
        val tomorrow = today.plusDays(1)
        return meetings
            .asSequence()
            .filter { !it.isAllDay && !it.isCancelled && it.end.isAfter(now) }
            .distinctBy { it.id }
            .sortedWith(compareBy<Meeting>({ it.start }, { it.end }, { it.title }))
            .groupBy {
                val date = it.start.atZone(zone).toLocalDate()
                when {
                    !date.isAfter(today) -> DaySection.TODAY
                    date == tomorrow -> DaySection.TOMORROW
                    else -> DaySection.UPCOMING
                }
            }
            .toSortedMap(compareBy { it.ordinal })
    }
}
