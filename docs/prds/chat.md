# PRD: In-App Chat (Both Apps)

## 1. Summary

Build-order step 9 (CLAUDE.md: "Chat (start with simple polling; upgrade
to Django Channels/websockets later if needed)"). A per-job chat thread
for coordination between customer and worker during an active job —
explicitly separate from the "Report a problem" dispute flow, which
already exists and is unaffected by this PRD. The `Message` model already
exists in the data model but has zero API or UI wiring; both apps already
have real-but-broken chat entry points sitting in place (a worker button
that just shows "Chat coming soon", a customer icon that isn't even
wired to a press handler, and a customer "Messages" tab that's a static
placeholder). This PRD wires all of it up end to end.

## 2. Current state (as of 2026-08-24)

- **Backend**: `Message` model already exists
  (`backend/jobs/models.py:95-107`) — `job` (FK → `JobRequest`,
  `related_name="messages"`), `sender` (FK → user), `text` (`TextField`),
  `created_at` (`auto_now_add`), `Meta.ordering = ["created_at"]`.
  Registered in Django admin only (`backend/jobs/admin.py`) — no
  serializer, view, or URL exists anywhere in `backend/jobs/serializers.py`,
  `views.py`, or `urls.py`. Fully greenfield API surface.
- **Worker**: `ActiveJobScreen.tsx:116-122` has a real `Pressable` chat
  button already wired to `Alert.alert("Chat coming soon")` — this
  becomes the real entry point. No Messages tab exists in
  `RootTabs.tsx` (Home/Jobs/Bookings/Earnings/Profile) — **per this PRD's
  resolved scope, stays that way**; worker chat is reached only from
  here, not a tab.
- **Customer**: `JobStatusScreen.tsx:87-89` has a chat icon that isn't
  even a `Pressable` — a plain `View` with no `onPress` at all — becomes
  the real entry point. `MessagesScreen.tsx` (27 lines) is a static
  "No messages yet" placeholder — **per this PRD's resolved scope,
  becomes a real inbox** listing job threads.
- **Polling precedent**: `apps/worker/src/offers/useIncomingOfferPolling.ts`
  and `apps/worker/src/waitingForConfirmation/useJobStatusPolling.ts` —
  both follow the same shape: immediate poll on mount, then
  `setInterval`/`clearInterval` inside a `useEffect`, an in-flight ref
  guard against overlapping requests, silent catch-and-retry on
  transient errors, and cleanup tied to unmount/param changes. A new
  message-polling hook follows this exact convention.
- `JobRequest.Status` choices (`backend/jobs/models.py`): `requested,
  searching, matched, accepted, on_my_way, arrived, in_progress,
  awaiting_price_confirmation, completed, cancelled, disputed`.
- `@prizm/api` is one-file-per-resource (`jobs.ts`, `worker.ts`,
  `address.ts`, etc.), all re-exported from `index.ts` — a new
  `messages.ts` follows this convention.
- **No push notification infrastructure exists anywhere** (build-order
  step 11, not started) — chat is polling-only in this PRD, no "new
  message" push.

## 3. Goals

- Backend: a `Message` list/create API scoped to one job, permission-
  checked so only that job's customer or worker can read or send —
  text-only, matching the existing model (no attachments).
- Worker: the existing `ActiveJobScreen` chat button opens a real per-job
  chat screen (send + poll-refreshed receive).
- Customer: `JobStatusScreen`'s chat icon becomes a real `Pressable`
  opening the same per-job chat screen; the **Messages tab becomes a real
  inbox** — every job with an assigned worker, most-recently-active
  first, each row showing the worker's identity + a last-message preview
  (or an empty-state prompt if no messages yet) + relative timestamp,
  tapping into that job's thread.
- Chat is gated on `job.worker` being set (not on a specific status list
  — see §7): reading is always available once a worker is assigned,
  including after the job reaches a terminal state (history isn't lost);
  sending is blocked once the job is terminal.

## 4. Non-goals (explicitly out of scope for this PRD)

- **Push notifications for new messages** — build-order step 11, not
  started; a user only sees a new message by having the chat screen open
  or checking the inbox. Revisit once push lands.
- **Read receipts, typing indicators, online presence** — CLAUDE.md
  explicitly frames this as "start with simple polling"; keep it minimal.
- **Photo/file attachments** — the `Message` model is text-only (`job,
  sender, text`); no model change here.
- **A worker-side Messages tab** — resolved above; worker chat stays
  scoped to `ActiveJobScreen`.
- **WebSockets / Django Channels** — explicitly deferred per CLAUDE.md's
  own phrasing ("upgrade... later if needed").
- **Unread-message badges** on tab icons — no unread-tracking concept
  exists (`Message` has no `read_at`/`is_read` field); adding one is a
  real scope expansion, not bundled here.
- Editing or deleting a sent message.

## 5. Data model / API

No model change — `Message` already exists as specified above.

- `MessageSerializer`: `id`, `sender` (mini identity — `id, full_name,
  photo`, reusing this codebase's existing "public sub-object" pattern
  from `WorkerPublicSerializer`/`CustomerPublicSerializer` in
  `jobs/serializers.py`), `text`, `created_at`. No client-computed
  "is mine" flag — the client already knows its own user id (from
  `profile` in `AuthContext`) and compares it to `sender.id`, matching
  how `JobRequestSerializer` already exposes both `customer` and
  `worker` sub-objects without a role flag.
- `MessageListCreateView` (`ListCreateAPIView`) at
  `/api/jobs/<job_id>/messages/`: `get_queryset` scoped to jobs where
  `request.user` is the job's `customer` or `worker` (permission denied
  otherwise); `perform_create` sets `sender=request.user`, requires
  non-blank `text`, and rejects creation if `job.worker` is `None` or
  `job.status` is terminal (`completed`/`cancelled`/`disputed`).
