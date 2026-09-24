# Meeting Reminder (Android)

Pick one Outlook / Microsoft 365 meeting, get one local Android notification for it. Nothing else.

```
Microsoft 365 calendar (read-only)
        |
Upcoming meetings: TODAY / TOMORROW / UPCOMING
        |  tap a meeting
Remind me: 5 / 10 / 15 / 30 min / 1 hour / Custom
        |
Local alarm on the phone  ->  "Meeting in 15 minutes"  [JOIN MEETING]
```

| Guarantee | How it is enforced |
|---|---|
| Never modifies the calendar, the meeting, its Outlook reminder, or attendees | Only permission requested is `Calendars.Read`. The Graph client can only send `GET` (hard-coded constant). CI fails the build if a write method or write scope ever appears in the source. |
| Only reminds for meetings you pick | Reminders are created only from the "Remind me" sheet. There is no automatic path. |
| Works with the app closed and after a restart | Android `AlarmManager` alarm + boot receiver that re-arms from the local database. |
| Correct time anywhere you travel | Reminder stored as an absolute UTC instant. Display follows the phone's current zone. |

Plan and architecture: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. Setup at a glance

1. Register the app in Microsoft Entra (section 2). About 5 minutes.
2. Build the APK (section 4). GitHub builds it for you on every push.
3. Install on the Galaxy Z Fold (section 5).
4. Open the app, paste the Application (client) ID and Directory (tenant) ID, sign in.
5. In app Settings, clear the three "Reminder reliability" items and tap "Test in 10 s".

---

## 2. Microsoft Entra app registration

You need an account that can create app registrations in your tenant. If your firm restricts that,
send IT the request text in section 2.3.

### 2.1 Create the registration

1. Go to <https://entra.microsoft.com> > **Identity** > **Applications** > **App registrations** > **New registration**.
2. **Name:** `Meeting Reminder (Android)`.
3. **Supported account types:** *Accounts in this organizational directory only (Single tenant)*.
4. **Redirect URI:** leave empty for now. Click **Register**.
5. On the **Overview** page copy:
   - **Application (client) ID**
   - **Directory (tenant) ID**

### 2.2 Add the Android redirect URI

1. **Authentication** > **Add a platform** > **Android**.
2. **Package name:** `com.brianwelch.meetingreminder`
3. **Signature hash:** the value the app shows on its setup screen, or the value in the GitHub
   Actions run summary ("Signature hash"). It is the Base64 SHA-1 of the key that signed the APK.
4. **Configure.** Entra generates `msauth://com.brianwelch.meetingreminder/<hash>`. It must match
   the "Redirect URI" shown in the app character for character.
5. Leave **Allow public client flows** at **No**. It is not needed.
6. **Do not create a client secret or certificate.** A phone app is a public client; a secret shipped
   in an APK is not secret.

### 2.3 API permissions (read-only)

1. **API permissions**. Remove the default `User.Read` (not used).
2. **Add a permission** > **Microsoft Graph** > **Delegated permissions** > **Calendars** > check
   **`Calendars.Read`** > **Add permissions**.
3. Consent:
   - If your tenant allows user consent for low-risk permissions, you approve it yourself at first sign-in.
   - Otherwise an administrator must click **Grant admin consent**. The sign-in screen will say so.

| Permission | Type | Why | Admin consent required by Microsoft |
|---|---|---|---|
| `Calendars.Read` | Delegated | Read your own upcoming events | No (tenant policy may still require it) |
| `openid`, `profile`, `offline_access` | Delegated | Added automatically by MSAL for sign-in and silent token refresh | No |

`Calendars.ReadWrite` is **not** requested and is not needed for anything this app does.

Request text for IT, ready to send:

> Subject: App registration request: read-only calendar access for a personal reminder app
>
> I use a personal Android app that reads my own Outlook calendar so I can set a phone reminder on
> selected meetings. It needs one delegated Microsoft Graph permission, **Calendars.Read**, on a
> single-tenant public-client app registration (Android platform, no client secret). It cannot
> create, change or delete events, change Outlook reminders, or contact attendees.
> Package name: com.brianwelch.meetingreminder. Signature hash: <paste from the app>.
> Please create the registration (or grant admin consent on the one I created, client ID <id>) and
> send me the Application (client) ID and Directory (tenant) ID.

### 2.4 Entering the client ID

