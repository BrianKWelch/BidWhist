package com.brianwelch.smsvault.crypto

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Section 6 key storage.
 *
 * Two independent Keystore-backed secrets:
 *
 *  1. A [MasterKey] (AES256_GCM scheme) used by androidx.security to wrap the
 *     per-file media keys ([androidx.security.crypto.EncryptedFile]) and the
 *     small EncryptedSharedPreferences that holds the DB passphrase.
 *
 *  2. A dedicated AES key in the AndroidKeystore that encrypts a random 32-byte
 *     SQLCipher passphrase. The passphrase itself is generated once, sealed with
 *     that key, and stored in EncryptedSharedPreferences. It is never written to
 *     disk in the clear and never leaves the process as plaintext beyond the
 *     open call.
 *
 * Nothing here is gated on biometrics: the observer service must be able to
 * write to the vault while the screen is locked. The biometric gate is enforced
 * at the UI boundary (see BiometricGate / MainActivity), not at the storage key.
 */
object KeystoreManager {

    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val PASSPHRASE_KEY_ALIAS = "vault_db_passphrase_key"
    private const val PREFS_FILE = "vault_secure_prefs"
    private const val PREF_SEALED_PASSPHRASE = "sealed_db_passphrase"
    private const val PREF_PASSPHRASE_IV = "sealed_db_passphrase_iv"
    private const val GCM_TAG_BITS = 128

    fun masterKey(context: Context): MasterKey =
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

    private fun securePrefs(context: Context) =
        EncryptedSharedPreferences.create(
            context,
            PREFS_FILE,
            masterKey(context),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

    /**
     * Returns the SQLCipher passphrase as raw bytes, generating and sealing it on
     * first call. Callers should zero the returned array after handing it to the
     * database factory.
     */
    @Synchronized
    fun databasePassphrase(context: Context): ByteArray {
        val prefs = securePrefs(context)
        val sealed = prefs.getString(PREF_SEALED_PASSPHRASE, null)
        val ivB64 = prefs.getString(PREF_PASSPHRASE_IV, null)
        if (sealed != null && ivB64 != null) {
            val cipherText = android.util.Base64.decode(sealed, android.util.Base64.NO_WRAP)
            val iv = android.util.Base64.decode(ivB64, android.util.Base64.NO_WRAP)
            return unseal(cipherText, iv)
        }
        // First run: create a random passphrase, seal it, persist.
        val passphrase = ByteArray(32).also { java.security.SecureRandom().nextBytes(it) }
        val (cipherText, iv) = seal(passphrase)
        prefs.edit()
            .putString(PREF_SEALED_PASSPHRASE, android.util.Base64.encodeToString(cipherText, android.util.Base64.NO_WRAP))
            .putString(PREF_PASSPHRASE_IV, android.util.Base64.encodeToString(iv, android.util.Base64.NO_WRAP))
            .apply()
        return passphrase
    }

    private fun passphraseKey(): SecretKey {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (ks.getKey(PASSPHRASE_KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                PASSPHRASE_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    private fun seal(plain: ByteArray): Pair<ByteArray, ByteArray> {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, passphraseKey())
        val ct = cipher.doFinal(plain)
        return ct to cipher.iv
    }

    private fun unseal(cipherText: ByteArray, iv: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, passphraseKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
        return cipher.doFinal(cipherText)
    }
}
