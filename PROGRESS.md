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
| 9 | Chat (polling) | ✅ Done, core send/receive confirmed live on a physical phone (2026-08-24) — see `docs/prds/chat.md` / `docs/tickets/chat.md`, all tickets T1–T5 complete |
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
chips (Certified badges only show for categories still in Services
offered — a certification for a dropped service stays on file but isn't
badged in the hero), Certifications list with a working add flow
reachable from the Profile tab now too — not just onboarding), and an
**Account section** (Payout method / Notification preferences → shared
`ComingSoonScreen`, since no payment/push infra exists yet; Help &
support and Safety tips → real static-content screens; Terms & liability
→ reuses the onboarding liability text + `liability_acknowledged_at`).
`ActiveJobScreen`'s chat button now opens a real per-job chat screen
(poll-refreshed) instead of an "coming soon" alert. 5-tab bar (Home/Jobs/
Bookings/Earnings/Profile; Bookings/Earnings are still placeholders —
not real product concepts yet, see CLAUDE.md's dropped-scope notes).
**All of Profile (hero, stats, Services-offered editor, Certifications,
Account section) has now been live-tested and iterated on a physical
phone** through several rounds — see git log for the specific spacing/
padding/component fixes that came out of that (hero-to-stat-card overlap
covering text, StatCard font size, section labels moved outside their
cards to match the hi-fi mockup, Log out redesigned from a standalone
button to an Account list row, a `Card`-padding mixup that left the new
Account rows with no left/right inset).

**apps/customer**: full onboarding, Home (category grid, search bar —
still decorative), the full request flow (submission → searching/
matching → matched → job status tracking → report-a-problem → price
agreement → rating, with a back button on the tracking screen now, and a
"Use a saved address" picker on the submission screen), a **Jobs tab**
(replaces the old Requests/Bookings placeholders — same Active/Completed
pattern as the worker app, adapted: cards show the assigned worker's
identity, no earnings-style stat, rating framed as what the customer
gave), and a redesigned **Profile** (calm hero with photo/name/member-
since, 2-stat card, full CRUD **Saved addresses**, and the same **Account
section** pattern as the worker app — Payment method/Notification
preferences → `ComingSoonScreen`, Help & support/Safety tips → real
content, Terms & liability → real liability text + acceptance date).
`JobStatusScreen`'s chat icon (previously not even wired to a press
handler) now opens the same real chat screen the worker side uses; the
**Messages tab is a real inbox now** — every job with an assigned
worker, most-recently-active first, last-message preview, tap into the
thread. 4-tab bar (Home/Jobs/Messages/Profile). **Profile has been
live-tested and iterated on a physical phone through several rounds**,
same as the worker app's — see git log for specifics.

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

1. **A few small pockets of the last two PRDs still haven't been
   click-tested; everything else now has.**
   **✅ Confirmed live on a physical phone**: chat's core send/receive
   loop (2026-08-24, both apps); both apps' Profile screens end to end —
   hero, stat card, Services-offered/Certifications (worker), Saved
   addresses (customer), and the new Account section — through several
   rounds of real device feedback and fixes (see "What's actually built"
   above and git log for the specific spacing/padding bugs that were
   caught and fixed this way, e.g. section labels living inside vs.
   outside their cards, a `Card`-padding mixup that left Account rows
   with no side inset).
   **Still not tapped through**:
   - The 4 new Account-row destination screens themselves
     (`ComingSoonScreen`, `HelpSupportScreen`, `SafetyTipsScreen`,
     `TermsLiabilityScreen`, both apps) — built with the same components
     already proven to work elsewhere on Profile, but never opened.
   - Chat's minor polish items: the plain-`ScrollView` bubble list
     anchoring to the bottom on new messages (chosen over an `inverted
     FlatList` to avoid a transform-flip bug class), the "This job is
     closed" state on a terminal job, a zero-message thread still
     appearing correctly in the Messages inbox.
   - **Saved-address picker** on `RequestSubmissionScreen` — selecting a
     saved address should fill the address field and remain editable
     after.
   - The original pre-profile-redesign item: **T2 (customer Jobs tab) +
     T3 (photo/name editing)** never got a dedicated combined pass,
     though T3's underlying screen has since been superseded by the full
     Profile redesign anyway, so this is largely moot now.
2. Steps 10–11 (mobile money payment, push notifications) after the
   live-test pass above, per CLAUDE.md's build order — chat (step 9) is
   now done and confirmed working.

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
- **Both apps' Profile → Account section now has a fuller settings list**
  (`SettingsRow`, `packages/ui`), matching the hi-fi mockup's structure:
  Payout/Payment method and Notification preferences open a shared
  `ComingSoonScreen` (no payment provider or push infra exists yet — see
  build-order steps 10/11, both not started); Help & support and Safety
  tips are real static-content screens (`apps/worker/src/screens/` and
  `apps/customer/src/screens/`, both per-app, not shared); Terms &
  liability reuses the exact onboarding liability text
  (`packages/auth-flow/src/screens/ProfileScreen.tsx`'s `TERMS_TEXT`) and
  reads the existing `liability_acknowledged_at` field — no new backend
  work needed for that one. **`HelpSupportScreen`'s contact email
  (`support@prism.app`) and hours are placeholder values, explicitly
  marked in a code comment — swap for real contact info before any real
  pilot launch.** Safety tips copy is Claude-drafted generic guidance
  (verify Verified badge, keep coordination in-app, etc.), not
  user-supplied — worth a read-through/edit pass when convenient.
