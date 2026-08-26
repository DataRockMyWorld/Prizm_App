# PRD: Push Notifications

Status: Approved for ticketing
Owner: Jewel Bansah
Created: 2026-08-25
Maps to: `PROGRESS.md` build-order step 11

## 1. Summary

Add Expo push notifications so time-sensitive events reach a user whose app
is backgrounded or closed, not just foregrounded. Three events for v1: a
worker receiving a new job offer, a customer's job being accepted by a
worker, and either party receiving a new chat message. This replaces
nothing — all existing polling (offer polling, status polling, chat
polling) stays exactly as-is; push is additive, for the case where polling
isn't running because the app isn't open.

## 2. Current state (as of 2026-08-25)

- **Backend**: no device/push-token field exists on `User` or any related
  model (`backend/accounts/models.py`). Celery is fully wired up
  (`backend/config/celery.py`, Redis broker) but **unused** — no
  `tasks.py` exists anywhere in `backend/`, no `.delay()`/`.apply_async()`
  call exists in the codebase. All `JobRequest` status transitions happen
  synchronously inside DRF views (`backend/jobs/views.py`) and
  `backend/jobs/matching.py` — there are no Django signals anywhere in the
  project (confirmed: no `signals.py`, no `ready()` override in any
  `apps.py`). This PRD is the first real use of Celery.
- **Frontend**: neither app has `expo-notifications` as a dependency,
  and neither `app.json` (`apps/worker/app.json`, `apps/customer/app.json`)
  has the plugin configured or any push-related entitlement. `packages/api`
  has no device-registration endpoint wrapper.
- **iOS signing**: both apps already build to a physical iPhone via Xcode
  (`apps/worker/ios`, `apps/customer/ios` exist as prebuilt native
  projects) under `DEVELOPMENT_TEAM = LZDFN4R8G7` — so an Apple Developer
  account is already in use for code signing. However, both apps'
  `.entitlements` files are currently empty (`<dict/>`) — the Push
  Notifications capability has never been enabled — and there is no EAS
  project anywhere in this repo (no `eas.json`, no `projectId` in either
  `app.json`, `eas` CLI not installed). Whether that Apple ID is enrolled
  in the *paid* Apple Developer Program (required for the APNs push
  entitlement — free/personal-team signing does not support it) is
  unconfirmed. **This needs to be checked together before/at the start of
  implementation** (see T0, §6).
- **Precedent this replaces nothing of**: offer delivery
  (`apps/worker` — a global poll of `GET /api/jobs/worker/incoming/`,
  per `docs/prds/worker-active-job-flow.md` T2), status tracking, and chat
  (`docs/prds/chat.md`) are all polling-based today and stay that way —
  see Non-goals.

## 3. Goals

- A worker who is online but has the app backgrounded/closed still gets
  notified (OS-level push) the moment a job offer is created for them —
  today they'd only see it once the app is foregrounded and the existing
  offer-poll picks it up.
- A customer whose app is backgrounded/closed gets notified the moment a
  worker accepts their job, and tapping the notification opens that job's
  status screen directly.
- Either party in a chat gets notified of a new message when they're not
  the sender, and tapping the notification opens that job's chat thread
  directly.
- Both apps register/refresh their Expo push token with the backend on
  login and app foreground; a device that logs out stops receiving
  another account's pushes on that same device.

## 4. Non-goals (explicitly out of scope for this PRD)

- **Replacing any existing polling.** Offer polling, status polling, and
  chat polling are unchanged — push is a supplement for the
  backgrounded/closed-app case, not a redesign of the foregrounded case.
  (A foregrounded app may show both the OS push banner and its own
  polling-driven UI for the same event — acceptable minor redundancy, not
  fixed in this round.)
- **Full status-stepper coverage.** Only offer-created, offer-accepted,
  and new-message send a push. `on_my_way` / `arrived` / `in_progress` /
  price-proposed / `completed` / dispute-status-change do not, in v1 —
  explicit user decision on 2026-08-25 to keep the trigger set minimal.
