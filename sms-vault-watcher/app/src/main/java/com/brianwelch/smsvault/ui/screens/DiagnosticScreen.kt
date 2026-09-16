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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
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
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "If either is red, the Google/Samsung banner cannot be dismissed. " +
                            "Fix notification access first.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Spacer(Modifier.height(14.dp))
            Row(Modifier.fillMaxWidth()) {
                Text("Recent messaging notifications", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
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
