package com.brianwelch.smsvault.ui.screens

import android.provider.ContactsContract
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.brianwelch.smsvault.ui.AppViewModel

/**
 * Section 9 "Vault numbers": add, edit, remove watched numbers. Contact picker
 * plus manual entry. No HTML form — standard Compose handlers only (spec 9).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VaultNumbersScreen(viewModel: AppViewModel, onBack: () -> Unit) {
    val context = LocalContext.current
    val numbers by viewModel.numbers.collectAsState()

    var manualNumber by remember { mutableStateOf("") }
    var manualLabel by remember { mutableStateOf("") }

    val contactPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickContact()
    ) { uri ->
        if (uri != null) {
            context.contentResolver.query(
                uri,
                arrayOf(
                    ContactsContract.CommonDataKinds.Phone.NUMBER,
                    ContactsContract.Contacts.DISPLAY_NAME
                ),
                null, null, null
            )?.use { c ->
                if (c.moveToFirst()) {
                    val number = c.getString(0)
                    val name = c.getString(1)
                    if (!number.isNullOrBlank()) viewModel.addNumber(number, name)
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Watched numbers") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } }
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text("Add a number", style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = manualNumber,
                        onValueChange = { manualNumber = it },
                        label = { Text("Phone number") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = manualLabel,
                        onValueChange = { manualLabel = it },
                        label = { Text("Label (optional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = {
                                if (manualNumber.isNotBlank()) {
                                    viewModel.addNumber(manualNumber.trim(), manualLabel.ifBlank { null })
                                    manualNumber = ""
                                    manualLabel = ""
                                }
                            }
                        ) { Text("Add") }
                        Button(onClick = { contactPicker.launch(null) }) {
                            Icon(Icons.Filled.Contacts, contentDescription = null)
                            Spacer(Modifier.height(0.dp))
                            Text("  From contacts")
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Text("Currently watching (${numbers.size})", style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(8.dp))

            LazyColumn {
                items(numbers, key = { it.id }) { number ->
                    Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                        Row(
                            Modifier.padding(14.dp).fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(number.e164, style = MaterialTheme.typography.bodyLarge)
                                if (!number.label.isNullOrBlank()) {
                                    Text(number.label, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                            IconButton(onClick = { viewModel.deleteNumber(number.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Remove")
                            }
                        }
                    }
                }
            }
        }
    }
}
