# Tickets: Push Notifications

PRD: `docs/prds/push-notifications.md`

Implement in order — each ticket should be its own commit (or small PR),
reviewed before moving to the next. Later tickets depend on earlier ones
as noted. **Every ticket below has a "Tests" subsection** (except T0,
which is credential setup, not code) — a ticket isn't done until those
tests exist and pass, per PRD §7.

---

### T0 — Apple Developer / EAS credential setup ⏸️ Blocked (2026-08-26)

**Finding:** `jewelbansah@icloud.com` is on a **Personal Team only — no
paid Apple Developer Program membership**. Push Notifications is a
capability Apple restricts to paid Program membership; there is no
workaround. Also surfaced but not the blocker: the existing
`ios/*.xcodeproj` project files reference signing team `LZDFN4R8G7`,
which doesn't match the keychain's only valid identity
(`862V45CWK2`, this Apple ID's personal team) — likely stale from an
earlier signing session, hasn't broken existing device builds, not
investigated further since it's moot until enrollment happens anyway.

**User decision (2026-08-26): pause here**, same treatment as build-order
step 10 (mobile money). Resume once the Apple ID (this one, or another)
is enrolled in the paid Program — `eas login` already has a valid cached
session for this project's Expo account (`juelzgh`), and `npx eas-cli`
works without a global install, so the remaining steps below are quick
once enrollment clears.

**Depends on:** nothing, but **must happen before T5–T7 can be verified
end-to-end** — do this first or in parallel with T1–T4 (backend work
doesn't need it). **Interactive — needs your Apple ID / Expo account
login, can't be done solo.** **Touches:** `apps/worker/app.json`,
`apps/customer/app.json` (new `extra.eas.projectId`), new
`apps/worker/eas.json`, `apps/customer/eas.json`.

- Confirm the Apple ID behind the existing signing team `LZDFN4R8G7`
  (already used for `expo run:ios --device` today, per both apps'
  `ios/*.xcodeproj/project.pbxproj`) is enrolled in the **paid** Apple
  Developer Program — required for the Push Notifications capability;
  free/personal-team signing can't use APNs.
- Install the `eas` CLI (`npm install -g eas-cli` or `npx eas-cli`),
  `eas login`.
- `eas init` in `apps/worker` and separately in `apps/customer` to
  create/link an EAS project for each (adds `extra.eas.projectId` to
  each `app.json`).
- `eas credentials` (iOS, each app) — let EAS generate and manage the
  APNs auth key rather than hand-uploading one from the Apple Developer
  portal.

**Acceptance criteria**
- Both `app.json`s have a real `extra.eas.projectId`.
- `eas credentials` shows a push key provisioned for both apps' iOS
  bundle identifiers (`com.juelzgh.prizm-worker`,
  `com.juelzgh.prizm-customer`).

---

### T1 — Backend: `notifications` app, `PushToken` model, register/delete endpoint ✅ Done

**Implementation notes:** upsert-by-token uses `update_or_create(token=...,
defaults={user, platform})` exactly as specced — reassigns a token already
owned by a different user rather than erroring, verified by test. `DELETE`
scopes its queryset to `token=... AND user=request.user`, so it silently
no-ops (204) on someone else's token or a nonexistent one, never leaking
which. 8/8 tests pass (`backend/notifications/tests/test_register_device.py`).

**Depends on:** nothing. **Touches:** new `backend/notifications/`
(new Django app), `backend/config/settings.py` (`INSTALLED_APPS`),
`backend/config/urls.py`.

- New Django app `notifications` (`django-admin startapp notifications`
  inside `backend/`, or by hand matching the existing apps' structure).
- `PushToken` model: `user` (FK to `settings.AUTH_USER_MODEL`,
  `related_name="push_tokens"`), `token` (`CharField`, `unique=True`),
  `platform` (`CharField`, choices `ios`/`android`), `created_at`,
  `updated_at`. Migration.
- `POST /api/notifications/register-device/` — body
  `{ token, platform }`, `IsAuthenticated`. Upsert **by token**: if the
  token already exists, reassign it to `request.user` (covers the
  shared-device/re-login case from PRD §6/T2) and update `platform`;
  otherwise create it against `request.user`.
- `DELETE /api/notifications/register-device/` — body `{ token }`,
  `IsAuthenticated`. Deletes that token row if it belongs to
  `request.user` (404/no-op if it doesn't exist or belongs to someone
  else — don't leak whether a token exists for another user).
- Wire both into `backend/config/urls.py` under `/api/notifications/`.

**Acceptance criteria**
- Registering the same token twice (same user) doesn't create a
  duplicate row.
- Registering a token that already belongs to a different user
  reassigns it to the new caller (not a 409/error — this is the expected
  shared-device path).
- `DELETE` only removes the caller's own token row.

**Tests** (`backend/notifications/tests/`, using T0a-style
`pytest-django` + `factory_boy` factories from `backend/accounts/tests/
factories.py`)
- Register a new token → row created, correct `user`/`platform`.
- Register the same token again (same user) → still exactly one row.
- Register a token already owned by user A, as user B → row now belongs
  to user B, still exactly one row.
- `DELETE` own token → row removed, 200/204.
- `DELETE` someone else's token (or a nonexistent one) → no row deleted
  for another user, doesn't error/leak.
- Unauthenticated request to either endpoint → 401.

---

### T2 — Backend: `send_push_notification` Celery task ✅ Done

**Implementation notes:** sends **one** batched POST to Expo's push API
per call (an array of per-token messages), confirmed by test. `requests`
added to `backend/requirements.txt` (wasn't a dependency anywhere before
— confirmed via `import requests` failing in the container pre-change).
Verified this is genuinely the project's first working Celery task, not
just configured-but-unverified: ran a real smoke test from a Django shell
(`send_push_notification.delay(...)` against a throwaway user, `.get()`d
the result) — `celery.py`'s `autodiscover_tasks()` picked it up and the
worker executed it end-to-end (`SUCCESS`), confirming the whole
Redis-broker → worker → task chain actually works, not only that
`docker compose ps` shows the celery container up. Throwaway user deleted
after. 4/4 tests pass (`backend/notifications/tests/test_tasks.py`),
mocking `requests.post` — no real Expo API calls in the test suite.

**Depends on:** T1 (needs `PushToken` to look up recipients). **Touches:**
`backend/notifications/tasks.py`.

- `@shared_task def send_push_notification(user_id: int, title: str,
  body: str, data: dict)`.
- Looks up all `PushToken.objects.filter(user_id=user_id)`; if none,
  no-op (user has no registered device — not an error).
- POSTs one batched request to Expo's push API
  (`https://exp.host/--/api/v2/push/send`) with one message per token
  (`{to: token, title, body, data}` per Expo's documented payload
  shape), using `requests` (already a transitive dependency via other
  packages — confirm, or add it explicitly to
  `backend/requirements.txt` if not already present).
- On a per-token `DeviceNotRegistered` error in Expo's response, delete
  that `PushToken` row (stale token cleanup) — don't fail the whole task
  over one bad token among several.
- This is the project's **first** Celery task — confirm
  `backend/config/celery.py`'s `autodiscover_tasks()` actually picks it
  up (it should, since it's stated to already call that, but this is the
  first real chance to verify it works, not just that it's configured).

**Acceptance criteria**
- Calling the task for a user with 2 registered tokens sends 2 messages
  to Expo's API in one call (or two calls — either is fine, just confirm
  which and document it).
- Calling the task for a user with 0 tokens is a silent no-op, not an
  error.
- `celery -A config worker` (via `docker compose exec celery ...` or
  equivalent) actually picks up and runs the task when enqueued via
  `.delay(...)` from a Django shell — a real smoke test, not just
  "the code compiles."

**Tests** (`backend/notifications/tests/test_tasks.py`, mocking the
Expo HTTP call — **never hit the real Expo push API in tests**)
- 0 tokens → the mocked HTTP client is never called.
- 2 tokens → one call (or two, matching whichever the implementation
  does) with both tokens' payloads present.
- A mocked `DeviceNotRegistered` response for one token → that
  `PushToken` row is deleted, the task doesn't raise.

---

### T3 — Backend: wire the three trigger points ✅ Done

**Implementation notes:** all three sites match the PRD's exact line
references (`matching.py` `try_match()`, `views.py`
`AcceptOfferView.post`, `views.py` `MessageListCreateView.post`), each
calling `.delay(...)` (async, doesn't block the response). Confirmed via
test that a message's own sender never receives a push for their own
message (recipient is computed as "whichever of customer/worker is not
`request.user.id`"). 4/4 new tests pass
(`backend/jobs/tests/test_push_notifications.py`), and the full existing
suite (47/47) still passes unmodified — this ticket was purely additive
to the three call sites, no existing response shape/status code changed.

**Depends on:** T2. **Touches:** `backend/jobs/matching.py`,
`backend/jobs/views.py`.

- `matching.py` `try_match()`, right after `JobOffer.objects.create(...)`
  (currently lines ~66–69): enqueue
  `send_push_notification.delay(candidate.id, title="New job offer",
  body=f"{job.category.name} nearby", data={"type": "job_offer",
  "job_id": job.id})`.
- `views.py` `AcceptOfferView.post`, right after `job.status =
  JobRequest.Status.ACCEPTED` is saved (currently lines ~325–328):
  enqueue `send_push_notification.delay(job.customer_id, title="Job
  accepted", body=f"A worker is on the way for your {job.category.name}
  request", data={"type": "job_accepted", "job_id": job.id})`.
- `views.py` `MessageListCreateView.post`, right after
  `Message.objects.create(...)` (currently lines ~300–302): enqueue
  `send_push_notification.delay(recipient_id, title=f"New message from
  {sender_name}", body=message.text[:120], data={"type": "chat_message",
  "job_id": job.id})`, where `recipient_id` is whichever of
  `job.customer_id`/`job.worker_id` is **not** `request.user.id`.
- Use `.delay(...)` at all three sites (async — don't block the
  request/response path on Expo's API).

**Acceptance criteria**
- All three existing endpoints' response shape/status codes are
  unchanged — this ticket only adds a fire-and-forget task enqueue, no
  behavior visible to the caller changes.
- A message's own sender never receives a push for their own message.

**Tests** (extend `backend/jobs/tests/`, mocking/asserting on the
Celery task call — e.g. `@mock.patch("jobs.matching.send_push_
notification.delay")` — no real broker round-trip needed)
- `try_match` creates an offer → task enqueued with the candidate
  worker's id and `type: "job_offer"`.
- `AcceptOfferView` accepts → task enqueued with the job's customer id
  and `type: "job_accepted"`.
- `MessageListCreateView` — customer sends a message → task enqueued
  targeting the worker (not the customer); worker sends → targets the
  customer.
- Existing tests for these three views/functions (from earlier PRDs)
  still pass unmodified — this is additive, not a behavior change to
  guard against regressing.

---

### T4 — `packages/api`: device registration + notification-route logic ✅ Done

**Implementation notes:** matches spec exactly — `registerDevice(token,
expoPushToken, platform)` and `unregisterDevice(token, expoPushToken)`
follow this package's existing `token`-first convention (JWT auth token
for the `Authorization` header, matching `getProfile(token)` etc.);
`getNotificationRoute` is a pure function with no RN/expo-notifications
dependency. 6/6 tests pass
(`packages/api/src/notifications.test.ts`), both apps' typecheck clean.

**Depends on:** T1 (endpoint shape). **Touches:**
`packages/api/src/notifications.ts` (new file), `packages/api/src/
index.ts`.

- `registerDevice(token: string, expoPushToken: string, platform:
  "ios" | "android")` → `POST /api/notifications/register-device/`.
- `unregisterDevice(token: string, expoPushToken: string)` →
  `DELETE /api/notifications/register-device/`.
- `getNotificationRoute(data: { type: string; job_id: number })` — a
  **plain function**, not tied to any navigation library — maps a
  notification payload to a description of where to navigate:
  returns `null` for `job_offer` (per PRD §5 — tapping it just
  foregrounds the app, the existing offer-poll hook takes over, no
  explicit navigation needed), and a `{ screen: "JobStatus" | "Chat",
  jobId: number }`-shaped value for `job_accepted`/`chat_message`. Kept
  as a pure function so it's unit-testable without a real
  `expo-notifications` runtime or a navigation ref (per PRD §7).

**Acceptance criteria**
- Typed against existing conventions in this package (no `any`);
  typecheck passes.

**Tests** (`packages/api/src/notifications.test.ts`, mocked `fetch` for
the two API functions; no mocking needed for the pure function)
- `registerDevice`/`unregisterDevice` call the correct method + path
  with the correct body shape.
- `getNotificationRoute`: `job_offer` → `null`; `job_accepted` →
  `{ screen: "JobStatus", jobId }`; `chat_message` → `{ screen: "Chat",
  jobId }`; an unrecognized `type` → `null` (defensive fallback, doesn't
  throw).

---

### T5 — Frontend: `expo-notifications` dependency + native config

**Depends on:** T0. **Touches:** `apps/worker/package.json`,
`apps/customer/package.json`, `apps/worker/app.json`,
`apps/customer/app.json`.

- Add `expo-notifications` to both apps' dependencies (`npx expo install
  expo-notifications` in each, so the version matches the installed
  Expo SDK).
- Add the `expo-notifications` config plugin to each `app.json`'s
  `plugins` array.
- Re-run `npx expo run:ios --device` for both apps (native config
  change — a Metro-only reload won't regenerate the entitlements).

**Acceptance criteria**
- Both apps' `ios/*/*.entitlements` now contain `aps-environment`
  (confirm by reading the file after the rebuild — currently both are
  empty `<dict/>`).
- Both apps still launch and run correctly on the physical iPhone after
  the rebuild (regression check — this ticket touches native config for
  both apps).

**Tests:** none (dependency/config-only ticket, no new logic) — verified
by the acceptance criteria above instead.

---

### T6 — Frontend: `usePushNotifications` hook, wired into both apps

**Depends on:** T4, T5. **Touches:** `packages/api/src/
usePushNotifications.ts` (new file), `apps/worker/App.tsx` (or
equivalent root component), `apps/customer/App.tsx`.

- `usePushNotifications(navigationRef)`:
  - On mount (while authenticated), request notification permission via
    `expo-notifications`; if granted, call `getExpoPushTokenAsync({
    projectId })` (using each app's `extra.eas.projectId` from T0) and
    `registerDevice(...)` (T4) with the result.
  - Register an `addNotificationResponseReceivedListener` that calls
    `getNotificationRoute(data)` (T4) and, if non-null, dispatches a
    navigation action on `navigationRef` to the returned screen/`jobId`.
  - On logout, call `unregisterDevice(...)` with the last-known token
    (store it in the same auth-session storage `@prizm/api` already uses
    for tokens, e.g. alongside the JWT in `SecureStore`).
- Call this hook identically from both apps' root component, passing
  each app's own `navigationRef`.

**Acceptance criteria**
- Logging in on a fresh install prompts for notification permission and
  results in a `PushToken` row on the backend (verify via Django admin
  or shell).
- Logging out removes that device's token row.
- Denying the permission prompt doesn't crash or block login — the app
  just proceeds without a registered token.

**Tests** (`apps/worker` and/or a shared location if the hook ends up
testable without RN-specific mocking beyond what T0b's jest-expo setup
already provides — extract any branching logic, e.g. "only register if
permission was granted," as a plain function first if it isn't already
covered by T4's pure functions)
- Permission denied → `registerDevice` is not called.
- Permission granted → `registerDevice` is called with the token from
  `getExpoPushTokenAsync` (mocked).
- A received notification response with a `job_offer` payload does not
  trigger a navigation dispatch (per `getNotificationRoute`'s `null`);
  `job_accepted`/`chat_message` payloads do, to the correct screen/params.

---

### T7 — Manual device click-test pass

**Depends on:** T3, T6 (everything else). **Touches:** nothing (manual
verification only — this is the PRD §7 "can't be meaningfully covered by
automated tests" pass).

- Background (not force-quit) the worker app, trigger a job offer from
  the customer side → push arrives, tapping it foregrounds the app and
  the existing offer interrupt (from `worker-active-job-flow` T3)
  appears via the resumed poll.
- Background the customer app, accept that offer as the worker → push
  arrives, tapping it opens that job's status screen directly.
- Background either app, send a chat message from the other side → push
  arrives, tapping it opens that job's chat thread directly.
- Force-quit (not just background) each app and repeat the three checks
  above — background and force-quit can behave differently for push
  delivery/tap-routing on iOS.
- Send a chat message as the sender → confirm the sender's own device
  does *not* receive a push for their own message.
- Log out on one device, log in as a different user on the same
  physical device → confirm the first user's job/chat events no longer
  produce pushes on that device.

**Acceptance criteria**
- All six checks above pass on the physical iPhone.

---

## Suggested implementation order

T0 (start immediately, in parallel with everything else — it's the only
interactive/non-solo step and has the longest lead time) → T1 → T2 → T3
(backend chain) can proceed independently of T0. T4 only needs T1's
endpoint shape, not T0. T5 needs T0 to be complete. T6 needs both T4 and
T5. T7 (manual pass) needs T3 and T6 — i.e. everything else — done.
