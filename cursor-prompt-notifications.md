# Feature: Reminders and push notifications

You are working in my Umrah Trip Planner monorepo. Read the existing code first and follow its patterns. Don't rewrite anything unrelated.

## Project context (read these files before coding)
- **Server**: Node 18+, Express 5, Mongoose 9, JWT auth, CommonJS. Layers: `server/src/models`, `services` (pure logic, unit-tested), `controllers`, `routes`, `middleware/auth.js`, `utils/http.js` (`httpError`). `app.js` mounts routes, `index.js` starts the local server, `server/api/index.js` is the **Vercel serverless entry** (cached DB connection).
- **Client**: React + Vite in `client/`. Uses the `useFetch` hook and shared UI components (`Alert`, `Loading`, `Section`, `Field`, `OptionButton`, `Tabs`). Routes are code-split.
- **Tests**: Jest unit tests in `server/tests/*.test.js`. Integration tests in `server/tests/integration/*.itest.js` (node:test + supertest + mongodb-memory-server).
- **Hosting**: Vercel (free Hobby plan) for both client and API, MongoDB Atlas.
- **Existing data the reminders use**:
  - `Trip` (`server/src/models/Trip.js`): `stays[].checkIn/checkOut/city/hotelId`, `transfers[].from/to/date/mode` (train/bus/taxi), `travellers[].passportExpiry`, `checklist` (includes `nusukPermit`), `startDate`/`endDate`, `userId`.
  - Prayer times: `server/src/services/prayerTimesService.js` → `prayerTimes(city, date)`.
  - `Group` (`server/src/models/Group.js`): `members[].userId`, `meetingPoints[]` with `title`, `place`, optional `time` (Date), `note`. See `groupService.sortMeetingPoints`.
  - All trip times are **Saudi time (Asia/Riyadh, UTC+3)**. Store UTC in Mongo, and show/format in Asia/Riyadh in notification text.

## Important hosting constraint
The API runs as **Vercel serverless functions**, so there is no long-running process: `setInterval` and `node-cron` will NOT work in production, and Vercel Hobby cron only runs once per day. So:
1. Put all scheduling logic in a function `runDueNotifications(now)` that is **idempotent** and safe to call any time.
2. Expose it as `POST /api/cron/notifications`, protected by the header `Authorization: Bearer ${CRON_SECRET}` (new env var; return 401 without it).
3. In production an external free scheduler (**cron-job.org**) calls this endpoint **every minute**. Document the setup in the README.
4. In local dev (`index.js` only, never in `api/index.js`), run `runDueNotifications(new Date())` every 60 s with `setInterval` so it works without the external cron.

## What to build