- **Real in-app notification preferences.** The Account section's
  "Notification preferences" row stays a `ComingSoonScreen` — explicit
  user decision on 2026-08-25. Users control delivery only via the OS-level
  system permission prompt/settings, not a granular in-app toggle.
- **Unread badges / tab badge counts / read receipts.** Out of scope, same
  as chat's own PRD already deferred these.
- **Android verification.** Code is written against `expo-notifications`'
  cross-platform API (no code fork per platform), so nothing is
  iOS-specific by construction, but no physical Android device has been
  used anywhere in this project to date (see `PROGRESS.md` — iPhone-only
  device testing throughout) and no Firebase/FCM project exists. Android
  delivery is implemented but **unverified** — flagged as an open risk
  (§9), not blocking.
- **Suppressing a chat push when the recipient already has that exact
  thread open.** Nice-to-have; cut for v1 along with unread badges.

## 5. Technical flow

1. **Registration**: on successful login (and on every cold app
   foreground while authenticated), each app requests notification
   permission via `expo-notifications`, obtains an Expo push token
   (`getExpoPushTokenAsync`, requires the EAS `projectId` — see T0), and
   `POST`s it to the backend. The backend upserts a `PushToken` row keyed
   on the token string (so a reinstall or a second device both work
   correctly — a user can have more than one live token).
2. **Sending**: at each of the three trigger points (below), the view
   enqueues a Celery task with the target user's id, a title/body, and a
   small `data` payload (`{type, job_id}`) instead of sending inline —
   keeps the request/response path fast and matches "async jobs" already
   being Celery's stated job in `CLAUDE.md`. The task looks up all
   `PushToken`s for that user and POSTs to Expo's push API
   (`https://exp.host/--/api/v2/push/send`) in one batched call.
3. **Handling on tap**: each app registers an
   `addNotificationResponseReceivedListener`. For `job_offer`, tapping just
   foregrounds the app — the existing global offer-poll hook
   (`worker-active-job-flow` T2) picks the offer up on its own, so no
   custom deep-link route is needed. For `job_accepted` and `chat_message`,
   the listener navigates to that job's status screen / chat screen using
   the `job_id` in the payload, via each app's navigation ref.

## 6. Technical decisions

- **T0 — Apple/EAS credential setup (prerequisite, done together, not
  solo).** Confirm the Apple ID behind team `LZDFN4R8G7` is enrolled in
  the paid Apple Developer Program (required for the Push Notifications
  capability — the existing free/personal-team-style signing used for
  `expo run:ios --device` today does not support it). Install the `eas`
  CLI, `eas login`, `eas init` in both `apps/worker` and `apps/customer`
  to create/link an EAS project (adds `extra.eas.projectId` to each
  `app.json`), then let EAS manage the APNs auth key (`eas credentials`)
  rather than hand-uploading one. This is an interactive step (Apple ID
  login, Expo account login) — can't be scripted solo.
- **T1 — Backend: new `notifications` app.** A `PushToken` model
  (`user` FK, `token` unique, `platform`, timestamps) and
  `notifications/tasks.py` with a single `send_push_notification(user_id,
  title, body, data)` Celery task. New app rather than bolting onto
  `accounts` — this is used by both `jobs` and `accounts` (registration is
  account-level, sending is triggered from `jobs`), and matches
  `notifications/tasks.py` being the natural home for the project's first
  Celery task.
