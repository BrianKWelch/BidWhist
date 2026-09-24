import java.security.KeyStore
import java.security.MessageDigest
import java.util.Base64

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

// ---------------------------------------------------------------------------
// Signing
//
// A stable key matters for this app: the MSAL redirect URI registered in Entra
// contains a hash of the signing certificate, and Android only installs an
// update over an existing install when the key matches. CI supplies the key
// through environment variables fed from GitHub secrets. With none set, a
// local build falls back to the standard Android debug keystore.
// ---------------------------------------------------------------------------
val envKeystore = System.getenv("MR_KEYSTORE_FILE")?.let { file(it) }?.takeIf { it.isFile && it.length() > 0 }
val envStorePassword = System.getenv("MR_KEYSTORE_PASSWORD") ?: ""
val envKeyAlias = System.getenv("MR_KEY_ALIAS") ?: "meetingreminder"
val envKeyPassword = System.getenv("MR_KEY_PASSWORD") ?: envStorePassword

val debugKeystore = File(System.getProperty("user.home"), ".android/debug.keystore")

/** Base64(SHA-1(signing cert)), the value MSAL puts in the redirect URI path. */
fun signatureHash(store: File, storePassword: String, alias: String): String? = runCatching {
    val ks = KeyStore.getInstance(KeyStore.getDefaultType())
    store.inputStream().use { ks.load(it, storePassword.toCharArray()) }
    val cert = ks.getCertificate(alias) ?: return null
    Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1").digest(cert.encoded))
}.getOrNull()

val signingHash: String? = when {
    envKeystore != null -> signatureHash(envKeystore, envStorePassword, envKeyAlias)
    debugKeystore.isFile -> signatureHash(debugKeystore, "android", "androiddebugkey")
    else -> null
}

// Optional: bake a client/tenant ID into the build so the setup screen is pre-filled.
// Neither value is a secret (public client, no client secret exists).
fun buildValue(name: String): String =
    (project.findProperty(name) as String?) ?: System.getenv(name) ?: ""

android {
    namespace = "com.brianwelch.meetingreminder"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.brianwelch.meetingreminder"
        minSdk = 29
        targetSdk = 35
        versionCode = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1
        versionName = "1.0." + (System.getenv("GITHUB_RUN_NUMBER") ?: "0")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "DEFAULT_CLIENT_ID", "\"${buildValue("MSAL_CLIENT_ID")}\"")
        buildConfigField("String", "DEFAULT_TENANT_ID", "\"${buildValue("MSAL_TENANT_ID")}\"")

        // MSAL's BrowserTabActivity must accept msauth://<package>/<signature hash>.
        // When the hash is known at build time the intent filter is pinned to it;
        // otherwise "/" (any path under our own package host) still matches.
        manifestPlaceholders["msalPathPrefix"] = "/" + (signingHash ?: "")
    }

    signingConfigs {
        if (envKeystore != null) {
            create("shared") {
                storeFile = envKeystore
                storePassword = envStorePassword
                keyAlias = envKeyAlias
                keyPassword = envKeyPassword
            }
        }
    }

    buildTypes {
        release {
            // R8 is left off deliberately: MSAL and its transitive libraries rely on
            // reflection, and an APK this size gains nothing worth that risk.
            isMinifyEnabled = false
            signingConfig = if (envKeystore != null) signingConfigs.getByName("shared")
            else signingConfigs.getByName("debug")
        }
        debug {
            if (envKeystore != null) signingConfig = signingConfigs.getByName("shared")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += setOf(
            "/META-INF/{AL2.0,LGPL2.1}",
            "META-INF/DEPENDENCIES",
            "META-INF/INDEX.LIST",
            "META-INF/versions/9/OSGI-INF/MANIFEST.MF",
        )
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Reminder storage + settings
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Microsoft Authentication Library (authorization code + PKCE, token cache)
    implementation("com.microsoft.identity.client:msal:8.5.0")

    testImplementation("junit:junit:4.13.2")
    // Android's org.json is a stub on the JVM; tests use the real implementation.
    testImplementation("org.json:json:20240303")
}
