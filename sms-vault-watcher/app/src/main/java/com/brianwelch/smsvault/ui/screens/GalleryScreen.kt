package com.brianwelch.smsvault.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.brianwelch.smsvault.data.GalleryItem
import com.brianwelch.smsvault.ui.AppViewModel
import com.brianwelch.smsvault.ui.media.DecryptedImage
import com.brianwelch.smsvault.ui.media.DecryptedVideo

/**
 * In-vault gallery: a grid of every captured photo and video, staying encrypted.
 * Tap a tile to view an image full-screen or play a video in place. Everything is
 * decrypted to memory only; nothing leaves the vault unless exported from a thread.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GalleryScreen(viewModel: AppViewModel, onBack: () -> Unit) {
    val items by viewModel.gallery.collectAsState()
    var viewing by remember { mutableStateOf<GalleryItem?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gallery") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } }
            )
        }
    ) { padding ->
        if (items.isEmpty()) {
            Column(Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                Text("No media yet.", style = MaterialTheme.typography.bodyLarge)
                Text(
                    "Photos and videos from your watched numbers will collect here.",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 110.dp),
                modifier = Modifier.fillMaxSize().padding(padding).padding(4.dp)
            ) {
                items(items, key = { it.id }) { item ->
                    Box(
                        Modifier
                            .padding(3.dp)
                            .fillMaxWidth()
                            .aspectRatio(1f)
                            .clickable { viewing = item }
                    ) {
                        if (item.mime_type.startsWith("video/")) {
                            Box(
                                Modifier.fillMaxSize().background(Color(0xFF16181D)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Filled.PlayCircle,
                                    contentDescription = "Video",
                                    tint = Color.White
                                )
                            }
                        } else {
                            DecryptedImage(item.encrypted_filename, Modifier.fillMaxSize())
                        }
                    }
                }
            }
        }
    }

    viewing?.let { item ->
        Dialog(
            onDismissRequest = { viewing = null },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(Modifier.fillMaxSize().background(Color.Black)) {
                if (item.mime_type.startsWith("video/")) {
                    DecryptedVideo(
                        item.encrypted_filename,
                        item.mime_type,
                        Modifier.align(Alignment.Center)
                    )
                } else {
                    DecryptedImage(item.encrypted_filename, Modifier.align(Alignment.Center))
                }
                IconButton(
                    onClick = { viewing = null },
                    modifier = Modifier.align(Alignment.TopEnd).padding(12.dp)
                ) {
                    Icon(Icons.Filled.Close, contentDescription = "Close", tint = Color.White)
                }
            }
        }
    }
}
