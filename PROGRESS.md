# Prism — Progress & Resume Notes

Last updated: 2026-08-26. See `CLAUDE.md` for full project context, brand,
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
| 10 | Mobile money payment | ⬜ Deliberately skipped for now — revisit later, see below |
| 11 | Push notifications | ⏸️ Backend + T4 done (T1–T4), paused on an Apple Developer Program blocker — see below |
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
category pickers. Four seeded categories now (was three): Cleaning,
Plumbing, Electrical, and **Gardening** (added 2026-08-26, N$150–350
estimate — `backend/services/migrations/0003_seed_gardening.py`).

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

**apps/worker**: full onboarding, Home, **ID upload — now front + back**
(2026-08-26, live-tested — `WorkerProfile.id_document_back` added
alongside the existing `id_document`; both required to submit; each
tile offers a "Take Photo" / "Choose from Library" action sheet via
`expo-image-picker`'s `launchCameraAsync`/`launchImageLibraryAsync`,
this app's first real camera usage; a tips card above Submit gives
photo-quality guidance — matches a hi-fi mockup) → certifications →
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

**apps/customer**: full onboarding, a redesigned **Home** screen (2026-08-26,
went through two design rounds live with the user — landed on a calmer
"catalogue" card style over the first full-bleed-photo attempt: first name
only in the greeting, a "BROWSE SERVICES / See all" section header below a
divider, then Cleaning/Plumbing/Electrical/Gardening as 2-column cards —
photo on top (4:3, custom-cropped per category to keep the worker's
face/hands in frame), category name on a plain white card body below
(font size reduced from a follow-up round of live feedback — was
reading too large), matching a hi-fi mockup closely; search bar still
decorative). Also fixed the same day: **"Request a Service" (generic,
no pre-picked category) now shows a "Choose a service" picker list**
instead of silently defaulting to Cleaning — `RequestSubmissionScreen`
no longer auto-selects `categories[0]` when it arrives with no
`categoryId`; the "Change" link (which used to just `navigation.
goBack()` to Home, discarding whatever the customer had already typed)
now resets to that same in-place picker instead. Tapping a specific
Home card still skips the picker and goes straight to the form, as
before. The full request flow (submission → searching/
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
- **Don't use `81 234 5678` for test registrations** — it's the phone
  field's on-screen placeholder text, easy to type by habit, and it
  collides with a real pre-existing seed/test account (confirmed
  2026-08-26, an old customer record). Registering with it doesn't
  create a new account — OTP verify finds the existing phone and logs
  into *that* account instead, with whatever role/data it already has,
  which looks exactly like a broken registration (wrong role, stale
  name, missing onboarding data) until you check `date_joined` and
  realize it's not actually new. Pick genuinely random digits instead.
- **LAN IP drift**: this Wi-Fi network reassigns DHCP addresses often
  enough that it drifted **four times in one Simulator session**
  (2026-08-26). Three separate places reference the Mac's LAN IP and all
  three need to stay in sync with `ipconfig getifaddr en0` — check all
  three if anything network-shaped breaks, not just the first one you
  think of:
  1. `EXPO_PUBLIC_API_URL` in both apps' `.env` (see USB gotcha above).
  2. The Simulator's per-app `RCT_jsLocation` override (only needed
     because there's no `expo-dev-client` — see the gotcha below); reset
     via `xcrun simctl spawn <device> defaults write <bundle-id>
     RCT_jsLocation "<ip>:<port>"` after any drift, or the app can't even
     find Metro (shows "Could not connect to development server").
  3. **`AWS_S3_PUBLIC_ENDPOINT_URL` in the root `.env`** — easy to miss
     since it's backend-side, not an Expo/Metro concern at all. A stale
     value here doesn't break uploads (those still reach MinIO fine via
     the Docker-internal `AWS_S3_ENDPOINT_URL`) — it silently breaks
     *displaying* anything already uploaded (profile photos, job photos,
     ID docs), since the signed URLs handed to the client embed this
     host. Symptom: an upload appears to succeed (200, no error) but the
     image never renders anywhere — confirmed live 2026-08-26 chasing a
     profile-photo-not-showing report. After changing it, the backend
     container needs `docker compose up -d --force-recreate backend`
     (env_file changes aren't picked up by a plain `restart`) — verified
     safe, `db` gets recreated alongside it too (compose treats file
     changes as affecting the whole `.env`-consuming service graph) but
     its named volume means no data loss.
  Also check `DJANGO_ALLOWED_HOSTS` in the root `.env` if that's ever set
  to something other than `*` (currently unset, defaults to `*` under
  `DEBUG=True`, so this rarely bites).
- **Uploads are now collision-safe.** Previously every upload (profile
  photo, job photo, ID document, certification) used a hardcoded generic
  client-side filename, and S3/MinIO overwrites same-named objects by
  default — so every user's profile photo silently overwrote every other
  user's. Fixed via `unique_upload_path()` in
  `backend/config/storage_backends.py`. If you're ever debugging "wrong
  photo showing up," this class of bug is already closed — look
  elsewhere first.
- **`EXPO_PUBLIC_USE_RN_FETCH=1`** is set in both apps' `.env` — required,
  don't remove. Confirmed 2026-08-26 this is a **real, built-in Expo SDK
  57 mechanism** (docs: "By default, `expo/fetch` replaces the global
  `fetch` implementation... set `EXPO_PUBLIC_USE_RN_FETCH=1` to restore
  React Native's classic `fetch`"), read internally by Expo's own
  bootstrap — not something this codebase implements or calls anywhere
  itself, which had briefly looked like dead config before checking the
  actual docs. Verified live that it's doing its job (a debug probe on
  `fetch` confirmed RN's classic implementation is active, and a real
  multipart photo upload round-tripped correctly end-to-end).
- **`.env` files are gitignored** — `.env.example` in each app documents
  what's needed.
- Two Expo dev servers run side by side: worker on port 8081, customer
  normally on port 8082 (`--port 8082` flag) — though the customer
  Simulator session as of 2026-08-26 is on **port 8095** instead (see
  below); either port is fine going forward, 8082 is just the
  established default.
- **JWT access tokens expire after 30 min with no auto-refresh mid-
  session** — a real, still-unfixed gap. If a long-idle app session starts
  throwing 401s, that's why; relaunching the app re-triggers the
  refresh-token flow on mount and clears it. Low priority unless it comes
  up again.
- **No `expo-dev-client` in either app** (verified 2026-08-26 — not in
  `package.json`, not in `node_modules`, not a Podfile dependency).
  Consequence: a Simulator launch that doesn't go through `expo run:ios`
  itself (e.g. `xcrun simctl launch <bundle-id>` after the app's already
  installed) has no way to discover/remember which Metro port to use, and
  **silently falls back to React Native's hardcoded default port 8081**
  — i.e. the *worker* app's Metro, if both apps are running side by side.
  Since the shared onboarding screens (`packages/auth-flow`) look
  identical between both apps, this is easy to not notice until you reach
  a role-specific screen (worker's 5-tab bar vs. customer's 4-tab bar).
  Symptom besides wrong content: the splash screen's emoji badge
  (`SplashView icon=`) is 🔧 for worker, 🏠 for customer — a fast way to
  tell which app's JS is actually loaded. **Workaround** (until
  `expo-dev-client` is actually added as a real fix — worth doing):
  `xcrun simctl spawn <device> defaults write <bundle-id> RCT_jsLocation
  "<mac-lan-ip>:<port>"` before every `simctl launch`, or just always
  relaunch via a full `npx expo run:ios --device <udid> --port <port>`
  cycle instead of a bare `simctl launch`.
