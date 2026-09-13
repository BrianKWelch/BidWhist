package com.brianwelch.smsvault.crypto

import android.content.Context
import androidx.security.crypto.EncryptedFile
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

/**
 * Section 6 media-at-rest.
 *
 * Every attachment is streamed into an [EncryptedFile] under filesDir/media with
 * a random UUID name and no extension. Reads return a decrypting InputStream that
 * is handed straight to the image loader / ExoPlayer datasource, so video is
 * never buffered whole in memory (acceptance test 4).
 */
object MediaCrypto {

    private const val MEDIA_DIR = "media"

    private fun mediaDir(context: Context): File =
        File(context.filesDir, MEDIA_DIR).apply { if (!exists()) mkdirs() }

    fun fileFor(context: Context, encryptedName: String): File =
        File(mediaDir(context), encryptedName)

    private fun encryptedFile(context: Context, target: File): EncryptedFile =
        EncryptedFile.Builder(
            context,
            target,
            KeystoreManager.masterKey(context),
            EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB
        ).build()

    /**
     * Streams [source] into a new encrypted file. Returns the random filename and
     * the number of plaintext bytes written. The caller owns closing [source].
     */
    fun writeStream(context: Context, source: InputStream): StoredMedia {
        val name = UUID.randomUUID().toString().replace("-", "")
        val target = fileFor(context, name)
        var total = 0L
        encryptedFile(context, target).openFileOutput().use { out: OutputStream ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val read = source.read(buf)
                if (read < 0) break
                out.write(buf, 0, read)
                total += read
            }
            out.flush()
        }
        return StoredMedia(name, total)
    }

    /** Decrypting stream for playback / thumbnailing. Caller closes it. */
    fun openStream(context: Context, encryptedName: String): InputStream =
        encryptedFile(context, fileFor(context, encryptedName)).openFileInput()

    fun delete(context: Context, encryptedName: String): Boolean =
        fileFor(context, encryptedName).delete()

    data class StoredMedia(val encryptedName: String, val byteSize: Long)
}
