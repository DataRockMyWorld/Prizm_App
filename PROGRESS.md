# Prism — Progress & Resume Notes

Last updated: 2026-08-23. See `CLAUDE.md` for full project context, brand,
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
| 9 | Chat (polling) | ⬜ Not started |
| 10 | Mobile money payment | ⬜ Not started (intentionally stubbed) |
| 11 | Push notifications | ⬜ Not started |
| 12 | Device testing / pilot rollout | ✅ Both apps running as native dev-client builds on a physical iPhone (see below) |

Beyond the original build order, a second PRD/ticket round is in progress:
`docs/prds/customer-jobs-tab-and-profile-editing.md` /
`docs/tickets/customer-jobs-tab-and-profile-editing.md` — T1 (customer
jobsTab logic), T2 (customer Jobs tab list + detail, replacing the old
Requests/Bookings placeholders), and T3 (photo + name editing on both
apps' Profile screens) are all done and committed.

**A follow-up PRD is queued but not yet written** — see "Immediate next
steps" below, it has specific decisions already made that need to be
captured before drafting.

## What's actually built

**Backend** (`backend/`, Django + DRF, runs via `docker compose up -d` from
repo root): full data model, phone/OTP/PIN auth with JWT, a Django admin
review queue for worker ID + certification approval, and the full job
lifecycle API (create → sequential single-offer matching with
Verified/Certified priority → accept/decline offer → status stepper →
price confirm/dispute → rate). MinIO (S3-compatible) for file storage,
CORS enabled for local dev. `ProfileView`/`ProfileSerializer` already
supports `PATCH` for `full_name`/`photo`/`biometric_enabled`.
`WorkerProfileSerializer` already supports `PATCH` for `categories`
(useful context for the queued profile-redesign PRD — no new endpoint
needed for a "services offered" editor). `ServiceCategoryListView`
(`/api/services/categories/`) already exists for category pickers.

**Shared packages** (`packages/`):
- `@prizm/ui` — design tokens (brand gradient, Manrope type, spacing) and
  primitives (Button, Card, TextField, OtpInput, PinDots, Avatar,
  UploadTile, BrandHeader, SplashView, Badge, **ProfileHeader** — avatar +
  inline name editing, shared by both apps' Profile screens, added this
  round — etc.), including the real Prism logo. `pageBackground` color
  token (added this round) is `Screen`'s default background — a shade
  darker than white so `Card`s (still pure white) have visible contrast;
  fixes a bug where cards were nearly invisible against the page.
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
a read-only Job Record detail screen), and **Profile** with avatar/name
editing + ID-verification badge. 5-tab bar (Home/Jobs/Bookings/Earnings/
Profile; Bookings/Earnings are still placeholders — not real product
concepts yet, see CLAUDE.md's dropped-scope notes).

**apps/customer**: full onboarding, Home (category grid, search bar —
still decorative), the full request flow (submission → searching/
matching → matched → job status tracking → report-a-problem → price
agreement → rating, with a back button on the tracking screen now), a
**Jobs tab** (replaces the old Requests/Bookings placeholders — same
Active/Completed pattern as the worker app, adapted: cards show the
assigned worker's identity, no earnings-style stat, rating framed as
what the customer gave), and **Profile** with avatar/name editing.
4-tab bar (Home/Jobs/Messages/Profile; Messages still a placeholder —
chat is build-order step 9, not started).

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

1. **Draft the queued profile-redesign PRD.** The user shared a fuller
   hi-fi mockup (worker "W8" + customer "C8" Profile screens — file:
   `/Users/jewelbansah/Downloads/Prism Auth Flow - HiFi.dc-3.html`,
   screenshotted at `/Users/jewelbansah/Desktop/Screenshot 2026-08-23 at
   6.22.56 PM.png`) that goes well beyond T3's scope (which just shipped:
   plain avatar + name editing). The fuller design has: a gradient hero
   header, Verified/Certified badges + star rating + jobs-completed count
   (worker), a 3-stat card including an "on-time %" stat, a "Services
   offered" tag editor, a Certifications list + add flow, and (customer
   side) a 2-stat card and **Saved addresses** (Home/Work + arbitrary
   named addresses). **Two product questions are already resolved — do
   not re-ask, just build to these:**
   - **"On-time %" is dropped entirely** — no honest definition exists
     without a scheduling/appointment concept in the data model (same
     reasoning as the earlier "PAID"/earnings-language fixes). The stat
     card should just be Jobs / Member since (worker) — 2-up, not 3-up.
   - **Saved addresses = full CRUD, freeform** — a real `Address` model
     (not just two fixed Home/Work slots), addable/editable/deletable,
     and selectable from `RequestSubmissionScreen` when submitting a
     request (that screen already cleanly separates `address` text state
     from `coords` — see `apps/customer/src/screens/request/
     RequestSubmissionScreen.tsx` — wiring a picker in is a clean
     addition, not a rework).
   Backend grounding already done (see "What's actually built" above):
   categories and certifications endpoints already exist and are
   reusable as-is; still need new — a worker stats endpoint (jobs
   completed count, rating average, member-since/`date_joined`), an
   equivalent customer stats endpoint (requests completed,
   member-since), and the new `Address` model + CRUD endpoints entirely
   from scratch.
2. Once that PRD's written, break it into tickets (same process as
   before) and implement.
3. **Live-test T2 (customer Jobs tab) + T3 (profile editing) together on
   the phone** — both landed right before the profile-mockup detour and
   haven't had a full combined pass yet (T3 specifically was only
   typechecked/bundle-verified, not click-tested on-device).
4. Steps 9–11 (chat, payments, push) after the profile-redesign PRD, per
   CLAUDE.md's build order.

## Known loose ends / things to revisit

- JWT 30-min expiry / no mid-session refresh — see Environment gotchas.
- Customer Home's search bar is decorative (`editable={false}`) — no
  search endpoint exists yet.
- The worker onboarding "Add certifications" screen only supports adding
  one certificate per visit (no "+ Add another" repeat flow yet) — the
  queued profile-redesign PRD's Certifications section may end up
  wanting this repeat flow anyway; worth checking when that's scoped.
- No hi-fi mockup existed for the customer Jobs tab (T2) when it was
  built — it's a reasoned adaptation of the worker app's Jobs tab, not a
  pixel spec. Worth a visual gut-check with the user if/when a customer
  Jobs-tab mockup ever surfaces, same as happened for the worker one.
