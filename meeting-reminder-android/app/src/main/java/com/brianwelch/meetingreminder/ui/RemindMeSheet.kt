package com.brianwelch.meetingreminder.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimeInput
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.data.ReminderStatus
import com.brianwelch.meetingreminder.model.Meeting
import com.brianwelch.meetingreminder.reminders.ReminderMath
import com.brianwelch.meetingreminder.time.TimeText
import com.brianwelch.meetingreminder.ui.theme.SuccessGreen
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalTime
import java.time.ZonedDateTime

/** Callback contract: invoke with null on success, or an error message. */
typealias ResultCallback = (String?) -> Unit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RemindMeSheet(
    meeting: Meeting,
    existing: ReminderEntity?,
    clock: Clock,
    use24h: Boolean,
    extraZones: List<String>,
    onPreset: (Int, ResultCallback) -> Unit,
    onCustom: (Instant, Int?, ResultCallback) -> Unit,
    onDelete: () -> Unit,
    onSet: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var confirmation by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCustom by remember { mutableStateOf(false) }
    val started = !meeting.start.isAfter(clock.now)
    val active = existing?.takeIf { it.status == ReminderStatus.SCHEDULED }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(bottom = 24.dp)
                .navigationBarsPadding(),
        ) {
            val done = confirmation
            if (done != null) {
                // "✓ Reminder set for 15 minutes before", then the sheet closes itself.
                LaunchedEffect(done) {
                    delay(1400)
                    onDismiss()
                }
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(56.dp))
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "✓ Reminder set for $done",
                        style = MaterialTheme.typography.titleLarge,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(meeting.title, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
                }
            } else {
                Text(meeting.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Text(
                    meetingWhen(meeting, clock, use24h),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TimeText.extraZonesLine(meeting.start, clock.zone, extraZones, use24h)?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (active != null) {
                    Text(
                        "Current: " + reminderSummary(active, clock, use24h),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }

                Spacer(Modifier.height(20.dp))

                if (started) {
                    Text("This meeting has already started.", style = MaterialTheme.typography.bodyLarge)
                } else {
                    Text("Remind me", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    ReminderMath.PRESETS.forEach { minutes ->
                        val available = ReminderMath.isAvailable(meeting.start, minutes, clock.now)
                        val at = ReminderMath.remindAt(meeting.start, minutes)
                        val label = ReminderMath.offsetLabel(minutes)
                        val trailing = if (available) TimeText.time(at, clock.zone, use24h) else "passed"
                        val click = {
                            error = null
                            onPreset(minutes) { err ->
                                if (err == null) {
                                    confirmation = label
                                    onSet()
                                } else error = err
                            }
                        }
                        val selected = active?.offsetMinutes == minutes
                        val rowContent: @Composable () -> Unit = {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(label)
                                Text(trailing)
                            }
                        }
                        if (selected) {
                            Button(onClick = click, enabled = available, modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) { rowContent() }
                        } else {
                            FilledTonalButton(onClick = click, enabled = available, modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) { rowContent() }
                        }
                    }
                    OutlinedButton(
                        onClick = { showCustom = true },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    ) { Text("Custom time") }
                }

                error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
                }

                if (existing != null) {
                    TextButton(onClick = { onDelete(); onDismiss() }, modifier = Modifier.padding(top = 8.dp)) {
                        Text("Remove reminder", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }

    if (showCustom) {
        CustomTimeDialog(
            meeting = meeting,
            clock = clock,
            use24h = use24h,
            onDismiss = { showCustom = false },
            onConfirm = { at, offset ->
                showCustom = false
                error = null
                onCustom(at, offset) { err ->
                    if (err == null) {
                        val lead = ReminderMath.offsetLabel(offset ?: ReminderMath.offsetOf(meeting.start, at))
                        confirmation = if (offset != null) lead else "${TimeText.time(at, clock.zone, use24h)} ($lead)"
                        onSet()
                    } else error = err
                }
            },
        )
    }
}

private enum class LeadUnit(val label: String, val minutes: Int) { MINUTES("minutes", 1), HOURS("hours", 60), DAYS("days", 1440) }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CustomTimeDialog(
    meeting: Meeting,
    clock: Clock,
    use24h: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (Instant, Int?) -> Unit,
) {
    var atClockTime by remember { mutableStateOf(false) }
    var amount by remember { mutableStateOf("20") }
    var unit by remember { mutableStateOf(LeadUnit.MINUTES) }
    val startLocal = meeting.start.atZone(clock.zone)
    val suggested = startLocal.minusMinutes(15)
    val timeState = rememberTimePickerState(suggested.hour, suggested.minute, is24Hour = use24h)

    val candidate: Pair<Instant, Int?>? = if (atClockTime) {
        // A clock time on the meeting's local date, in the phone's current zone.
        val at = ZonedDateTime.of(startLocal.toLocalDate(), LocalTime.of(timeState.hour, timeState.minute), clock.zone).toInstant()
        at to null
    } else {
        amount.trim().toIntOrNull()?.takeIf { it > 0 }?.let { n ->
            val minutes = n.toLong() * unit.minutes
            if (minutes > ReminderMath.MAX_OFFSET_MINUTES) null
            else ReminderMath.remindAt(meeting.start, minutes.toInt()) to minutes.toInt()
        }
    }
    val problem = candidate?.let { ReminderMath.validate(it.first, meeting.start, clock.now) }
    val valid = candidate != null && problem == null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Custom reminder") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = !atClockTime, onClick = { atClockTime = false }, label = { Text("Before meeting") })
                    FilterChip(selected = atClockTime, onClick = { atClockTime = true }, label = { Text("At a time") })
                }
                if (atClockTime) {
                    TimeInput(state = timeState)
                    Text(
                        "On " + TimeText.shortDate(startLocal.toLocalDate()),
                        style = MaterialTheme.typography.bodySmall,
                    )
                } else {
                    OutlinedTextField(
                        value = amount,
                        onValueChange = { v -> amount = v.filter { it.isDigit() }.take(4) },
                        label = { Text("How long before") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LeadUnit.entries.forEach { u ->
                            FilterChip(selected = unit == u, onClick = { unit = u }, label = { Text(u.label) })
                        }
                    }
                }
                val preview = when {
                    candidate == null -> "Enter a time up to 7 days before the meeting."
                    problem != null -> ReminderMath.problemText(problem)
                    else -> {
                        val at = candidate.first
                        val day = TimeText.dayLabel(at, clock.zone, clock.now)
                        "Reminder $day at ${TimeText.time(at, clock.zone, use24h)} " +
                            "(${ReminderMath.offsetLabel(ReminderMath.offsetOf(meeting.start, at))})"
                    }
                }
                Text(
                    preview,
                    color = if (valid) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        },
        confirmButton = {
            TextButton(enabled = valid, onClick = { candidate?.let { onConfirm(it.first, it.second) } }) { Text("Set reminder") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
