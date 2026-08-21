# Prism — Progress & Resume Notes

Last updated: 2026-08-21. See `CLAUDE.md` for full project context, brand,
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
| 6 | Auth screens → wire to API | ✅ Done, both apps |
| 7 | Customer request flow → wire to API | 🟡 Built + typechecked, **not yet click-tested** |
| 8 | Worker active-job flow → wire to API | ⬜ Not started |
| 9 | Chat (polling) | ⬜ Not started |
| 10 | Mobile money payment | ⬜ Not started (intentionally stubbed) |
| 11 | Push notifications | ⬜ Not started |
| 12 | Device testing / pilot rollout | 🟡 In progress — see "Right now" below |

Commit history (`git log --oneline`) roughly maps 1:1 to these steps, oldest
first: `fa95f94` (Docker setup) through `c3e036b` (customer request flow +
real logo).

## What's actually built

**Backend** (`backend/`, Django + DRF, runs via `docker compose up -d` from
repo root): full data model, phone/OTP/PIN auth with JWT, a Django admin
review queue for worker ID + certification approval, and the full job
lifecycle API (create → broadcast-and-first-to-accept matching with
Verified/Certified priority → accept/decline offer → status stepper →
price confirm/dispute → rate). MinIO (S3-compatible) for file storage,
CORS enabled for local dev.

**Shared packages** (`packages/`):
- `@prizm/ui` — design tokens (brand gradient, Manrope type, spacing) and
  primitives (Button, Card, TextField, OtpInput, PinDots, Avatar,
  UploadTile, BrandHeader, etc.), including the real Prism logo
  (`packages/ui/src/assets/prism-logo.png`, sourced from
  `design/brand/prism-logo.png`).
- `@prizm/api` — fetch client, `SecureStore`-backed auth session, and
  typed functions for every backend endpoint.
- `@prizm/auth-flow` — the shared phone → OTP → PIN → biometric → profile
  onboarding screens, used identically by both apps (`role` is the only
  difference).

**apps/worker**: full onboarding, Home (online toggle, category picker,
nearby jobs, ID-upload banner), ID upload → certifications → under-review
flow, Profile with logout. 5-tab bar (Home/Jobs/Bookings/Earnings/Profile;
Bookings/Earnings are placeholders — that's step 8).

**apps/customer**: full onboarding, Home (category grid, search bar —
search itself isn't wired), and the full request flow: submission →
searching/matching → matched confirmation → job status tracking →
report-a-problem → price agreement (confirm/dispute) → rating. 5-tab bar
(Home/Requests/Bookings/Messages/Profile; Requests/Bookings/Messages are
placeholders pointing at the same job list once wired).

## Right now: getting onto a physical iPhone

Expo Go's App Store build doesn't support our SDK (57) yet — it's stuck in
Apple's review queue as of this date. Working around it via a real native
development build instead (better for testing anyway — no Expo Go
dependency going forward):

1. `cd apps/worker && npx expo run:ios --device` — this generates
   `apps/worker/ios/` and attempts to build+install directly on the
   connected iPhone.
2. Hit a code-signing wall: Xcode needs a free "Personal Team" certificate
   for a first-time Apple ID + device combo. **Last step in progress**:
   open `ios/PrizmWorker.xcodeproj` in Xcode, select the target →
   **Signing & Capabilities**, pick your Apple ID under **Team**, let
   Xcode auto-generate the certificate, then re-run
   `npx expo run:ios --device`.
3. Once that works for `apps/worker`, repeat for `apps/customer` (its own
   bundle identifier, separate signing — should be quicker now that your
   Apple ID is already trusted in Xcode).

## Environment gotchas (read before resuming)

- **Node isn't on the system PATH** — it's installed via `nvm` (this
  account isn't a macOS Administrator, so Homebrew wasn't an option). Any
  fresh terminal needs `nvm` loaded; it should auto-load via `~/.zshrc`,
  but if `node -v` fails, run:
  `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"`
- **Backend**: `docker compose up -d` from the repo root. Check
  `docker compose ps` — should show `backend`, `celery`, `db`, `redis`,
  `minio` all healthy/up.
- **LAN IP drift**: this Mac's IP has changed multiple times this session
  (DHCP). If the app can reach nothing, compare
  `ipconfig getifaddr en0` against `EXPO_PUBLIC_API_URL` in
  `apps/worker/.env` and `apps/customer/.env`, and against
  `DJANGO_ALLOWED_HOSTS` / `AWS_S3_PUBLIC_ENDPOINT_URL` in the root
  `.env` — all three must use the same current IP. Restart
  `docker compose up -d backend` and the relevant `expo start` after
  changing any of them.
- **`EXPO_PUBLIC_USE_RN_FETCH=1`** is set in both apps' `.env` — required
  because Expo SDK 56+ made `expo/fetch` the default global fetch, which
  has an unresolved upstream bug where it can't send `FormData` (i.e. any
  photo/file upload). Don't remove this line.
- **`.env` files are gitignored** (by design) — `.env.example` in each
  app documents what's needed if you're setting up fresh.
- Two Expo dev servers were used simultaneously this session: worker on
  port 8081, customer on port 8082 (`--port 8082` flag), so they can run
  side by side without conflict.

## Immediate next steps, in order

1. **Finish the physical-device signing** for `apps/worker` (see above),
   confirm it launches and can log in/register against the real backend.
2. **Click-test the customer request flow for real** (step 7 is built but
   unverified) — submit a request, and on the backend/worker side, either
   drive the worker app in parallel or simulate the worker's
   accept/progress/complete actions via the job-lifecycle API directly
   (curl or Django shell) while watching the customer app's screens
   transition through searching → matched → tracking → price agreement →
   rating.
3. **Build step 8, the worker active-job flow** (incoming job request
   with 60s timer, accept/decline, on-my-way/arrived/in-progress stepper,
   cancel-job with reason, mark-complete + propose price) — mirrors the
   customer request flow work, using the same job-lifecycle API. Design
   reference: `design/brand/prism-auth-flow-hifi.dc.html`, sections
   labeled W1–W5 (also has the full customer flow C1–C7 and the
   auth/onboarding screens 1–11 already built).
4. Steps 9–11 (chat, payments, push) after that, per CLAUDE.md.

## Known loose ends / things to revisit

- Worker's "Log out" button was unreliable during automated testing this
  session — almost certainly an artifact of the AppleScript-based
  simulator automation (which was generally flaky throughout), not a
  confirmed app bug. Worth a quick manual check next time.
- Customer Home's search bar is decorative (`editable={false}`) — no
  search endpoint exists yet.
- The worker onboarding "Add certifications" screen only supports adding
  one certificate per visit (no "+ Add another" repeat flow yet), a
  deliberate scope trim.