**Option A (normal):** first launch shows a setup screen. Paste the two IDs, tap **Save and continue**,
then **Sign in with Microsoft**. The IDs can be changed later in **Settings > Microsoft Entra app registration**.
Neither ID is a secret.

**Option B (bake into the build):** pass them at build time and the setup screen is pre-filled:

```bash
./gradlew assembleRelease -PMSAL_CLIENT_ID=<client-id> -PMSAL_TENANT_ID=<tenant-id>
```

(or set `MSAL_CLIENT_ID` / `MSAL_TENANT_ID` as environment variables).

**Tenant ID left blank** means "any work or school account" (`organizations`). That only works if the
registration is set to *multitenant*. Single tenant plus the tenant ID is the recommended setup.

**Government clouds:** V1 targets the commercial Microsoft 365 cloud, which also covers GCC. GCC High
and DoD tenants use different endpoints (`login.microsoftonline.us`, `graph.microsoft.us`) and are not
supported in V1.

---

## 3. Sign-in and security

- **Flow:** OAuth 2.0 authorization code with PKCE through MSAL for Android (`com.microsoft.identity.client:msal:8.5.0`).
  Sign-in happens in Microsoft Authenticator / Company Portal when installed (the broker, which also
  satisfies Conditional Access and compliant-device policies), otherwise in the system browser.
  Never in an embedded WebView.
- **Passwords:** never seen or stored by the app.
- **Tokens:** kept only in MSAL's token cache, encrypted with an Android Keystore key. Refreshed silently.
- **No client secret** anywhere in the app or the repository.
- **Backups:** disabled (`allowBackup="false"`, all domains excluded), so nothing is copied to cloud
  backup or to a new phone.
- **Stored locally per reminder:** Graph event ID, title, start, end, reminder time, join link, status.
  Meeting bodies are scanned in memory for a Zoom/Teams link and discarded.
- **Session expiry:** when Microsoft requires a fresh sign-in (password change, revoked session, new MFA
  requirement), the app shows "Sign-in expired" with a Sign in button. **Reminders already set keep
  firing**, because they are local and need no token.

---

## 4. Building the APK

### 4.1 GitHub Actions (no local tools needed)

Workflow: `.github/workflows/build-meeting-reminder-apk.yml`. Runs on every push that touches
`meeting-reminder-android/`, or manually: **Actions > Build Meeting Reminder APK > Run workflow**.

It will:
1. Fail the build if any write HTTP method or write-capable Graph scope appears in the source.
2. Run the unit tests.
3. Build and sign the release APK.
4. Publish **MeetingReminder-apk** (the APK) and **unit-test-report** as run artifacts.
5. Print the package name, signature hash and redirect URI in the run summary.

### 4.2 Stable signing key (do this once)

Without it, each CI run signs with a throwaway key. That works, but every new build then has a new
signature hash, so you must uninstall the old app and add the new redirect URI in Entra.
With a stable key, new builds install over the old one and the redirect URI never changes.

This repository is public, so the key goes in **encrypted repository secrets**, never in a branch.

```bash
keytool -genkeypair -v -keystore meetingreminder.jks -storetype PKCS12 \
  -alias meetingreminder -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Meeting Reminder, O=Personal, C=US"

base64 -w0 meetingreminder.jks > meetingreminder.b64     # Linux
base64 -i meetingreminder.jks -o meetingreminder.b64     # macOS
```