- **T2 — Registration endpoint.** `POST /api/notifications/register-device/`
  (upsert by token) and `DELETE /api/notifications/register-device/` (called
  on logout, deletes that device's token row) — the delete matters because
  a push token is device-bound, not session-bound; without it, a second
  account logging into the same physical device would keep receiving the
  first account's job pushes.
- **T3 — Trigger points, called directly (no signals), matching the
  existing synchronous-in-view pattern** (this codebase has never used
  Django signals — not introducing them here either):
  - `backend/jobs/matching.py` `try_match()`, right after the
    `JobOffer.objects.create(...)` call (currently lines ~66–69) → push to
    the candidate worker, `type: "job_offer"`.
  - `backend/jobs/views.py` `AcceptOfferView.post` (currently lines
    ~325–328, right after `job.status = JobRequest.Status.ACCEPTED` is
    saved) → push to `job.customer`, `type: "job_accepted"`.
  - `backend/jobs/views.py` `MessageListCreateView.post` (currently lines
    ~300–302, right after `Message.objects.create(...)`) → push to
    whichever of `job.customer_id`/`job.worker_id` is *not*
    `request.user.id`, `type: "chat_message"`.
- **T4 — Shared registration/listener hook.** The permission-request +
  token-registration + tap-response-listener logic is identical between
  the two apps modulo which navigation ref to call — add a
  `usePushNotifications(navigationRef)` hook to `packages/api` (already
  the home for every other backend-integration concern) taking the app's
  nav ref as a parameter, used identically from both apps' root
  component. Avoids duplicating ~60 near-identical lines twice.
- **T5 — `app.json` changes (both apps).** Add the `expo-notifications`
  config plugin to `plugins`, which regenerates the iOS entitlements with
  `aps-environment` on the next native build — requires re-running
  `npx expo run:ios --device` after this ticket, not just a Metro reload.

## 7. Testing strategy

Following the stack already established in `worker-active-job-flow` and
kept since (`pytest-django` + `factory_boy` backend, `jest-expo` +
`@testing-library/react-native` frontend, logic-only on the frontend side,
no CI yet):

- **Backend**: `backend/notifications/tests/` — `PushToken` upsert-by-token
  behavior (register twice with the same token doesn't duplicate rows;
  registering the same token for a different user reassigns it, covering
  the shared-device/re-login case), the register/delete endpoint's
  auth/ownership checks, and the `send_push_notification` task with Expo's
  HTTP call mocked (never hit the real Expo push API in tests). Add test
  cases to `backend/jobs/tests/` for each of the three trigger points —
  assert the task is enqueued with the right user id and `type`, using
  Celery's eager/mock task-call assertion, not a real broker round-trip.
- **Frontend**: extract the token-registration and tap-payload-routing
  logic as plain functions (e.g. `getNotificationRoute(data)` — maps a
  payload's `type`/`job_id` to a navigation action) so it's unit-testable
  without rendering a component tree or a real `expo-notifications`
  runtime, matching this project's existing logic-not-rendering testing
  policy.
- **Manual device pass** (this category of feature can't be meaningfully
  covered by automated tests — real push delivery, OS permission prompts,
  and backgrounded-app wake-up only happen on a real device with real
  APNs credentials): after T0–T5 land, click-test on the physical iPhone —
  background/kill each app in turn and confirm all three trigger events
  arrive and tap-navigate correctly.

## 8. Acceptance criteria (summary — full detail in tickets)

- Both apps request notification permission and register an Expo push
  token with the backend on login; logging out removes that device's
  token.
- A worker offer, once created, results in a push to that worker even
  with the app backgrounded, within a few seconds.
- A customer's job being accepted results in a push to that customer even
  with the app backgrounded; tapping it opens that job's status screen.
- A new chat message results in a push to the non-sending party even with
  the app backgrounded; tapping it opens that job's chat thread.
- No push is sent to the message's own sender.
- Existing polling behavior (offers, status, chat) is unchanged.

## 9. Open risks / follow-ups

- **Apple Developer Program enrollment is unconfirmed** — if the Apple ID
  behind `LZDFN4R8G7` turns out to be a free/personal team, push can't
  ship on iOS until that's upgraded. Must be resolved in T0 before any
  other ticket in this round can be verified end-to-end.
- **Android is implemented but unverified** — no physical Android device
  or FCM project exists in this project yet; revisit if/when Android
  device testing becomes a priority.
- Foreground redundancy (OS banner + existing polling UI both firing for
  the same event) is accepted as-is, not solved, in this round.
- If a granular in-app notification-preferences screen is wanted later,
  it's a fast-follow on top of this round's `PushToken` model (e.g. add a
  `notify_job_offers`/`notify_chat` boolean per token or per user), not a
  rebuild.
