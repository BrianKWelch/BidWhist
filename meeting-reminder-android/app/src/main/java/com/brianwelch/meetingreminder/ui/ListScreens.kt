package com.brianwelch.meetingreminder.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.data.ReminderStatus
import com.brianwelch.meetingreminder.model.Meeting
import com.brianwelch.meetingreminder.time.DaySection
import com.brianwelch.meetingreminder.time.MeetingGrouping
import com.brianwelch.meetingreminder.time.TimeText
import java.time.Instant

@Composable
fun MeetingsScreen(
    meetings: List<Meeting>,
    reminders: List<ReminderEntity>,
    loading: Boolean,
    lastRefreshed: Instant?,
    clock: Clock,
    use24h: Boolean,
    extraZones: List<String>,
    onMeetingClick: (Meeting) -> Unit,
) {
    val grouped = MeetingGrouping.group(meetings, clock.now, clock.zone)
    val remindersByEvent = reminders.associateBy { it.eventId }

    if (grouped.isEmpty()) {
        Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            if (loading && lastRefreshed == null) {
                CircularProgressIndicator()
            } else {
                Text(
                    if (lastRefreshed == null) "Pull meetings with the refresh button." else "No meetings in the next 7 days.",
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        return
    }

    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        DaySection.entries.forEach { section ->
            val list = grouped[section].orEmpty()
            if (list.isEmpty()) return@forEach
            item(key = "h-${section.name}") { SectionHeader(section.title) }
            var lastDay: String? = null
            list.forEach { m ->
                // Upcoming spans several days: show a small day label when it changes.
                if (section == DaySection.UPCOMING) {
                    val day = TimeText.dayLabel(m.start, clock.zone, clock.now)
                    if (day != lastDay) {
                        lastDay = day
                        item(key = "d-$day") {
                            Text(
                                day,
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(start = 20.dp, top = 8.dp, bottom = 2.dp),
                            )
                        }
                    }
                }
                item(key = m.id) {
                    MeetingCard(m, remindersByEvent[m.id], clock, use24h, extraZones) { onMeetingClick(m) }
                }
            }
        }
        item(key = "footer") {
            val zoneName = clock.zone.id.substringAfterLast('/').replace('_', ' ')
            val refreshed = lastRefreshed?.let { "Updated ${TimeText.time(it, clock.zone, use24h)}" } ?: ""
            Text(
                "Times shown in $zoneName (${TimeText.zoneAbbreviation(clock.zone, clock.now)}). $refreshed",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth().padding(20.dp),
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
fun MyRemindersScreen(
    reminders: List<ReminderEntity>,
    clock: Clock,
    use24h: Boolean,
    onOpen: (ReminderEntity) -> Unit,
    onChange: (ReminderEntity) -> Unit,
    onDelete: (ReminderEntity) -> Unit,
) {
    if (reminders.isEmpty()) {
        Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            Text(
                "No reminders yet.\nTap a meeting on the Meetings tab to set one.",
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        return
    }
    val active = reminders.filter { it.status == ReminderStatus.SCHEDULED }.sortedBy { it.remindAtUtcMillis }
    val attention = reminders.filter { it.status == ReminderStatus.MEETING_CANCELLED || it.status == ReminderStatus.MISSED }
        .sortedBy { it.startUtcMillis }
    val past = reminders.filter { it.status == ReminderStatus.FIRED }.sortedByDescending { it.startUtcMillis }

    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        if (attention.isNotEmpty()) {
            item(key = "h-attention") { SectionHeader("NEEDS ATTENTION") }
            items(attention, key = { it.id }) { ReminderCard(it, clock, use24h, onOpen, onChange, onDelete) }
        }
        if (active.isNotEmpty()) {
            item(key = "h-active") { SectionHeader("SCHEDULED") }
            items(active, key = { it.id }) { ReminderCard(it, clock, use24h, onOpen, onChange, onDelete) }
        }
        if (past.isNotEmpty()) {
            item(key = "h-past") { SectionHeader("SENT") }
            items(past, key = { it.id }) { ReminderCard(it, clock, use24h, onOpen, onChange, onDelete) }
        }
    }
}

@Composable
private fun ReminderCard(
    r: ReminderEntity,
    clock: Clock,
    use24h: Boolean,
    onOpen: (ReminderEntity) -> Unit,
    onChange: (ReminderEntity) -> Unit,
    onDelete: (ReminderEntity) -> Unit,
) {
    val meeting = r.toMeeting()
    val canChange = meeting.start.isAfter(clock.now) && r.status != ReminderStatus.MEETING_CANCELLED
    val warn = r.status == ReminderStatus.MEETING_CANCELLED || r.status == ReminderStatus.MISSED
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable { onOpen(r) },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(Modifier.padding(start = 16.dp, end = 8.dp, top = 12.dp, bottom = 4.dp)) {
            Text(r.title, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(
                meetingWhen(meeting, clock, use24h),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                reminderSummary(r, clock, use24h),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = if (warn) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 4.dp),
            )
            r.previousStartUtcMillis?.let { prev ->
                if (r.status != ReminderStatus.MEETING_CANCELLED) {
                    val was = Instant.ofEpochMilli(prev)
                    Text(
                        "Meeting time changed (was ${TimeText.dayLabel(was, clock.zone, clock.now)} " +
                            "${TimeText.time(was, clock.zone, use24h)}). Reminder moved with it.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.tertiary,
                    )
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                if (canChange) TextButton(onClick = { onChange(r) }) { Text("Change") }
                TextButton(onClick = { onDelete(r) }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            }
        }
    }
}

@Composable
fun CenteredMessage(title: String, body: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
            Text(body, textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (action != null && onAction != null) OutlinedButton(onClick = onAction) { Text(action) }
        }
    }
}