- **Local `require()`'d image assets can serve stale/wrong content on
  Simulator** (discovered + worked around 2026-08-26, customer Home
  screen's service-tile photos). Metro's local-asset HTTP serving in this
  monorepo registers each asset with a *directory-level*, not
  file-specific, `httpServerLocation` containing `unstable_path` — an
  explicitly experimental Metro feature. Confirmed via direct `curl` that
  Metro serves 100% correct bytes/hash for the exact asset URL, and that
  the JS bundle text itself references the correct filename — yet the
  native `Image` component kept rendering old/wrong photo content for
  that require() call site. Survived: Metro cache clears, full app
  uninstall+reinstall, brand-new never-before-used Metro ports, and a
  full Simulator reboot — ruling out every normal caching layer. **Fix**:
  don't `require()` local photos in `apps/customer` — inline them as
  base64 `data:` URIs instead (bypasses Metro's asset pipeline entirely).
  See `apps/customer/src/serviceImages.ts` for the working pattern and
  the regeneration script in its header comment. Not yet confirmed
  whether this also affects physical-device (non-Simulator) builds or is
  Simulator-specific — worth a real device check next time that app is
  touched, and worth a genuine root-cause fix (or an `expo-dev-client`
  install, which might resolve both this and the port-fallback gotcha
  above at once) rather than living with the workaround long-term.

## Immediate next steps, in order

1. ✅ **Done (2026-08-25)** — the remaining click-test pockets from the
   chat + profile-redesign PRDs (the 4 Account-row destination screens,
   chat's polish states, the saved-address picker on
   `RequestSubmissionScreen`) were all tapped through live on the phone
   and confirmed working. Minor visual polish noted as worth revisiting
   later, but nothing broken — no fixes needed this round.
2. **Step 10 (mobile money payment) is being deliberately skipped for
   now** per user decision on 2026-08-25 — provider still TBD (see
   CLAUDE.md), come back to it later.
3. **Step 11 (push notifications) is paused on an Apple Developer
   Program blocker (2026-08-26).** PRD (`docs/prds/push-notifications.md`)
   and tickets (`docs/tickets/push-notifications.md`, T0–T7) are written.
   **T1–T3 (backend) are done, tested, and merged** — new
   `backend/notifications` app (`PushToken` model, register/delete
   device endpoint), the `send_push_notification` Celery task (the
   project's first real Celery task, confirmed working end-to-end via a
   real smoke test through the actual worker, not just configured), and
   the task wired into the three trigger points (`jobs/matching.py`
   `try_match`, `jobs/views.py` `AcceptOfferView` +
   `MessageListCreateView`). 16 new backend tests pass, full suite
   47/47. This backend work is inert but harmless until a device
   actually registers a token — safe to have merged ahead of the
   frontend/T0 being unblocked.
   **T0 (Apple Developer/EAS credential setup) is blocked**: checked
   2026-08-26 — `jewelbansah@icloud.com`'s Apple ID is on a **Personal
   Team only, no paid Apple Developer Program membership** ($99/yr,
   required for the Push Notifications capability — a hard Apple
   platform requirement, not something to work around). Also surfaced
   along the way: the existing `ios/*.xcodeproj` project files reference
   signing team `LZDFN4R8G7`, which doesn't match the only valid
   codesigning identity currently in the keychain
   (`862V45CWK2`/personal team) — unresolved, likely stale from an
   earlier signing session; hasn't blocked existing device builds so
   left alone, but worth a look if iOS signing ever acts up.
   **T4 is also done now** — `packages/api/src/notifications.ts`
   (`registerDevice`, `unregisterDevice`, `getNotificationRoute`, the
   last a pure function with no RN/expo-notifications dependency so it
   didn't need T0 to write or test), 6 new tests pass
   (`packages/api/src/notifications.test.ts`), both apps typecheck
   clean. **User decision (2026-08-26): pause push notifications here**
   — T5–T7 (`expo-notifications` native config, the shared registration
   hook, the device click-test pass) all genuinely need T0 (real device
   push credentials) to build/verify, unlike T4. Come back to T0 once/if
   the Apple ID gets enrolled in the paid Program, then pick up T5–T7.

## Known loose ends / things to revisit

- JWT 30-min expiry / no mid-session refresh — see Environment gotchas.
- Customer Home's search bar is decorative (`editable={false}`) — no
  search endpoint exists yet.
- A user reported onboarding's profile-photo step (`packages/auth-flow/
  src/screens/ProfileScreen.tsx`) not persisting a photo at all — traced
  the code and it's identical in structure to the Profile-tab photo-edit
  path (same `updateProfile` call, same FormData construction), which
  was independently verified working the same day (real upload,
  `photo.url` reachable, image rendered). The stale `AWS_S3_PUBLIC_
  ENDPOINT_URL` (see Environment gotchas) was live at the time of that
  report and is the far more likely explanation than a code-level
  onboarding-specific bug. Not independently re-verified in isolation
  though — worth a quick real check next time a fresh account goes
  through onboarding, just to be certain.
- **Fixed 2026-08-26**: `PinDots` (`packages/ui/src/components/PinDots.tsx`,
  shared by both apps' 4-digit PIN screens) had near-invisible empty-dot
  outlines — `colors.border` (`#ECE7E2`) against `colors.pageBackground`
  (`#F1ECE7`) is barely distinguishable. Now uses `colors.textSecondary`
  for the border plus a `colors.surfaceMuted` fill, matching the contrast
  pattern `OtpInput`'s empty boxes already used successfully.
- **Fixed 2026-08-26**: a real `AuthProvider` bug where, if a stored
  refresh token succeeded but the immediately-following profile fetch
  failed (e.g. the underlying account was deleted — the refresh token
  itself still validated), the app landed on `isAuthenticated=true` with
  `profile=null` permanently — both apps' `App.tsx` has no recovery path
  from that combination, so the app was stuck on the splash screen
  forever. Fixed by extracting the "establish a *new* session" logic
  (mount-effect restore, `setSession` right after login) into
  `packages/api/src/sessionEstablishment.ts`'s `restoreSession`/
  `establishSessionFromTokens` — both are now all-or-nothing: a profile
  fetch failure there means no partial session is ever produced
  (`restoreSession` returns `null` and the stored tokens are cleared;
  `establishSessionFromTokens` throws, already caught by both PIN
  screens' existing try/catch). Deliberately left `refreshProfile()`
  (pull-to-refresh on an *already-established, already-working* session)
  swallowing failures as before — a transient failure there shouldn't
  log out a user who was already in; only the two session-establishment
  call sites needed the stricter contract. Verified via 5 new unit tests
  (`packages/api/src/sessionEstablishment.test.ts`) covering exactly this
  refresh-succeeds-then-profile-fails case, plus a live repro on the
  Simulator (deleted the logged-in test account, relaunched, confirmed
  it drops to the phone-entry screen instead of freezing).
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
