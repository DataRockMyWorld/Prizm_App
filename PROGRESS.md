# Prism — Progress & Resume Notes

Last updated: 2026-08-24. See `CLAUDE.md` for full project context, brand,
and business rules — this file just tracks build status and how to pick
the work back up.

## Where things stand vs. the CLAUDE.md build order

| # | Step | Status |
|---|------|--------|
| 1 | Django project + core models + PostGIS | ✅ Done |
| 2 | Auth endpoints (phone/OTP/PIN, JWT) | ✅ Done |
| 3 | Django admin review queue (ID + certification) | ✅ Done |
| 4 | Job lifecycle API + matching logic | ✅ Done |
| 5 | Expo monorepo scaffold | ✅ Done |
| 6 | Auth screens → wire to API | ✅ Done, both apps — confirmed live on a physical iPhone |
| 7 | Customer request flow → wire to API | ✅ Done, click-tested end-to-end on a physical iPhone (submission → matched → tracking → price agreement → rating), worker side simulated via Django shell |
| 8 | Worker active-job flow → wire to API | ✅ Done — see `docs/prds/worker-active-job-flow.md` / `docs/tickets/worker-active-job-flow.md`, all tickets T0a–T7 complete |
| 9 | Chat (polling) | ✅ Done — see `docs/prds/chat.md` / `docs/tickets/chat.md`, all tickets T1–T5 complete |
| 10 | Mobile money payment | ⬜ Not started (intentionally stubbed) |
| 11 | Push notifications | ⬜ Not started |
| 12 | Device testing / pilot rollout | ✅ Both apps running as native dev-client builds on a physical iPhone (see below) |

Beyond the original build order, two follow-up PRD/ticket rounds are done:
- `docs/prds/customer-jobs-tab-and-profile-editing.md` /
  `docs/tickets/customer-jobs-tab-and-profile-editing.md` — T1 (customer
  jobsTab logic), T2 (customer Jobs tab list + detail, replacing the old
  Requests/Bookings placeholders), and T3 (photo + name editing on both
  apps' Profile screens) are all done and committed.
- `docs/prds/profile-redesign.md` / `docs/tickets/profile-redesign.md` —
  the fuller hi-fi Profile redesign (gradient hero, badges, rating, stats,
  Services-offered editor, Certifications list, Saved addresses CRUD).
  All 7 tickets (T1–T7) done and committed.

This also completes build-order step 9 itself:
`docs/prds/chat.md` / `docs/tickets/chat.md` — per-job chat thread, both
apps' entry points (worker's `ActiveJobScreen` chat button, customer's
`JobStatusScreen` chat icon) now real instead of fake/broken, plus a real
inbox on the customer's Messages tab. All 5 tickets (T1–T5) done and
committed — see "What's actually built" below and "Immediate next steps"
for the still-outstanding live click-test (this round included; nothing
built across either of these two PRDs has been tapped through on a real
device/simulator yet).

## What's actually built

