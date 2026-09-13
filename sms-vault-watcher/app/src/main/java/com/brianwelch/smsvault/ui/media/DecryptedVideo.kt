package com.brianwelch.smsvault.ui.media

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.ui.PlayerView

/**
 * In-app video playback (spec 9 Thread view) sourced from the decrypted stream via
 * [EncryptedFileDataSource]. Nothing is written to disk; ExoPlayer pulls bytes on
 * demand, satisfying acceptance test 4 (stream without OOM).
 */
@OptIn(UnstableApi::class)
@Composable
fun DecryptedVideo(encryptedFilename: String, mimeType: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current

    val player = remember(encryptedFilename) {
        ExoPlayer.Builder(context).build().apply {
            val item = MediaItem.Builder()
                .setUri(EncryptedFileDataSource.uriFor(encryptedFilename))
                .setMimeType(if (mimeType.startsWith("video/")) mimeType else MimeTypes.VIDEO_MP4)
                .build()
            val source = ProgressiveMediaSource
                .Factory(EncryptedFileDataSource.Factory(context))
                .createMediaSource(item)
            setMediaSource(source)
            prepare()
            playWhenReady = false
        }
    }

    DisposableEffect(encryptedFilename) {
        onDispose { player.release() }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                this.player = player
                useController = true
            }
        },
        modifier = modifier.fillMaxWidth().height(240.dp)
    )
}
