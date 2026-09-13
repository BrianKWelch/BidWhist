package com.brianwelch.smsvault.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.ManageAccounts
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.brianwelch.smsvault.ui.AppViewModel
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VaultListScreen(
    viewModel: AppViewModel,
    onOpenThread: (String) -> Unit,
    onManageNumbers: () -> Unit,
    onPurge: () -> Unit
) {
    val threads by viewModel.threads.collectAsState()
    val pending by viewModel.pendingDeleteCount.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Vault") },
                actions = {
                    IconButton(onClick = onManageNumbers) {
                        Icon(Icons.Filled.ManageAccounts, contentDescription = "Numbers")
                    }
                    IconButton(onClick = onPurge) {
                        BadgedBox(badge = { if (pending > 0) Badge { Text("$pending") } }) {
                            Icon(Icons.Filled.DeleteSweep, contentDescription = "Purge")
                        }
                    }
                }
            )
        }
    ) { padding ->
        if (threads.isEmpty()) {
            Column(Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                Text("No archived messages yet.", style = MaterialTheme.typography.bodyLarge)
                Text(
                    "Messages from your watched numbers will appear here.",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }
        } else {
            LazyColumn(Modifier.fillMaxSize().padding(padding).padding(12.dp)) {
                items(threads, key = { it.thread_key }) { thread ->
                    Card(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 5.dp)
                            .clickable { onOpenThread(thread.thread_key) }
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Row(Modifier.fillMaxWidth()) {
                                Text(
                                    thread.sender_e164,
                                    style = MaterialTheme.typography.titleMedium,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    DateFormat.getDateInstance(DateFormat.SHORT)
                                        .format(Date(thread.last_received_at)),
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                thread.last_body ?: "[media]",
                                style = MaterialTheme.typography.bodyMedium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                "${thread.message_count} message(s)",
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