**Backend** (`backend/`, Django + DRF, runs via `docker compose up -d` from
repo root): full data model, phone/OTP/PIN auth with JWT, a Django admin
review queue for worker ID + certification approval, and the full job
lifecycle API (create → sequential single-offer matching with
Verified/Certified priority → accept/decline offer → status stepper →
price confirm/dispute → rate). MinIO (S3-compatible) for file storage,
CORS enabled for local dev. `ProfileView`/`ProfileSerializer` already
supports `PATCH` for `full_name`/`photo`/`biometric_enabled`.
`WorkerProfileSerializer` supports `PATCH` for `categories` (used by the
worker Profile tab's Services-offered editor) and now also exposes
computed `jobs_completed`/`rating_average`; a new `CustomerProfileView`
(`/api/auth/customer-profile/`) exposes `requests_completed`; a new
`Address` model + CRUD API (`/api/auth/addresses/`) backs Saved
addresses — all added in `profile-redesign` T1/T2. The `Message` model
(job, sender, text — pre-seeded in the original data model but unwired
until now) has a real scoped list/create API at
`/api/jobs/<id>/messages/` (`chat` T1), gated on a worker being assigned
and the job not yet being terminal; `JobRequestSerializer` gained
`last_message` to power the customer inbox without a second endpoint.
`ServiceCategoryListView` (`/api/services/categories/`) exists for
category pickers.

**Shared packages** (`packages/`):
- `@prizm/ui` — design tokens (brand gradient, Manrope type, spacing) and
  primitives (Button, Card, TextField, OtpInput, PinDots, Avatar,
  UploadTile, BrandHeader, SplashView, Badge, **ProfileHeader** — avatar +
  inline name editing, shared by both apps' Profile screens, plus an
  `inverse` prop (added in `profile-redesign` T3) for use atop a dark/
  gradient background — **StatCard** and **ProfileHero** (also T3, the
  worker/customer Profile heroes) — etc.), including the real Prism logo.
  `pageBackground` color token is `Screen`'s default background — a shade
  darker than white so `Card`s (still pure white) have visible contrast.
- `@prizm/api` — fetch client, `SecureStore`-backed auth session, typed
  functions for every backend endpoint. `getApiUrl()` (`client.ts`) now
  treats a `localhost`/`127.0.0.1` Metro dev-server host as untrustworthy
  (happens when a device connects via `expo run:ios --device` over USB)
  and falls back to `EXPO_PUBLIC_API_URL` instead — see Environment
  gotchas below.
- `@prizm/auth-flow` — the shared phone → OTP → PIN → biometric → profile
  onboarding screens, used identically by both apps.

**apps/worker**: full onboarding, Home, ID upload → certifications →
under-review flow, full active-job flow (incoming offer → accept/decline
→ on-my-way/arrived/in-progress → mark complete → propose price → wait
for confirmation → done), a redesigned **Jobs tab** (Active/Completed,
colored status rails, date grouping, tap into either the live screen or
a read-only Job Record detail screen), and a redesigned **Profile**
(gradient hero with photo/name/categories/Verified+Certified
badges/rating+jobs-completed, 2-stat card, editable Services-offered
chips, Certifications list with a working add flow reachable from the
Profile tab now too — not just onboarding). `ActiveJobScreen`'s chat
button now opens a real per-job chat screen (poll-refreshed) instead of
an "coming soon" alert. 5-tab bar (Home/Jobs/Bookings/Earnings/Profile;
Bookings/Earnings are still placeholders — not real product concepts
yet, see CLAUDE.md's dropped-scope notes).

**apps/customer**: full onboarding, Home (category grid, search bar —
still decorative), the full request flow (submission → searching/
matching → matched → job status tracking → report-a-problem → price
agreement → rating, with a back button on the tracking screen now, and a
"Use a saved address" picker on the submission screen), a **Jobs tab**
(replaces the old Requests/Bookings placeholders — same Active/Completed
pattern as the worker app, adapted: cards show the assigned worker's
identity, no earnings-style stat, rating framed as what the customer
gave), and a redesigned **Profile** (calm hero with photo/name/member-
since, 2-stat card, and full CRUD **Saved addresses**). `JobStatusScreen`'s
chat icon (previously not even wired to a press handler) now opens the
same real chat screen the worker side uses; the **Messages tab is a real
inbox now** — every job with an assigned worker, most-recently-active
first, last-message preview, tap into the thread. 4-tab bar (Home/Jobs/
Messages/Profile).

## Physical iPhone builds — working

Both apps run as native dev-client builds on a physical iPhone (in
addition to the iOS Simulator, which is also still used for quick
checks). See "One-time setup" below (unchanged from before) for the
Xcode/CocoaPods/Ruby setup this required.

**Two ways to connect the phone, and a gotcha specific to one of them:**
- **LAN/Wi-Fi** (`npx expo start --dev-client -c`, phone on the same
  Wi-Fi network): `getApiUrl()` correctly derives the backend host from
  Metro's own LAN IP. No `.env` changes needed.
- **USB via Xcode** (`npx expo run:ios --device`, or reopening an
  already-installed dev client that was last connected this way): Metro
  gets tunneled through USB and reports itself as `localhost` to the JS
  runtime — that tunnel only forwards Metro's own port, not the Django
  backend's, so **every API call silently points at the phone itself**
  unless `EXPO_PUBLIC_API_URL` is set. Fixed two ways together: (1)
  `getApiUrl()` now distrusts a `localhost`/`127.0.0.1` dev-server host
  and falls back to the env var, (2) both apps' `.env` have
  `EXPO_PUBLIC_API_URL=http://<this Mac's current LAN IP>:8000`
  uncommented — **keep that IP in sync with `ipconfig getifaddr en0`** if
  it ever changes (DHCP drift bit this project before).

**To (re)install after a fresh clone or a native-code change:**
```
cd apps/worker && npx expo run:ios --device      # or apps/customer
```
**To just restart Metro for a build already installed on the phone:**
```
cd apps/worker && npx expo start --dev-client -c
```

## Environment gotchas (read before resuming)

- **Node isn't on the system PATH** — installed via `nvm`. Fresh terminal:
  `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"` if `node -v` fails.
- **Backend**: `docker compose up -d` from the repo root. Check
  `docker compose ps` — should show `backend`, `celery`, `db`, `redis`,
  `minio` all healthy/up.
- **LAN IP drift**: compare `ipconfig getifaddr en0` against
  `EXPO_PUBLIC_API_URL` in both apps' `.env` (see USB gotcha above) and
  against `DJANGO_ALLOWED_HOSTS` in the root `.env` if that's ever set to
  something other than `*` (currently unset, defaults to `*` under
  `DEBUG=True`, so this rarely bites — but check if 401s/network errors
  show up after a long session).
- **Uploads are now collision-safe.** Previously every upload (profile
  photo, job photo, ID document, certification) used a hardcoded generic
  client-side filename, and S3/MinIO overwrites same-named objects by
  default — so every user's profile photo silently overwrote every other
  user's. Fixed via `unique_upload_path()` in
  `backend/config/storage_backends.py`. If you're ever debugging "wrong
  photo showing up," this class of bug is already closed — look
  elsewhere first.
- **`EXPO_PUBLIC_USE_RN_FETCH=1`** is set in both apps' `.env` — required,
  don't remove (SDK 56+'s `expo/fetch` can't send `FormData`).
- **`.env` files are gitignored** — `.env.example` in each app documents
  what's needed.
- Two Expo dev servers run side by side: worker on port 8081, customer on
  port 8082 (`--port 8082` flag).
- **JWT access tokens expire after 30 min with no auto-refresh mid-
  session** — a real, still-unfixed gap. If a long-idle app session starts
  throwing 401s, that's why; relaunching the app re-triggers the
  refresh-token flow on mount and clears it. Low priority unless it comes
  up again.

## Immediate next steps, in order

1. **Live-test everything built across the last two PRDs on-device — none
   of it has been click-tested yet, this round included.** Both
   `profile-redesign` (T1–T7) and `chat` (T1–T5) were implemented,
   backend-verified (pytest + live curl round trips against the local
   Docker backend for every new endpoint), and confirmed to typecheck and
   Metro-bundle cleanly on both apps, but nothing has been tapped through
   on a real device/simulator — no UI automation tool was available in
   any of these sessions (no `idb`/`cliclick`, and AppleScript/
   System-Events window control needs an Accessibility permission grant
   that couldn't be given non-interactively). Specifically worth checking:
   - **Worker Profile**: gradient hero contrast/legibility (name + Edit
     link are white-on-gradient via `ProfileHeader`'s new `inverse` prop —
     never visually confirmed), stat-card overlap with the hero's rounded
     bottom edge, Services-offered chip add/remove, and the "+ Add another
     certificate" flow returning cleanly to the Profile screen (this also
     touched/fixed a pre-existing bug in the onboarding
     `CertificationsScreen` — worth confirming onboarding itself still
     behaves correctly too, not just the new Profile-tab entry point).
   - **Customer Profile**: calm hero's soft gradient glow behind the
     avatar (approximated as a flat low-opacity circle, not a true blur —
     known rough edge), Saved-addresses add/edit/delete, delete
     confirmation dialog.
   - **Saved-address picker** on `RequestSubmissionScreen` — selecting a
     saved address should fill the address field and remain editable
     after.
   - **Chat, both sides**: worker's `ActiveJobScreen` chat button and
     customer's `JobStatusScreen` chat icon both open the same underlying
     thread for a given job — send from one, confirm it appears on the
     other within a few seconds (poll interval). Check the plain-
     `ScrollView`-based bubble list actually anchors to the bottom on new
     messages (chose this over an `inverted FlatList` specifically to
     avoid a transform-flip bug class that's hard to verify blind — worth
     confirming the simpler approach reads correctly). Check the "This
     job is closed" state on a terminal job, and that a job with an
     assigned worker but zero messages still shows up correctly in the
     customer's Messages inbox ("No messages yet — say hello" row).
   - This also folds in the still-outstanding item from before the
     profile-redesign detour: **T2 (customer Jobs tab) + T3 (photo/name
     editing)** never got a combined on-device pass either — do all of it
     in one session rather than four separate passes.
2. Steps 10–11 (mobile money payment, push notifications) after the
   live-test pass above, per CLAUDE.md's build order — chat (step 9) is
   now done.

## Known loose ends / things to revisit

- JWT 30-min expiry / no mid-session refresh — see Environment gotchas.
- Customer Home's search bar is decorative (`editable={false}`) — no
  search endpoint exists yet.
- No hi-fi mockup existed for the customer Jobs tab (T2) when it was
  built — it's a reasoned adaptation of the worker app's Jobs tab, not a
  pixel spec. Worth a visual gut-check with the user if/when a customer
  Jobs-tab mockup ever surfaces, same as happened for the worker one.
- Worker onboarding's "Add certifications" screen no longer has the
  one-cert-per-visit limitation — resolved as a side effect of
  `profile-redesign` T5's Certifications list (add-per-category is now
  inherently repeatable from the Profile tab). Onboarding itself still
  only shows the single-add UI in its own linear flow, which is fine
  (matches CLAUDE.md: certifications are optional/skippable there either
  way) — just noting the old caveat no longer applies.
- Customer Profile's "soft gradient ring" behind the avatar
  (`ProfileHero`'s customer variant, `packages/ui`) is a flat low-opacity
  circle, not a true blur — React Native has no built-in blur without an
  extra native dependency. Flagged in the PRD as needing a visual
  gut-check; not yet done (see "Immediate next steps").
- Chat is polling-only (no push notifications for new messages, no
  unread badges/read receipts/typing indicators) — all deliberate,
  matching CLAUDE.md's own "start with simple polling" framing for this
  build-order step. Revisit unread/push once step 11 (push notifications)
  is built.
- `ChatScreen` (both apps) fetches the job once on mount to know the
  terminal-status gate and the other party's identity — it does not
  re-check this on every message-poll tick, so a job transitioning to a
  terminal status *while* someone has the chat screen open won't disable
  sending until they leave and re-enter. Accepted edge case per the chat
  PRD, not fixed.
