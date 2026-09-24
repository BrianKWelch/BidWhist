package com.brianwelch.meetingreminder.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.brianwelch.meetingreminder.auth.AuthConfig
import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.data.ReminderStatus
import com.brianwelch.meetingreminder.model.Meeting
import com.brianwelch.meetingreminder.reminders.JoinMeetingActivity
import com.brianwelch.meetingreminder.time.TimeText

@Composable
fun MeetingDetailContent(
    meeting: Meeting?,
    reminder: ReminderEntity?,
    clock: Clock,
    use24h: Boolean,
    extraZones: List<String>,
    onSetReminder: (Meeting) -> Unit,
    onDelete: (String) -> Unit,
) {
    if (meeting == null) {
        CenteredMessage("Meeting not found", "It may have been removed from your calendar, or the reminder was deleted.")
        return
    }
    val context = LocalContext.current
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(meeting.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
        Text(meetingWhen(meeting, clock, use24h), style = MaterialTheme.typography.titleMedium)
        TimeText.extraZonesLine(meeting.start, clock.zone, extraZones, use24h)?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (meeting.isCancelled) {
            Text("This meeting was cancelled.", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
        }
        meeting.location?.let { Text("Location: $it", style = MaterialTheme.typography.bodyMedium) }
        meeting.organizer?.let { Text("Organizer: $it", style = MaterialTheme.typography.bodyMedium) }

        val url = meeting.joinUrl
        if (url != null) {
            Button(onClick = { JoinMeetingActivity.openMeetingLink(context, url) }, modifier = Modifier.fillMaxWidth()) {
                Text(joinLabel(url))
            }
        } else {
            Text(
                "No Teams or Zoom link in this invite.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        HorizontalDivider(Modifier.padding(vertical = 8.dp))
        Text("Reminder", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        if (reminder != null) {
            Text(reminderSummary(reminder, clock, use24h), color = MaterialTheme.colorScheme.primary)
        } else {
            Text("No reminder set.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val canSet = meeting.start.isAfter(clock.now) && !meeting.isCancelled
        if (canSet) {
            OutlinedButton(onClick = { onSetReminder(meeting) }, modifier = Modifier.fillMaxWidth()) {
                Text(if (reminder?.status == ReminderStatus.SCHEDULED) "Change reminder" else "Set reminder")
            }
        }
        if (reminder != null) {
            TextButton(onClick = { onDelete(reminder.eventId) }) {
                Text("Delete reminder", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

/** First run: enter the Entra app registration values. Also reused inside Settings. */
@Composable
fun ConnectionForm(
    initialClientId: String,
    initialTenantId: String,
    redirectUri: String,
    signatureHash: String,
    saveLabel: String,
    onSave: (String, String) -> Unit,
) {
    var clientId by rememberSaveable { mutableStateOf(initialClientId) }
    var tenantId by rememberSaveable { mutableStateOf(initialTenantId) }
    val clipboard = LocalClipboardManager.current
    val clientOk = AuthConfig.isValidClientId(clientId)
    val tenantOk = AuthConfig.isValidTenant(tenantId)

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(
            value = clientId,
            onValueChange = { clientId = it.trim() },
            label = { Text("Application (client) ID") },
            placeholder = { Text("00000000-0000-0000-0000-000000000000") },
            singleLine = true,
            isError = clientId.isNotEmpty() && !clientOk,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = tenantId,
            onValueChange = { tenantId = it.trim() },
            label = { Text("Directory (tenant) ID") },
            supportingText = { Text("Recommended. Leave blank only if the app registration is multitenant.") },
            singleLine = true,
            isError = !tenantOk,
            modifier = Modifier.fillMaxWidth(),
        )
        Text("Redirect URI to register in Entra (Android platform):", style = MaterialTheme.typography.labelLarge)
        SelectionContainer {
            Text(redirectUri, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
        }
        Text("Package name: com.brianwelch.meetingreminder", style = MaterialTheme.typography.bodySmall)
        SelectionContainer {
            Text("Signature hash: $signatureHash", fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
        }
        OutlinedButton(onClick = { clipboard.setText(AnnotatedString(redirectUri)) }) { Text("Copy redirect URI") }
        Button(
            onClick = { onSave(clientId, tenantId) },
            enabled = clientOk && tenantOk,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(saveLabel) }
    }
}

@Composable
fun SetupScreen(vm: MainViewModel, initialClientId: String, initialTenantId: String) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 560.dp)) {
            Text("Meeting Reminder", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(
                "One-time setup. Register the app in Microsoft Entra (see README), then enter its IDs here. " +
                    "The app only reads your calendar; it never changes meetings or notifies attendees.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(20.dp))
            ConnectionForm(
                initialClientId, initialTenantId, vm.redirectUri, vm.signatureHash,
                saveLabel = "Save and continue",
                onSave = { c, t -> vm.saveSetup(c, t) },
            )
        }
    }
}

@Composable
fun SignInScreen(signingIn: Boolean, error: String?, onSignIn: () -> Unit, onSettings: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Meeting Reminder", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(
            "Sign in with your work account to see upcoming meetings. Read-only access (Calendars.Read).",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
        if (signingIn) {
            CircularProgressIndicator()
        } else {
            Button(onClick = onSignIn, modifier = Modifier.widthIn(min = 240.dp)) { Text("Sign in with Microsoft") }
        }
        error?.let {
            Spacer(Modifier.height(16.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(24.dp))
        TextButton(onClick = onSettings) { Text("Settings") }
    }
}
