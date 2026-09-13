package com.brianwelch.smsvault.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.brianwelch.smsvault.role.PurgeManager
import com.brianwelch.smsvault.ui.AppViewModel

/**
 * Purge screen (spec 7 + 9). Shows the pending count, warns that RCS is
 * interrupted, requests the SMS role, runs the sweep, reports successes and
 * failures by row, and hands the role back through settings.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurgeScreen(
    activity: FragmentActivity,
    viewModel: AppViewModel,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val pending by viewModel.pendingDeleteCount.collectAsState()
    val sweepResult by viewModel.sweepResult.collectAsState()
    val importResult by viewModel.importResult.collectAsState()

    var awaitingSweep by remember { mutableStateOf(false) }
    var deleteAfterImport by remember { mutableStateOf(true) }
    var importMode by remember { mutableStateOf(false) }

    val isDefault = PurgeManager.isHoldingRole(context)

    val roleLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        // Whether or not the system reports RESULT_OK, verify by package check.
        if (PurgeManager.isHoldingRole(context)) {
            if (importMode) {
                viewModel.runHistoricalImport(deleteAfterImport)
            } else if (awaitingSweep) {
                viewModel.runSweep()
            }
        }
        awaitingSweep = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Purge from phone") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } }
            )
        }
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text("Pending deletions: $pending", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "The purge temporarily makes this app your default SMS handler so it can " +
                            "delete the archived originals from the phone. RCS is interrupted while " +
                            "the role is held. Afterwards you restore your normal app in Settings.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            Button(
                enabled = pending > 0,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    importMode = false
                    if (isDefault) {
                        viewModel.runSweep()
                    } else {
                        awaitingSweep = true
                        roleLauncher.launch(PurgeManager.beginRoleRequest(activity))
                    }
                }
            ) { Text("Delete $pending vaulted message(s) from phone") }

            Spacer(Modifier.height(10.dp))

            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    importMode = true
                    deleteAfterImport = true
                    if (isDefault) {
                        viewModel.runHistoricalImport(true)
                    } else {
                        roleLauncher.launch(PurgeManager.beginRoleRequest(activity))
                    }
                }
            ) { Text("One-time historical import (scan + copy + delete)") }

            sweepResult?.let { result ->
                Spacer(Modifier.height(20.dp))
                SweepReport(result)
                Spacer(Modifier.height(10.dp))
                OutlinedButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { activity.startActivity(PurgeManager.restoreDefaultIntent()) }
                ) { Text("Restore your default SMS app (${PurgeManager.previousDefaultPackage(context) ?: "your messaging app"})") }
                TextButton(onClick = { viewModel.clearSweepResult() }) { Text("Dismiss report") }
            }

            importResult?.let { r ->
                Spacer(Modifier.height(20.dp))
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Historical import complete", style = MaterialTheme.typography.titleMedium)
                        Text("SMS imported: ${r.importedSms}")
                        Text("MMS imported: ${r.importedMms}")
                    }
                }
                TextButton(onClick = { viewModel.clearImportResult() }) { Text("Dismiss") }
            }

            if (isDefault) {
                Spacer(Modifier.height(16.dp))
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "This app is currently your default SMS handler.",
                            style = MaterialTheme.typography.titleSmall,
                            color = Color(0xFFB3261E)
                        )
                        Text(
                            "Restore your normal messaging app now to bring RCS back.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = { activity.startActivity(PurgeManager.restoreDefaultIntent()) }) {
                            Text("Open default apps settings")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SweepReport(result: PurgeManager.SweepResult) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text("Sweep report", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(6.dp))
            if (result.roleNotHeld) {
                Text(
                    "The SMS role was not held, so nothing was deleted.",
                    color = Color(0xFFB3261E)
                )
                return@Column
            }
            Text("Deleted: ${result.deletedCount}")
            Text("Failed: ${result.failures.size}")
            if (result.failures.isNotEmpty()) {
                Divider(Modifier.padding(vertical = 8.dp))
                Text("Failures by row:", style = MaterialTheme.typography.titleSmall)
                result.failures.forEach { f ->
                    Text(
                        "• ${f.source} row ${f.providerRowId}: ${f.reason}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFB3261E)
                    )
                }
                Text(
                    "Rows that failed were left in the vault and NOT marked deleted.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }
        }
    }
}
