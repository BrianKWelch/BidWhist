# SMS Vault Watcher

A sideloaded Android app that archives **your own** incoming SMS/MMS from a
chosen set of numbers into an encrypted, biometric-gated vault on the device,
dismisses the system messaging notification for those messages, and — on your
explicit command — temporarily holds the SMS role to delete the archived
originals from the phone.

Built to the spec in the task description. Target device: Samsung Galaxy Z Fold,
Android 17 / One UI. **Sideload only.**

---

## Scope and intent

This app operates on a single device — the one it is installed on — and only on
messages sent to that device. It is a personal archive-and-clear tool: capture
your own inbound messages, keep them encrypted, and remove the originals from
your inbox when you decide to. It is not built for, and should not be installed
on, a phone used by anyone else. Deleting or archiving your own received
messages on your own phone is ordinary; capturing another person's messages is
not what this is for.

---

## Build

Requirements:

- Android Studio (latest stable) on a desktop.
- SDK Platform **API 37 (Android 17)** installed via the SDK Manager. Confirm the
  exact level; `compileSdk`/`targetSdk` are set to 37.
- JDK 17 (bundled with recent Android Studio).

Steps:

1. Open `sms-vault-watcher/` in Android Studio. Let it sync Gradle. If the Gradle
   wrapper JAR is not present, Android Studio will generate it, or run
   `gradle wrapper` once from the project root.
2. Build > Build APK(s), or:
   ```bash
   ./gradlew :app:assembleRelease
   ```
3. Install to the connected phone:
   ```bash
   adb install -r app/build/outputs/apk/release/app-release.apk
   ```

The only third-party dependency is SQLCipher (`net.zetetic:sqlcipher-android`).
Everything else is AndroidX.

---

## First-run setup (in-app onboarding)

The Onboarding screen shows a live checklist. Each row turns green when granted:

1. **SMS / MMS / contacts / notifications** runtime permissions.
2. **Notification access** — sends you to the system Notification Listener
   settings. Required so the app can dismiss inbound alerts. Setup is not
   complete until this is on.
3. **Battery: Unrestricted / never sleeping.**
4. **Biometric or device credential enrolled.**

Then the Samsung-specific background steps (also listed in-app):

- Settings > Apps > Vault > Battery > **Unrestricted**
- Settings > Battery > Background usage limits > **Never sleeping apps** > add Vault
- Settings > Security and Privacy > **Auto Blocker > off** (only needed for the
  initial sideload)

---

## Arrival alerts

By default the app is silent when a watched number messages you. Optionally it can
post one private alert per captured message whose only visible text is the **label
you gave that number** (e.g. "NEWS Alert"). No sender, number, or message content
is shown, so nothing sensitive appears on the lock screen. Tapping it opens the
vault (biometric-gated). Leave a number's label blank to keep it fully silent.

## How it works (architecture)

| Concern | Mechanism | File |
|---|---|---|
| SMS capture (real time) | `SMS_RECEIVED` broadcast receiver, multipart reassembly, dual-SIM subscription id | `sms/SmsReceiver.kt` |
| MMS capture (polling) | `ContentObserver` on `content://mms-sms/`, query rows past `last_processed_mms_id`, resolve sender via `addr` type 137, stream image/video parts | `mms/MmsObserver.kt` |
| Keeping the observer alive | `FOREGROUND_SERVICE_SPECIAL_USE` with a minimal notification | `mms/ObserverService.kt` |
| Notification suppression | `NotificationListenerService`, package filter, recent-sender race bridge, `cancelNotification` | `notify/VaultNotificationListener.kt` |
| Number matching | E.164 normalize, last-10-digit match, raw fallback | `util/PhoneMatch.kt` |
| Encrypted DB | Room over SQLCipher, Keystore-sealed passphrase | `data/VaultDatabase.kt`, `crypto/KeystoreManager.kt` |
| Encrypted media | `EncryptedFile`, random UUID names, streamed (never fully buffered) | `crypto/MediaCrypto.kt` |
| Deletion path | `RoleManager.ROLE_SMS` request, provider `delete`, row-count check, restore | `role/PurgeManager.kt` |
| SMS-role stubs | Four no-op components so the role can be offered | `role/SmsRoleStubs.kt` |
| Foldable / Samsung hardening | `FLAG_SECURE`, `setShouldDockBigOverlays(false)`, `WindowInfoTracker` fold lock, idle + onPause lock | `MainActivity.kt`, `util/VaultLock.kt` |
| Biometric gate | `BiometricPrompt`, strong biometric or device credential | `util/BiometricGate.kt`, `ui/VaultNavHost.kt` |

### Why MMS is polled, not intercepted

A non-default app cannot receive `WAP_PUSH_DELIVER` or call
`downloadMultimediaMessage()`. The observer therefore reads MMS a few seconds
after the default app downloads it. That lag is inherent and is not a bug.

### The purge sweep

Deleting from `content://sms` / `content://mms` only works while the app holds
the SMS role. The Purge screen:

1. Records your current default SMS app.
2. Warns that RCS is interrupted while the role is held.
3. Requests `ROLE_SMS`.
4. Deletes each pending row and **checks the returned count** — a return of 0 is
   treated as a silent failure, surfaced in the report, and the row is left in
   the vault (not marked deleted).
5. Sends you to default-apps settings to restore your normal app. The role
   cannot be returned programmatically.

There is also a one-time **historical import** using the same role window: scan
existing SMS/MMS for the watched numbers, copy into the vault, then delete.

---

## Acceptance tests (spec section 10)

Run against a live second phone.

| # | Test | Covered by |
|---|---|---|
| 1 | SMS from a vault number archived, notification dismissed | `SmsReceiver` + `VaultNotificationListener` |
| 2 | Multipart SMS reassembles as one entry | `SmsReceiver` body concatenation |
| 3 | MMS photo lands, opens, hidden from Gallery/file managers | `MmsObserver` + `EncryptedFile` in `filesDir` |
| 4 | MMS video streams to disk without OOM, plays in-app | `MediaCrypto.writeStream` + `EncryptedFileDataSource` + `DecryptedVideo` |
| 5 | Non-vault SMS unaffected | match filter in `SmsReceiver`/listener |
| 6 | Purge removes from Samsung Messages, non-zero counts, role hands back | `PurgeManager.runSweep` |
| 7 | Fold while a message is open clears content + re-prompts | `WindowInfoTracker` listener → `VaultLock` |
| 8 | Screenshot in vault blocked | `FLAG_SECURE` |
| 9 | Recents thumbnail blank when backgrounded | `FLAG_SECURE` + `excludeFromRecents` |
| 10 | Vault MMS still captured after overnight idle | foreground service + battery steps |
| 11 | Dual SIM captured with correct `subscription_id` | intent `subscription` extra / `sub_id` |

---

## Known limits (spec section 11, do not engineer around)

- MMS capture lags the default app by seconds.
- Deletion requires temporarily holding the SMS role.
- The role cannot be returned programmatically; restoring your app is a manual
  step in Settings.
- RCS messages are invisible to this app. If a sender is on RCS, nothing is
  captured. Confirm the target number falls back to SMS/MMS.
- Carrier and Samsung Cloud copies persist. Disable Samsung Cloud message sync
  separately.

---

## Notes on the Gradle wrapper

`gradle/wrapper/gradle-wrapper.properties` pins Gradle 8.11.1. The wrapper JAR
and `gradlew` scripts are generated by Android Studio on first open, or by
running `gradle wrapper` once. They are intentionally not committed as binaries.
