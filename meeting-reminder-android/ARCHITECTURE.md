# Meeting Reminder: Implementation Plan and Architecture

## Goal in one line

Read-only Microsoft 365 calendar, then pick one meeting, then a local Android alarm, then a notification.
Nothing is ever written back to Microsoft 365.

## Flow

```
Microsoft Graph  GET /me/calendarView   (Calendars.Read, delegated, read-only)
        |
        v
MeetingsScreen   TODAY / TOMORROW / UPCOMING   (times rendered in the phone's current zone)
        |  tap
        v
RemindMeSheet    5 / 10 / 15 / 30 / 60 min / Custom
        |
        v
Room: reminders table  (eventId PK, title, start, end, remindAt (UTC epoch ms), offset, joinUrl, status)
        |
        v
AlarmManager.setExactAndAllowWhileIdle(RTC_WAKEUP, remindAtUtc)
        |  fires even if the app is closed
        v
ReminderAlarmReceiver  ->  "Meeting in 15 minutes" notification  [JOIN MEETING]
```

## Modules and packages (single `app` module)

| Package | Responsibility | Android-free (unit tested on JVM) |
|---|---|---|
| `auth` | MSAL single-account wrapper, runtime config file, redirect URI from the APK's signing cert | `AuthConfig` yes |
| `graph` | HTTPS GET to Graph, JSON parse, join-link extraction | `GraphParser`, `JoinUrlExtractor` yes |
| `data` | Room database (reminders), DataStore (settings) | no |
| `reminders` | Reminder math, reconciliation rules, AlarmManager, receivers, notifications | `ReminderMath`, `ReminderReconciler` yes |
| `time` | Today/Tomorrow/Upcoming grouping, zone-aware formatting | `MeetingGrouping`, `TimeText` yes |
| `ui` | Compose screens and one `MainViewModel` | no |

Manual dependency wiring (`AppGraph`), no DI framework. HTTP uses `HttpURLConnection` + `org.json`
(both built into Android) so the dependency surface stays small.

## Key decisions

1. **Read-only by construction.** The only Graph calls are two `GET`s (`/me/calendarView`,
   `/me/events/{id}`). The Graph client has no code path that issues POST, PATCH, PUT or DELETE.
   The only scope requested is `Calendars.Read`.
2. **Absolute time everywhere.** Graph is asked for UTC (`Prefer: outlook.timezone="UTC"`). Start,
   end and reminder time are stored as UTC epoch milliseconds. Display converts to
   `ZoneId.systemDefault()` at render time, so travel, time zone changes and DST never shift a
   reminder. Reminder time = start instant minus a `Duration`, never wall-clock arithmetic.
3. **Alarms.** `setExactAndAllowWhileIdle` with `RTC_WAKEUP`. Permission `USE_EXACT_ALARM`
   (API 33+, granted at install, cannot be revoked) plus `SCHEDULE_EXACT_ALARM` capped at API 32.
   If exact alarms are ever unavailable the app falls back to `setAndAllowWhileIdle` and tells
   the user. Tradeoff documented in the README.
4. **Survives restarts.** Alarms are rebuilt from Room on `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`,
   `TIME_SET`, `TIMEZONE_CHANGED`, exact-alarm permission changes, and every app start.
   Scheduling is idempotent (one `PendingIntent` per reminder, keyed by its row id).
5. **One reminder per meeting.** `eventId` is the primary key. Setting a new time replaces the
   old reminder and its alarm. No duplicates are possible.
6. **Reconciliation on open** (`ReminderReconciler`, pure logic): meeting moved means the reminder
   moves with it (same offset); meeting cancelled or deleted means the alarm is cancelled and the
   reminder is flagged; missed reminder whose meeting has not started yet means notify now.
   The same function is what a future background sync worker would call.
7. **Auth.** MSAL authorization-code + PKCE through the system browser or Microsoft
   Authenticator (broker). Tokens stay in MSAL's own encrypted cache. No secret in the app.
   The client ID is entered in the app (or baked in at build time); the redirect URI is computed
   from the installed APK's signing certificate and shown on screen to paste into Entra.
8. **Future multi-account.** Each reminder row carries `accountId`. The Graph client takes a
   token provider, not a global account.

## Edge cases and where they are handled

| Case | Handling |
|---|---|
| Meeting cancelled | `isCancelled` or 404 from Graph, so alarm cancelled, row marked `MEETING_CANCELLED`, shown in My Reminders |
| Meeting time changes | Reminder moved by the same offset; note shown in My Reminders |
| Phone restart | `BOOT_COMPLETED` receiver reschedules from Room |
| Time zone change / DST | Nothing to recompute (UTC storage); receiver reschedules anyway as a safety net |
| Auth expires | `MsalUiRequiredException`, then "Sign in again" banner. Existing reminders keep firing (local) |
| No Teams/Zoom link | Notification has no JOIN button; details screen says "No online meeting link" |
| Duplicate | Primary key on `eventId`; UI shows current reminder and offers Change |
| Reminder time already passed | Options in the past are disabled; on reschedule, a missed reminder fires immediately if the meeting has not started, otherwise it is marked missed |
