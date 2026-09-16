package com.brianwelch.smsvault.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.brianwelch.smsvault.notify.AssistantState
import com.brianwelch.smsvault.notify.SuppressionLog
import com.brianwelch.smsvault.util.PermissionState
import kotlinx.coroutines.delay
import java.text.DateFormat
import java.util.Date

/**
 * Suppression diagnostics: shows whether notification access is granted, whether
 * the listener is connected, and a live log of the messaging notifications it saw
 * and whether it cancelled each. This is how we tell, remotely, why a banner is
 * or is not being dismissed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiagnosticScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (true) { delay(1500); tick++ }
    }

    // Re-read the (non-observable) status each tick.
    val accessOn = remember(tick) { PermissionState.notificationAccessGranted(context) }
    val connected = remember(tick) { SuppressionLog.listenerConnected }
    val contactsOn = remember(tick) {
        androidx.core.content.ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.READ_CONTACTS
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }
    val assistantOn = remember(tick) { AssistantState.connected }
    val entries = remember(tick) { SuppressionLog.snapshot() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Suppression status") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } }
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    StatusLine("Notification access granted", accessOn)
                    StatusLine("Listener connected", connected)
                    StatusLine("Contacts access granted", contactsOn)
                    StatusLine("Notification assistant connected", assistantOn)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "The listener clears the banner from the tray, but Android still shows " +
                            "the pop-up peek for a few seconds first. To stop the peek entirely, " +
                            "turn on the Notification assistant below. If your phone won't let a " +
                            "third-party assistant turn on, tell me.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(Modifier.height(6.dp))
                    TextButton(onClick = { openNotificationSettings(context) }) {
                        Text("Open notification settings")
                    }
                }
            }

            Spacer(Modifier.height(14.dp))
            Row(Modifier.fillMaxWidth()) {
                Text("Recent messaging notifications", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                TextButton(onClick = { copyLog(context, entries) }) { Text("Copy") }
                TextButton(onClick = { shareLog(context, entries) }) { Text("Share") }
                TextButton(onClick = { SuppressionLog.clear(); tick++ }) { Text("Clear") }
            }
            Spacer(Modifier.height(4.dp))

            if (entries.isEmpty()) {
                Text(
                    "None seen yet. Send a text from a watched number, then come back.",
                    style = MaterialTheme.typography.bodyMedium
                )
            } else {
                LazyColumn {
                    items(entries) { e ->
                        Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                            Row(Modifier.fillMaxWidth()) {
                                Text(
                                    if (e.cancelled) "DISMISSED" else "left alone",
                                    color = if (e.cancelled) Color(0xFF2E7D32) else Color(0xFFB3261E),
                                    style = MaterialTheme.typography.labelMedium,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    DateFormat.getTimeInstance(DateFormat.MEDIUM).format(Date(e.ts)),
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                            Text(e.pkg, style = MaterialTheme.typography.bodySmall)
                            Text("title: ${e.title.ifBlank { "(none)" }}", style = MaterialTheme.typography.bodySmall)
                            if (e.detail.isNotBlank()) {
                                Text(e.detail, style = MaterialTheme.typography.labelSmall, color = Color(0xFF555555))
                            }
                        }
                        Divider()
                    }
                }
            }
        }
    }
}

private fun dumpLog(entries: List<SuppressionLog.Entry>): String {
    if (entries.isEmpty()) return "SMS Vault log: (empty)"
    val fmt = DateFormat.getTimeInstance(DateFormat.MEDIUM)
    return buildString {
        append("SMS Vault suppression log\n")
        entries.forEach { e ->
            append(fmt.format(Date(e.ts)))
            append("  ").append(if (e.cancelled) "DISMISSED" else "left alone")
            append("  ").append(e.pkg)
            append("  title=").append(e.title.ifBlank { "(none)" })
            if (e.detail.isNotBlank()) append("  | ").append(e.detail)
            append("\n")
        }
    }
}

private fun openNotificationSettings(context: Context) {
    // No public intent opens the assistant picker directly, so open the phone's
    // notification settings; the assistant lives under Advanced settings there.
    val intent = Intent("android.settings.NOTIFICATION_SETTINGS")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(intent) }.onFailure {
        runCatching {
            context.startActivity(
                Intent(android.provider.Settings.ACTION_SETTINGS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }
    }
}

private fun copyLog(context: Context, entries: List<SuppressionLog.Entry>) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    cm.setPrimaryClip(ClipData.newPlainText("SMS Vault log", dumpLog(entries)))
    Toast.makeText(context, "Log copied. Paste it into your chat.", Toast.LENGTH_SHORT).show()
}

private fun shareLog(context: Context, entries: List<SuppressionLog.Entry>) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, dumpLog(entries))
    }
    context.startActivity(Intent.createChooser(send, "Share log"))
}

@Composable
private fun StatusLine(label: String, ok: Boolean) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        Text(
            if (ok) "YES" else "NO",
            color = if (ok) Color(0xFF2E7D32) else Color(0xFFB3261E),
            style = MaterialTheme.typography.titleSmall
        )
    }
}
