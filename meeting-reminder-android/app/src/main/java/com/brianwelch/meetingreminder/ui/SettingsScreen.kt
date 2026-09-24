package com.brianwelch.meetingreminder.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.brianwelch.meetingreminder.BuildConfig
import com.brianwelch.meetingreminder.data.AppSettings
import com.brianwelch.meetingreminder.time.TimeText
import com.brianwelch.meetingreminder.ui.theme.SuccessGreen

@Composable
fun SettingsContent(
    vm: MainViewModel,
    settings: AppSettings,
    session: Session,
    reliability: Reliability,
    clock: Clock,
    onRequestNotifications: () -> Unit,
    onSignIn: () -> Unit,
) {
    val context = LocalContext.current
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Account
        SettingsHeader("Microsoft 365 account")
        when (session) {
            is Session.SignedIn -> {
                Text("Signed in as ${session.username}")
                if (session.needsReauth) {
                    Text("Session expired. Reminders you already set will still fire.", color = MaterialTheme.colorScheme.error)
                    OutlinedButton(onClick = onSignIn) { Text("Sign in again") }
                }
                TextButton(onClick = { vm.signOut() }) { Text("Sign out") }
            }
            else -> OutlinedButton(onClick = onSignIn) { Text("Sign in with Microsoft") }
        }

        HorizontalDivider()

        // Reliability
        SettingsHeader("Reminder reliability")
        StatusLine(reliability.notifications, if (reliability.notifications) "Notifications allowed" else "Notifications are blocked", SuccessGreen)
        if (!reliability.notifications) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onRequestNotifications) { Text("Allow") }
                TextButton(onClick = { SystemSettings.notifications(context) }) { Text("Open settings") }
            }
        }
        StatusLine(reliability.exactAlarms, if (reliability.exactAlarms) "Exact alarms allowed" else "Exact alarms off: reminders may be late", SuccessGreen)
        if (!reliability.exactAlarms) {
            OutlinedButton(onClick = { SystemSettings.exactAlarms(context) }) { Text("Allow exact alarms") }
        }
        StatusLine(
            reliability.batteryUnrestricted,
            if (reliability.batteryUnrestricted) "Battery: unrestricted" else "Battery optimized: Samsung may put the app to sleep",
            SuccessGreen,
        )
        if (!reliability.batteryUnrestricted) {
            OutlinedButton(onClick = { SystemSettings.unrestrictedBattery(context) }) { Text("Allow unrestricted battery") }
        }
        Text(
            "Samsung Galaxy: also open App info > Battery and choose Unrestricted, and make sure Meeting Reminder is " +
                "not listed under Settings > Battery > Background usage limits > Sleeping apps / Deep sleeping apps.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { SystemSettings.appDetails(context) }) { Text("App info") }
            OutlinedButton(onClick = { vm.sendTestNotification() }) { Text("Test in 10 s") }
        }

        HorizontalDivider()

        // Time zones
        SettingsHeader("Time zones")
        Text(
            "Times always follow the phone's current zone: ${clock.zone.id} (${TimeText.zoneAbbreviation(clock.zone, clock.now)}). " +
                "Also show:",
            style = MaterialTheme.typography.bodyMedium,
        )
        TimeText.EXTRA_ZONES.forEach { (id, label) ->
            val checked = id in settings.extraZones
            Row(
                Modifier.fillMaxWidth().clickable {
                    vm.setExtraZones(if (checked) settings.extraZones - id else settings.extraZones + id)
                },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(checked = checked, onCheckedChange = null)
                Text(label, modifier = Modifier.padding(start = 8.dp))
            }
        }

        HorizontalDivider()

        // Connection
        SettingsHeader("Microsoft Entra app registration")
        ConnectionForm(
            settings.clientId, settings.tenantId, vm.redirectUri, vm.signatureHash,
            saveLabel = "Save",
            onSave = { c, t -> vm.saveSetup(c, t) },
        )

        HorizontalDivider()

        SettingsHeader("Privacy")
        Text(
            "Permission requested: Calendars.Read only. The app sends GET requests to Microsoft Graph and nothing else, " +
                "so it cannot change, cancel or respond to meetings, alter Outlook reminders, or notify attendees. " +
                "Stored on this phone: event ID, title, start/end, reminder time and join link for meetings you chose. " +
                "Sign-in tokens are held in Microsoft's MSAL cache, encrypted by Android Keystore.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text("Version ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun SettingsHeader(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(top = 8.dp),
    )
}
