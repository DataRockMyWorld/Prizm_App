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
| 6 | Auth screens → wire to API | ✅ Done, both apps — confirmed live on a physical iPhone |
| 7 | Customer request flow → wire to API | 🟡 Built + typechecked, **not yet click-tested end-to-end** (onboarding through Home confirmed on-device) |
| 8 | Worker active-job flow → wire to API | ⬜ Not started |
| 9 | Chat (polling) | ⬜ Not started |
| 10 | Mobile money payment | ⬜ Not started (intentionally stubbed) |
| 11 | Push notifications | ⬜ Not started |
| 12 | Device testing / pilot rollout | ✅ Both apps running as native dev-client builds on a physical iPhone (see below) |

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
  UploadTile, BrandHeader, SplashView, etc.), including the real Prism logo
  (`packages/ui/src/assets/prism-logo.png`, sourced from
  `design/brand/prism-logo.png`). `SplashView` is the full-screen branded
  loading state (gradient background, reversed-lockup mark, "PRISM"
  wordmark, role icon — 🔧 worker / 🏠 customer), shown by both apps'
  `App.tsx` while the auth/profile check is in flight, matching the
  splash mockups in the hi-fi design file.
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

## Physical iPhone builds — working

Expo Go's App Store build doesn't support our SDK (57) — stuck in Apple's
review queue as of this date. Both apps now run as real native
development-client builds on the physical iPhone instead (better for
testing anyway — no Expo Go dependency going forward). Both were
click-tested through onboarding (phone → OTP → PIN → biometric prompt →
profile → liability) into their respective Home screens.

**To (re)install after a fresh clone or a native-code change:**

```
cd apps/worker && npx expo run:ios --device      # or apps/customer
```

**To just restart Metro for a build already installed on the phone** (no
native changes since last install):

```
cd apps/worker && npx expo start --dev-client
```

Then open the Camera app on the iPhone and scan the QR code it prints —
this deep-links straight into the already-installed dev client with the
correct bundler URL. (Tapping the home-screen icon directly instead can
show a red "No script URL provided" error if Metro isn't already running
under a URL the app remembers.)

**One-time setup this required** (already done, documented here in case
it's needed again on a clean machine or after `expo prebuild --clean`):
- Xcode → Settings → Accounts → added the Apple ID, which gives a free
  "Personal Team" signing certificate (target → Signing & Capabilities →
  Automatically manage signing → pick the Personal Team).
- CocoaPods needed a Ruby ≥ 3.0 (system Ruby was 2.6.10). Since this
  account can't install Homebrew (not a macOS Administrator), Ruby was
  installed user-space via `rbenv` + `ruby-build`
  (`rbenv install 3.3.12`, `gem install cocoapods`). `rbenv init` is
  appended to `~/.zshrc`.
- Xcode 15+'s `ENABLE_USER_SCRIPT_SANDBOXING` build setting defaults to
  `YES`, which breaks React Native's "Bundle React Native code and
  images" build phase (a sandboxed script can't write `ip.txt`). Set to
  `NO` for both configurations in
  `apps/worker/ios/PrizmWorker.xcodeproj/project.pbxproj` (and the
  customer equivalent). **This file is regenerated by
  `expo prebuild --clean`**, so if that's ever run again, re-apply:
  `sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' ios/<Project>.xcodeproj/project.pbxproj`
- First launch of a freshly-installed dev build also needs, on the phone:
  Settings → Privacy & Security → **Developer Mode** → on (reboots), then
  Settings → General → VPN & Device Management → trust the developer
  certificate.

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

1. **Click-test the customer request flow for real** (step 7 is built but
   unverified end-to-end) — submit a request, and on the backend/worker
   side, either drive the worker app in parallel (now installable
   natively — see above) or simulate the worker's accept/progress/complete
   actions via the job-lifecycle API directly (curl or Django shell)
   while watching the customer app's screens transition through
   searching → matched → tracking → price agreement → rating.
2. **Build step 8, the worker active-job flow** — now has a PRD and ticket
   breakdown (`docs/prds/worker-active-job-flow.md`,
   `docs/tickets/worker-active-job-flow.md`); T0a/T0b (backend + frontend
   test infrastructure) are done, T1 (backend cancellation-note field) is
   next.
3. Steps 9–11 (chat, payments, push) after that, per CLAUDE.md.

## Known loose ends / things to revisit

- **Resolved: `SplashView`'s reverse-logo image wasn't rendering on-device.**
  Root cause found via the iOS Simulator (reproduced identically to the
  physical device, ruling out any device-specific cache): `Image`'s
  `onLoad` fired successfully with the correct dimensions every time —
  it wasn't a loading/decode failure — but pixel-sampling the rendered
  screenshot showed zero shape variation anywhere, even in `resizeMode:
  "contain"` where the whole image should be visible. Swapping to the
  small `prism-logo.png` through the exact same component reproduced the
  same failure (a thin unscaled sliver at the screen edge instead of a
  filled container), proving it wasn't file-specific — it was
  `styles.image` itself: `position: "absolute"` with only
  `top/left/right/bottom: 0` wasn't reliably sizing the `Image` on this
  RN version. Adding explicit `width: "100%", height: "100%"` alongside
  those four edges fixed it immediately. Fixed in
  `packages/ui/src/components/SplashView.tsx`.
- Worker's "Log out" button was unreliable during automated testing this
  session — almost certainly an artifact of the AppleScript-based
  simulator automation (which was generally flaky throughout), not a
  confirmed app bug. Worth a quick manual check next time.
- Customer Home's search bar is decorative (`editable={false}`) — no
  search endpoint exists yet.
- The worker onboarding "Add certifications" screen only supports adding
  one certificate per visit (no "+ Add another" repeat flow yet), a
  deliberate scope trim.
