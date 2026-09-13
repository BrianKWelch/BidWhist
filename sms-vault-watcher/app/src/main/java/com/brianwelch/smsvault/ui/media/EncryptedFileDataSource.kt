package com.brianwelch.smsvault.ui.media

import android.content.Context
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import com.brianwelch.smsvault.crypto.MediaCrypto
import java.io.InputStream

/**
 * Section 6 + acceptance test 4: play video from the decrypted stream without
 * writing plaintext to disk and without buffering the whole file in memory.
 *
 * The Media3 pipeline pulls bytes on demand through this DataSource, which opens
 * a fresh decrypting stream from the EncryptedFile and skips to the requested
 * offset. EncryptedFile streams are not randomly seekable, so a seek re-opens and
 * skips forward — fine for progressive playback of MMS-sized clips.
 *
 * Uri form: encfile://<encryptedFilename>
 */
@OptIn(UnstableApi::class)
class EncryptedFileDataSource(private val context: Context) : BaseDataSource(false) {

    private var stream: InputStream? = null
    private var uri: Uri? = null
    private var bytesRemaining: Long = 0

    override fun open(dataSpec: DataSpec): Long {
        uri = dataSpec.uri
        val name = dataSpec.uri.host ?: dataSpec.uri.schemeSpecificPart.trimStart('/')
        transferInitializing(dataSpec)

        val fresh = MediaCrypto.openStream(context, name)
        var toSkip = dataSpec.position
        while (toSkip > 0) {
            val skipped = fresh.skip(toSkip)
            if (skipped <= 0) break
            toSkip -= skipped
        }
        stream = fresh

        val fileBytes = MediaCrypto.fileFor(context, name).length()
        bytesRemaining = if (dataSpec.length != C.LENGTH_UNSET.toLong()) {
            dataSpec.length
        } else {
            // Approximate; EncryptedFile adds a small header/tag overhead. Reading
            // to EOS handles the exact end.
            (fileBytes - dataSpec.position).coerceAtLeast(0)
        }
        transferStarted(dataSpec)
        return if (bytesRemaining == 0L) C.LENGTH_UNSET.toLong() else bytesRemaining
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        val s = stream ?: return C.RESULT_END_OF_INPUT
        val read = s.read(buffer, offset, length)
        if (read == -1) return C.RESULT_END_OF_INPUT
        if (bytesRemaining != C.LENGTH_UNSET.toLong()) bytesRemaining -= read
        bytesTransferred(read)
        return read
    }

    override fun getUri(): Uri? = uri

    override fun close() {
        try { stream?.close() } catch (_: Exception) {}
        stream = null
        uri = null
        transferEnded()
    }

    @OptIn(UnstableApi::class)
    class Factory(private val context: Context) : DataSource.Factory {
        override fun createDataSource(): DataSource = EncryptedFileDataSource(context)
    }

    companion object {
        fun uriFor(encryptedFilename: String): Uri = Uri.parse("encfile://$encryptedFilename")
    }
}
