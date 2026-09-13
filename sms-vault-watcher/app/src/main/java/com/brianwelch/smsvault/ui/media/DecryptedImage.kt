package com.brianwelch.smsvault.ui.media

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.brianwelch.smsvault.crypto.MediaCrypto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Section 6: thumbnails are generated on demand, decrypted to memory, and never
 * written to disk. This composable decodes a downscaled Bitmap straight from the
 * decrypting stream.
 */
@Composable
fun DecryptedImage(encryptedFilename: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var bitmap by remember(encryptedFilename) { mutableStateOf<Bitmap?>(null) }

    LaunchedEffect(encryptedFilename) {
        bitmap = withContext(Dispatchers.IO) {
            runCatching {
                // First pass: bounds only, to compute a sane sample size.
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                MediaCrypto.openStream(context, encryptedFilename).use {
                    BitmapFactory.decodeStream(it, null, bounds)
                }
                val opts = BitmapFactory.Options().apply {
                    inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, 1280)
                }
                MediaCrypto.openStream(context, encryptedFilename).use {
                    BitmapFactory.decodeStream(it, null, opts)
                }
            }.getOrNull()
        }
    }

    Box(modifier.fillMaxWidth().heightIn(max = 360.dp)) {
        bitmap?.let {
            Image(
                bitmap = it.asImageBitmap(),
                contentDescription = "Attached image",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

private fun sampleSize(width: Int, height: Int, target: Int): Int {
    if (width <= 0 || height <= 0) return 1
    var sample = 1
    var w = width
    var h = height
    while (w / 2 >= target && h / 2 >= target) {
        w /= 2; h /= 2; sample *= 2
    }
    return sample
}
