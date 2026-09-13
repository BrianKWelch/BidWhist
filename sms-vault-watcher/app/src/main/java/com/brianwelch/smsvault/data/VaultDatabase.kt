package com.brianwelch.smsvault.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.brianwelch.smsvault.crypto.KeystoreManager
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory

/**
 * Section 6: SQLCipher-backed Room database in filesDir. The passphrase is the
 * Keystore-sealed secret from [KeystoreManager]; SQLCipher copies the bytes into
 * native memory, so we zero our copy immediately after the factory is built.
 */
@Database(
    entities = [
        VaultMessage::class,
        VaultAttachment::class,
        VaultNumber::class,
        VaultBookmark::class
    ],
    version = 1,
    exportSchema = false
)
abstract class VaultDatabase : RoomDatabase() {
    abstract fun dao(): VaultDao

    companion object {
        private const val DB_NAME = "vault.db"

        @Volatile private var instance: VaultDatabase? = null

        fun get(context: Context): VaultDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(context: Context): VaultDatabase {
            // net.zetetic:sqlcipher-android ships its own native loader.
            System.loadLibrary("sqlcipher")
            val passphrase = KeystoreManager.databasePassphrase(context)
            val factory = SupportOpenHelperFactory(passphrase)
            // SupportOpenHelperFactory takes a defensive copy internally; wipe ours.
            passphrase.fill(0)
            return Room.databaseBuilder(context, VaultDatabase::class.java, DB_NAME)
                .openHelperFactory(factory)
                .build()
        }
    }
}
