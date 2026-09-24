package com.brianwelch.meetingreminder.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.data.ReminderStatus
import com.brianwelch.meetingreminder.model.Meeting
import com.brianwelch.meetingreminder.reminders.ReminderMath
import com.brianwelch.meetingreminder.time.TimeText
import java.net.URI
import java.time.Instant

fun ReminderEntity.toMeeting() = Meeting(
    id = eventId,
    title = title,
    start = Instant.ofEpochMilli(startUtcMillis),
    end = Instant.ofEpochMilli(endUtcMillis),
    joinUrl = joinUrl,
    isCancelled = status == ReminderStatus.MEETING_CANCELLED,
)

/** "Join in Teams", "Join in Zoom"... from the link's host. */
fun joinLabel(url: String): String {
    val host = runCatching { URI(url).host?.lowercase() }.getOrNull().orEmpty()
    return when {
        "teams." in host -> "Join in Teams"
        "zoom" in host -> "Join in Zoom"
        "webex" in host -> "Join in Webex"
        "meet.google" in host -> "Join in Google Meet"
        else -> "Join meeting"
    }
}

/** "Thu, Sep 25 · 10:00 AM – 10:30 AM EDT" in the phone's current zone. */
fun meetingWhen(m: Meeting, clock: Clock, use24h: Boolean, withDay: Boolean = true): String {
    val range = TimeText.range(m.start, m.end, clock.zone, use24h)
    val zone = TimeText.zoneAbbreviation(clock.zone, m.start)
    val day = if (withDay) TimeText.dayLabel(m.start, clock.zone, clock.now) + " · " else ""
    return "$day$range $zone"
}

/** Short description of a reminder's state for cards and the sheet. */
fun reminderSummary(r: ReminderEntity, clock: Clock, use24h: Boolean): String {
    val at = Instant.ofEpochMilli(r.remindAtUtcMillis)
    val whenText = TimeText.time(at, clock.zone, use24h).let { t ->
        val day = TimeText.dayLabel(at, clock.zone, clock.now)
        if (day == "Today") t else "$day $t"
    }
    val start = Instant.ofEpochMilli(r.startUtcMillis)
    val lead = ReminderMath.offsetLabel(r.offsetMinutes ?: ReminderMath.offsetOf(start, at))
    return when (r.status) {
        ReminderStatus.SCHEDULED -> "Reminder at $whenText · $lead"
        ReminderStatus.FIRED -> "Reminder sent at $whenText"
        ReminderStatus.MEETING_CANCELLED -> "Meeting cancelled · reminder turned off"
        ReminderStatus.MISSED -> "Missed (phone was off at $whenText)"
    }
}

@Composable
fun SectionHeader(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 6.dp),
    )
}

@Composable
fun MeetingCard(
    meeting: Meeting,
    reminder: ReminderEntity?,
    clock: Clock,
    use24h: Boolean,
    extraZones: List<String>,
    onClick: () -> Unit,
) {
    val inProgress = !meeting.start.isAfter(clock.now)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    meeting.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (reminder?.status == ReminderStatus.SCHEDULED) {
                    Spacer(Modifier.width(8.dp))
                    Icon(
                        Icons.Filled.Notifications,
                        contentDescription = "Reminder set",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
            Text(
                meetingWhen(meeting, clock, use24h, withDay = false),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TimeText.extraZonesLine(meeting.start, clock.zone, extraZones, use24h)?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            val tags = buildList {
                if (inProgress) add("In progress")
                if (meeting.isDeclined) add("Declined")
                if (reminder?.status == ReminderStatus.SCHEDULED) add(reminderSummary(reminder, clock, use24h))
            }
            if (tags.isNotEmpty()) {
                Text(
                    tags.joinToString(" · "),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
fun Banner(
    text: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    onDismiss: (() -> Unit)? = null,
    warning: Boolean = true,
) {
    val container = if (warning) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.secondaryContainer
    val content = if (warning) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSecondaryContainer
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = container, contentColor = content),
    ) {
        Row(
            Modifier.padding(start = 16.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (warning) Icon(Icons.Filled.Warning, contentDescription = null, modifier = Modifier.size(18.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            if (actionLabel != null && onAction != null) {
                TextButton(onClick = onAction) { Text(actionLabel, color = content, fontWeight = FontWeight.Bold) }
            }
            if (onDismiss != null) {
                TextButton(onClick = onDismiss) { Text("Dismiss", color = content) }
            }
        }
    }
}

@Composable
fun StatusLine(ok: Boolean, text: String, okColor: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(if (ok) "✓" else "!", color = if (ok) okColor else MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}
