package com.brianwelch.smsvault.ui.screens

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.brianwelch.smsvault.crypto.MediaCrypto
import com.brianwelch.smsvault.data.MessageWithAttachments
import com.brianwelch.smsvault.data.VaultAttachment
import com.brianwelch.smsvault.data.VaultMessage
import com.brianwelch.smsvault.ui.AppViewModel
import com.brianwelch.smsvault.ui.media.DecryptedImage
import com.brianwelch.smsvault.ui.media.DecryptedVideo
import com.brianwelch.smsvault.util.VaultLock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date

/**
 * Thread view (spec 9): messages chronological, inline image display, in-app
 * video playback from the decrypted stream. Long-press an attachment to export.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ThreadScreen(
    activity: FragmentActivity,
    viewModel: AppViewModel,
    threadKey: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val messages: List<VaultMessage> by viewModel
        .threadMessages(threadKey)
        .collectAsState(initial = emptyList())

    val withAttachments by produceState(
        initialValue = emptyList<MessageWithAttachments>(),
        key1 = messages
    ) {
        value = viewModel.attachmentsFor(messages)
    }

    var exportTarget by remember { mutableStateOf<VaultAttachment?>(null) }
    var pendingExport by remember { mutableStateOf<VaultAttachment?>(null) }
    var deleteTarget by remember { mutableStateOf<VaultMessage?>(null) }

    val createDoc = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/octet-stream")
    ) { uri ->
        val att = pendingExport
        pendingExport = null
        if (uri != null && att != null) {
            scope.launch {
                val ok = withContext(Dispatchers.IO) {
                    runCatching {
                        context.contentResolver.openOutputStream(uri)?.use { out ->
                            MediaCrypto.openStream(context, att.encrypted_filename).use { it.copyTo(out) }
                        }
                        true
                    }.getOrDefault(false)
                }
                Toast.makeText(
                    context,
                    if (ok) "Exported. The file is now outside the vault." else "Export failed.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(messages.firstOrNull()?.sender_e164 ?: "Thread") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } }
            )
        }
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).padding(12.dp)) {
            items(withAttachments, key = { it.message.id }) { item ->
                VaultLock.noteInteraction()
                Card(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 5.dp)
                        .combinedClickable(onClick = {}, onLongClick = { deleteTarget = item.message })
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text(
                            DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT)
                                .format(Date(item.message.received_at)),
                            style = MaterialTheme.typography.labelSmall
                        )
                        item.message.body?.takeIf { it.isNotBlank() }?.let {
                            Spacer(Modifier.height(6.dp))
                            Text(it, style = MaterialTheme.typography.bodyLarge)
                        }
                        item.attachments.forEach { att ->
                            Spacer(Modifier.height(8.dp))
                            AttachmentView(att) { exportTarget = att }
                        }
                        if (item.message.source == "mms" && item.attachments.isEmpty() &&
                            item.message.body.isNullOrBlank()
                        ) {
                            Text("[media pending]", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }

    exportTarget?.let { att ->
        AlertDialog(
            onDismissRequest = { exportTarget = null },
            title = { Text("Export attachment") },
            text = {
                Text(
                    "This copies the file to Downloads or your Secure Folder. Once exported " +
                        "it leaves the vault's encrypted storage and is readable by other apps."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    pendingExport = att
                    exportTarget = null
                    createDoc.launch("vault_${att.id}${extensionFor(att.mime_type)}")
                }) { Text("Export") }
            },
            dismissButton = { TextButton(onClick = { exportTarget = null }) { Text("Cancel") } }
        )
    }

    deleteTarget?.let { msg ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete from vault?") },
            text = {
                Text(
                    "This permanently removes this message and any photo or video it " +
                        "carries from the vault. It cannot be undone."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteMessage(msg.id)
                    deleteTarget = null
                }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel") } }
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun AttachmentView(att: VaultAttachment, onLongPress: () -> Unit) {
    val modifier = Modifier
        .fillMaxWidth()
        .combinedClickable(onClick = {}, onLongClick = onLongPress)
    when {
        att.mime_type.startsWith("image/") -> DecryptedImage(att.encrypted_filename, modifier)
        att.mime_type.startsWith("video/") -> DecryptedVideo(att.encrypted_filename, att.mime_type, modifier)
        else -> Text("[${att.mime_type}]", modifier = modifier)
    }
}

private fun extensionFor(mime: String): String = when {
    mime == "image/jpeg" -> ".jpg"
    mime == "image/png" -> ".png"
    mime == "image/gif" -> ".gif"
    mime.startsWith("video/") -> ".mp4"
    mime.startsWith("image/") -> ".img"
    else -> ".bin"
}