### 1. Web Push (server)
- Add the `web-push` package. New env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` placeholder), `CRON_SECRET`. Add them to `.env.example` and the README env table. Add an npm script `vapid` that prints a new key pair (`web-push generate-vapid-keys`).
- New model `PushSubscription`: `userId`, `endpoint` (unique), `keys.p256dh`, `keys.auth`, `userAgent`, `createdAt`. A user can have several devices.
- Routes under `/api/notifications` (auth required):
  - `GET /vapid-public-key` (this one can be public)
  - `POST /subscribe` (upsert by endpoint)
  - `POST /unsubscribe` `{ endpoint }`
  - `GET /preferences`, `PUT /preferences`
  - `POST /test` (sends a test notification to the current user's devices)
- On send, if web-push returns **404 or 410**, delete that subscription (it has expired).

### 2. Notification preferences
Add `notificationPrefs` to `User` with defaults:
```
{
  enabled: true,
  prayer: { enabled: false, minutesBefore: 15, prayers: ['fajr','dhuhr','asr','maghrib','isha'] },
  transfers: true,      // evening before + 2 h before departure
  checkOut: true,       // 8 pm the evening before + 9 am on the day
  passport: true,       // passport expires < 6 months after trip end; also 30 days before trip start if still unresolved
  nusukPermit: true,    // daily at 9 am from 7 days before trip start while the checklist item is not done
  meetingPoints: true,  // 5 minutes before a group meeting time
  quietHours: { enabled: false, start: '23:00', end: '04:00' } // skip non-urgent ones; NEVER skip meeting, transfer or Fajr reminders
}
```
Validate it in a service (`notificationService.parsePrefs`) the same way the other services validate input.

### 3. Reminder rules (pure functions in `server/src/services/reminderService.js`)
Write `buildReminders({ trip, user, groups, now })`, which returns a list of `{ key, userId, sendAt, title, body, url, tag, urgent }`. It does no DB or network calls, so it can be unit-tested.
- **Meeting points (required)**: for every group the user belongs to (leader or member), and every meeting point with a `time`, send a reminder at `time - 5 minutes`. Example title "Meeting in 5 minutes", body "After Isha at Gate 79 (King Fahd Gate) · 21:15", plus the note if present. `url` = the group page, `urgent: true`. If the leader **adds a meeting point less than 5 minutes before its time**, send it right away (as long as the time hasn't passed). If the leader **edits or deletes** the point, the old reminder must not fire (see the key rule below).
- **Transfers**: the evening before at 20:00 ("Train to Makkah tomorrow 10:00. Wear ihram before boarding." Add the ihram line only when the destination is Makkah and the ritual's `ihram` is false). Then another 2 h before departure.
- **Hotel check-out**: 20:00 the evening before and 09:00 on the day ("Check-out today from <hotel name>, <city>").
- **Passport**: if any traveller's `passportExpiry` is less than 6 months after `endDate`, send a warning once when the trip is created/updated (or on the next cron run). Repeat 30 days before `startDate` if still not fixed. Name the traveller, never anything else about the passport.
- **Nusuk permit**: daily at 09:00 Riyadh time from 7 days before `startDate`, while the `nusukPermit` checklist item is not done.
- **Prayer times** (opt-in): `minutesBefore` each selected prayer, only on days the user is in Makkah or Madinah per their `stays`, using `prayerTimes(city, date)`.
- Only send a reminder when `sendAt <= now` and `now - sendAt < 15 minutes`. This window keeps a missed cron run from sending stale reminders hours late. Meeting reminders use a 5-minute window.

### 4. Delivery and no duplicates
- New model `NotificationLog` `{ key (unique), userId, sentAt }`, with a TTL index that expires entries after 30 days.
- `key` must be **deterministic** and include the time it is about, e.g. `meeting:<groupId>:<pointId>:<time ISO>:<userId>` or `transfer-eve:<tripId>:<transferId>:<userId>`. If a meeting time is edited, the key changes and the old reminder is never sent. If a point is deleted, it is no longer generated.
- `runDueNotifications(now)`: load only relevant data (trips where `endDate >= now - 1 day` and `startDate <= now + 8 days`, groups with meeting points whose time falls in the next 20 minutes, users with subscriptions), build reminders, skip keys already in `NotificationLog`, **insert the log entry first** (a unique-index error means another run already sent it), then send to all of that user's subscriptions. Send in parallel with a small concurrency limit. Return `{ checked, sent, skipped, failed }` and log it.
- Push payload: `{ title, body, url, tag, icon: '/icon-192.png' }`. Use `TTL` 600 for meeting reminders and 3600 for others, and `urgency: 'high'` for meetings/transfers.

### 5. Client
- Add `client/public/sw.js` (plain service worker, no build step):
  - `push` → `self.registration.showNotification(title, { body, icon, badge, tag, data: { url }, vibrate: [200,100,200], requireInteraction: urgent })`
  - `notificationclick` → close the notification, then focus an open tab with the app or `clients.openWindow(url)`.
  - Register it in `main.jsx` (only if `'serviceWorker' in navigator`).
  - If the project already has a PWA plugin/service worker, extend that one instead.
- New hook `usePushNotifications()`: returns `supported`, `permission`, `subscribed`, `subscribe()`, `unsubscribe()`, `sendTest()`. Use `PushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, with a `urlBase64ToUint8Array` helper.
- New **Notifications settings page** (route `/settings/notifications`, code-split, linked from the nav/profile menu). It has an enable button, a toggle per reminder type, prayer selection + minutes-before, quiet hours and a "Send test notification" button. Build it from the existing `Section`, `Field`, `OptionButton`, `Alert` components.
- Only ask for permission **after the user clicks** a button, never on page load. Explain why first ("Get a reminder 5 minutes before your group's meeting time").
- Handle and show clear states: unsupported browser, permission denied (explain how to re-enable in browser settings), and **iPhone**: Web Push only works when the site is added to the Home Screen (iOS 16.4+). Detect iOS Safari not in standalone mode and show a short "Add to Home Screen" hint. Add a basic `manifest.webmanifest` (name, icons, `display: standalone`) if there isn't one.
- On the **group page**: next to each upcoming meeting point show "🔔 You'll be reminded 5 min before". If push is not enabled, show a small "Turn on reminders" button instead.
- **In-app fallback**: while the group page is open, also set a local `setTimeout` for 5 minutes before the next meeting and show a `new Notification(...)` (or an in-app `Alert` if permission isn't granted). Use the same `tag` as the push, so the user doesn't get two notifications if both fire.

### 6. Tests
- Unit tests `server/tests/reminderService.test.js` with a fixed `NOW`:
  - meeting at 21:15 → reminder at 21:10; not sent at 21:09; sent at 21:10–21:14; not sent at 21:16 (window passed)
  - meeting point without `time` → no reminder
  - meeting added 2 min before its time → sent immediately; meeting already in the past → nothing
  - edited meeting time → different key
  - transfer eve + 2 h reminders; ihram line only for → Makkah when ihram not done
  - check-out reminders; passport < 6 months rule; Nusuk only while not done
  - prayer reminders only on days the user is in that city
  - prefs off → nothing; quiet hours skip non-urgent but keep meeting/transfer/Fajr
- Integration test: the `/api/cron/notifications` endpoint returns 401 without the secret. With `web-push` mocked, it sends a meeting reminder once, and a second run sends nothing (idempotent). A subscription that gets a 410 is deleted.
- Keep all existing tests passing (`npm test` in `server`).

### 7. Docs
- In README: a "Reminders & notifications" section (what is sent and when), new env vars, how to generate VAPID keys, how to add them in Vercel, and **how to set up cron-job.org** to `POST https://<api>/api/cron/notifications` every minute with the `Authorization: Bearer <CRON_SECRET>` header. Also add the new API routes to the API table and mention the iPhone Home Screen requirement.

## Rules
- Never put secrets in code or commit `.env`. Never log subscription keys.
- Never include passport numbers or personal details in notification text (we only store the expiry date anyway).
- Keep logic in services, keep controllers thin, and use `httpError` like the rest of the code.
- Work in small steps: server model + services + tests first, then routes, then the client. Run the tests after each step and show me a summary of the files you changed at the end.