- **No new "inbox" endpoint** — `JobRequestSerializer` gains a
  `last_message` `SerializerMethodField` (`{text, created_at, sender_id}`
  or `null`), so the customer inbox reuses the existing `listMyJobs`
  fetch (already used by the Jobs tab) instead of a second endpoint or
  N+1 per-row message fetches.

## 6. User flow

### 6a. Worker: `ActiveJobScreen` → `ChatScreen`

- The existing chat button navigates to a new `ChatScreen` (job param)
  instead of showing the "coming soon" alert.
- Message list (bubbles — right-aligned for the worker's own messages,
  left for the customer's, decided by comparing `sender.id` to the
  worker's own user id), text input + send at the bottom, poll-refreshed
  every few seconds while the screen is focused, stopped on blur/unmount
  (same convention as the existing polling hooks).
- Once the job reaches a terminal status, the input area is replaced
  with a brief "This job is closed" note; existing messages stay visible.

### 6b. Customer: `JobStatusScreen` chat icon → `ChatScreen`

- The icon becomes a real `Pressable` navigating to the customer app's
  own `ChatScreen` (job param) — same behavior as the worker side,
  implemented as a separate (not shared) screen file per app, consistent
  with this codebase's established precedent (see the `jobsTab` helpers'
  reasoning in `customer-jobs-tab-and-profile-editing` T1) of not forcing
  a shared abstraction across just two call sites — the chat screen has
  no role-specific business logic to speak of, but sharing full screens
  across apps isn't this codebase's pattern anywhere else either.

### 6c. Customer: Messages tab → real inbox

- Replaces the static placeholder with a list built from the existing
  `listMyJobs` fetch, filtered to jobs where `worker` is present,
  sorted by most recent activity (`last_message.created_at` if present,
  else the job's own `updated_at`) descending.
- Each row: worker avatar + name, last message preview or a "No messages
  yet — say hello" prompt (a job with an assigned worker but zero
  messages still appears — matches how real chat inboxes show a contact
  before the first message), relative timestamp, tap → `ChatScreen(jobId)`.
- Empty state (no jobs with an assigned worker yet): "Messages will
  appear here once you're matched with a worker."

## 7. Technical decisions

- **Chat availability is gated on `job.worker is not None`, not on a
  specific status list.** This is simpler and more robust than
  hardcoding which lifecycle statuses "count" (e.g. guessing whether
  `matched` already has a worker attached) — the moment a worker is
  actually assigned to the job, on either side, chat opens; the backend
  permission check naturally enforces the same rule (a message can't be
  sent by/to a worker who isn't set).
- **Sending closes on terminal status** (`completed`/`cancelled`/
  `disputed`); **reading never closes** — the thread is a permanent
  coordination record for that job, matching this codebase's general
  preference (e.g. the Jobs tab's read-only `JobDetailScreen`) for
  keeping history visible rather than hiding it once a job closes.
- New `packages/api/src/messages.ts`: `Message` type, `listMessages(token,
  jobId)`, `sendMessage(token, jobId, text)` — following the existing
  one-function-per-endpoint convention.
- A new polling hook per app (mirroring `useJobStatusPolling`'s shape),
  not shared across apps — consistent with this codebase's existing
  polling hooks already being separate per app rather than centralized.
- `JobRequestSerializer`'s new `last_message` field is the only change to
  an existing, widely-used serializer — kept to a single
  `SerializerMethodField`, no restructuring of the serializer's existing
  fields.

## 8. Testing strategy

Consistent with prior PRDs: backend `pytest-django` + `factory_boy`,
mobile `jest-expo`, scoped to logic not full-screen rendering.

- **Backend**: a job's customer and worker can both list/create messages
  for it; an unrelated authenticated user gets permission-denied on both;
  creating with blank/whitespace-only text is rejected; creating is
  rejected when `job.worker` is `None`; creating is rejected once
  `job.status` is terminal (reading still succeeds); messages are
  ordered oldest-first; `JobRequestSerializer.last_message` returns
  `null` with no messages and the most recent message's `{text,
  created_at, sender_id}` otherwise.
- **Mobile**: the new polling hook tested the same way as the existing
  offer/job-status polling hooks (immediate poll, interval firing,
  cleanup on unmount); any pure formatting logic extracted for the inbox
  (relative timestamp, last-message truncation) gets its own unit tests.

## 9. Acceptance criteria (summary — full detail in tickets)

- A worker can open the (now-real) chat button on a job with an assigned
  worker and send/receive messages with the customer, polling-refreshed.
- A customer can open the (now-real) chat icon on `JobStatusScreen` for
  the same job and see the identical thread.
- The customer's Messages tab lists every job with an assigned worker,
  most-recently-active first, with a correct last-message preview or
  empty-state prompt, and taps into the right thread.
- Sending is blocked with a visible reason once a job is terminal;
  existing history remains visible either way.
- A user unrelated to a job cannot read or send in its thread via the API.

## 10. Open risks / follow-ups

- The proposed few-second polling cadence may feel slow for something
  framed as "chat" — accepted tradeoff per CLAUDE.md's explicit "start
  with simple polling" instruction; Channels/websockets is the
  already-documented upgrade path if pilot feedback complains.
- No unread-badge/notification concept means a user only learns about a
  new message by having the thread open or checking the inbox — accepted
  for MVP scope (see Non-goals), worth revisiting once push notifications
  (step 11) land.
- No hi-fi mockup exists yet for either chat screen or the inbox rows —
  this PRD's flow section is a reasoned design, not a pixel spec, same
  situation as the customer Jobs tab was before its own gut-check.