Windows PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("meetingreminder.jks")) | Set-Content meetingreminder.b64
```

GitHub > repository **Settings > Secrets and variables > Actions > New repository secret**:

| Secret | Value |
|---|---|
| `MR_KEYSTORE_B64` | contents of `meetingreminder.b64` |
| `MR_KEYSTORE_PASSWORD` | the keystore password you chose |
| `MR_KEY_ALIAS` | `meetingreminder` (optional, that is the default) |
| `MR_KEY_PASSWORD` | optional; defaults to the keystore password |

Store `meetingreminder.jks` and its password somewhere safe (password manager). Losing it means one
uninstall/reinstall and one new redirect URI in Entra.

### 4.3 Android Studio / command line

Requirements: Android Studio (Ladybug or newer) or JDK 17 + Android SDK platform 35.

```bash
cd meeting-reminder-android
./gradlew testDebugUnitTest          # unit tests
./gradlew assembleRelease            # app/build/outputs/apk/release/app-release.apk
```

A local build without the `MR_*` environment variables is signed with your machine's Android debug
key; the app shows the matching redirect URI on its setup screen. To sign locally with the stable key:

```bash
export MR_KEYSTORE_FILE=/path/meetingreminder.jks MR_KEYSTORE_PASSWORD=... MR_KEY_ALIAS=meetingreminder
./gradlew assembleRelease
```

---

## 5. Installing on the Galaxy Z Fold

1. Open the Actions run, download **MeetingReminder-apk** (a zip), extract `MeetingReminder.apk`.
   Easiest: open the run in the GitHub app or Samsung Internet on the phone and download it there.
2. **Samsung Auto Blocker** blocks sideloaded apps when on. Settings > Security and privacy >
   **Auto Blocker** > off (you can turn it back on after installing).
3. Open the APK from My Files; allow "Install unknown apps" for My Files or the browser when asked.
4. If you install a build signed with a different key than the installed one, uninstall first.

---

## 6. How scheduled reminders work

1. You pick "15 minutes before". The app computes `reminderTime = meetingStart - 15 minutes` on
   absolute instants (not wall-clock time) and stores it in the local Room database.
2. It arms an alarm with `AlarmManager.setExactAndAllowWhileIdle(RTC_WAKEUP, reminderTime)`.
   That alarm is owned by Android, not by the app: it fires with the app closed and wakes the phone
   from Doze (deep idle).
3. At that instant Android starts `ReminderAlarmReceiver`, which posts the notification:
   **"Meeting in 15 minutes"**, the meeting title, the start time in the phone's current zone, and a
   **JOIN MEETING** button when the invite has a Teams, Zoom (including ZoomGov), Webex or Google Meet link.
   Tapping the notification opens the meeting details. JOIN MEETING opens the link, which Android hands
   to the Teams or Zoom app when installed. The notification clears itself when the meeting ends.
4. Android wipes alarms on reboot and on force-stop. The app re-arms every alarm from the database on:
   `BOOT_COMPLETED`, app update, manual clock change, time zone change, exact-alarm permission change,
   and every app start.
5. A reminder whose time passed while the phone was off still fires on the next boot if the meeting has
   not started or started less than 10 minutes ago ("Meeting started 3 minutes ago"). Later than that
   it is marked **Missed** in My Reminders.

### Exact alarms: the decision and the tradeoff

| Option | Timing | Permission | Verdict |
|---|---|---|---|
| **`setExactAndAllowWhileIdle` (used)** | To the minute, wakes from Doze | `USE_EXACT_ALARM` (Android 13+, granted at install, cannot be revoked) | Chosen |
| `setAlarmClock` | Most reliable of all | Same | Shows an alarm-clock icon and "next alarm" on the lock screen, which is confusing for meeting reminders |
| Inexact alarm / WorkManager | Can be 10 to 15+ minutes late in Doze | None | Unacceptable for "5 minutes before" |

`USE_EXACT_ALARM` is the correct permission for an app whose core function is user-set reminders.
The only restriction is on **Google Play**, which allows it only for alarm, calendar and reminder apps
(this app qualifies, but Play would review the declaration). For this sideloaded build there is no
restriction. On Android 12/12L the app uses `SCHEDULE_EXACT_ALARM` instead. If exact alarms are ever
unavailable, the app falls back to an inexact alarm that still wakes from Doze and says so in Settings.

### Samsung-specific reliability (important)

One UI adds its own app sleeping on top of Android's Doze. An app in **Deep sleeping apps** does not
get its alarms. Do this once:

1. App **Settings > Reminder reliability > Allow unrestricted battery** (one-tap system dialog).
2. Phone Settings > Apps > Meeting Reminder > **Battery > Unrestricted**.
3. Phone Settings > Battery > **Background usage limits**: make sure Meeting Reminder is not in
   *Sleeping apps* or *Deep sleeping apps*; add it to *Never sleeping apps*.
4. Tap **Test in 10 s**, lock the phone, and confirm the notification arrives.

---

## 7. Android permissions

| Permission | Why | When |
|---|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | Sign-in and reading the calendar | Install |
| `POST_NOTIFICATIONS` | Required on Android 13+ to show any notification | Asked the first time you set a reminder; also from Settings |
| `USE_EXACT_ALARM` (API 33+) | Fire at the exact minute | Install, automatic |
| `SCHEDULE_EXACT_ALARM` (API 31-32 only) | Same, on Android 12/12L | User can toggle in system settings |
| `RECEIVE_BOOT_COMPLETED` | Re-arm reminders after a restart | Install |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Lets the app open the "allow unrestricted battery" dialog | Only when you tap the button |

No calendar, contacts, location, microphone or storage permissions are requested. The app does not
read the phone's own calendar.

---

## 8. Time zones

- Graph is asked for all times in UTC. Nothing is stored in local time.
- Every screen and the notification text are rendered in the phone's **current** zone at the moment
  of display. Land in Honolulu and the list shows Honolulu times; the TODAY / TOMORROW split follows
  the Honolulu date.
- Settings > **Time zones** adds a second line with Eastern (Columbus), Guam and/or Hawaii times
  (Eastern is on by default). A zone is hidden when it equals the phone's current zone.
- The reminder fires at the same absolute moment regardless of zone changes after it was set. DST
  transitions cannot shift it because it is `instant - duration`, not clock arithmetic. Unit tests cover
  the November DST fallback hour, and Columbus vs Honolulu vs Guam date boundaries.

---

## 9. Edge cases

| Case | Behavior |
|---|---|
| Meeting cancelled after the reminder was set | On next app open: alarm cancelled, reminder shown under **Needs attention** as "Meeting cancelled" |
| Meeting deleted | Same (Graph returns 404 on lookup) |
| Meeting time changes | Reminder moves with it, keeping the same lead time ("15 minutes before"). A custom clock-time reminder shifts by the same amount. Card shows "Meeting time changed (was ...)" |
| Meeting moved to a date outside the 7-day list | Looked up by ID, so it is treated as moved, not deleted |
| Phone restart | Boot receiver re-arms all alarms |
| Time zone / DST change | No recalculation needed; alarms re-armed anyway as a safety net |
| Microsoft sign-in expires | Banner with Sign in; existing reminders unaffected |
| No Teams/Zoom link | No JOIN button; details say "No Teams or Zoom link in this invite" |
| Duplicate reminder | Impossible: one reminder per meeting (unique event ID). Choosing again replaces it |
| Reminder time already passed | Those options are disabled and show "passed"; custom times in the past are rejected with an explanation |
| Meeting already started | Sheet says so; no reminder options |
| Notifications turned off | Banner with Allow button while any reminder is scheduled |

V1 refreshes when the app opens (and via the refresh button). The reconciliation logic
(`ReminderReconciler`) is pure and already takes "latest meeting data" as input, so a future background
sync (WorkManager every few hours calling `ReminderRepository.sync`) needs no storage changes. Each row
also stores the MSAL `accountId` for multi-account support later, and Graph IDs are requested in
`ImmutableId` format so they stay stable if an event moves between folders.

---

## 10. Project layout

```
meeting-reminder-android/
  app/src/main/java/com/brianwelch/meetingreminder/
    auth/        AuthConfig (runtime MSAL config), AuthManager (MSAL), SignatureHash
    graph/       GraphClient (GET only), GraphParser, JoinUrlExtractor
    data/        ReminderEntity, ReminderDao, AppDatabase (Room), SettingsStore (DataStore)
    reminders/   ReminderMath, ReminderReconciler, ReminderRepository, ReminderScheduler,
                 ReminderNotifier, Receivers (alarm + boot/time), JoinMeetingActivity
    time/        MeetingGrouping (Today/Tomorrow/Upcoming), TimeText (zone-aware formatting)
    ui/          MainActivity, MainViewModel, AppRoot, screens, RemindMeSheet
  app/src/test/  JVM unit tests (parser, join links, reminder math, DST, zones, reconciliation, config)
```

Stack: Kotlin 2.0.21, Jetpack Compose (BOM 2024.12.01, Material 3), AGP 8.7.3, Gradle 8.11.1,
compileSdk/targetSdk 35, minSdk 29, Room 2.6.1, DataStore 1.1.1, MSAL 8.5.0.

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `AADSTS50011` redirect URI mismatch | The APK was signed with a different key than the one registered. Copy the redirect URI from the app's Settings into Entra (Authentication > Android). |
| `AADSTS65001` / "needs admin approval" | Tenant blocks user consent. Send IT the request in section 2.3. |
| `AADSTS700016` app not found | Wrong client ID or tenant ID. |
| `AADSTS50194` | Registration is single tenant but tenant ID is blank. Enter the tenant ID. |
| Reminder arrived late or not at all | Settings > Reminder reliability: all three green, Samsung steps in section 6, then "Test in 10 s" with the phone locked. |
| "App not installed" | Uninstall the existing copy (different signing key), or turn off Auto Blocker. |
