# Prism — Local Setup Guide (iOS Simulator + Physical iPhone)

A from-scratch guide to getting the backend and both mobile apps
(`apps/worker`, `apps/customer`) running locally on macOS, on both the
iOS Simulator and a physical iPhone. For general project context
(stack, business rules, brand), see `CLAUDE.md`. For current build
status and known issues, see `PROGRESS.md`.

---

## 1. Prerequisites

Install these once, before anything else:

- **Xcode** (from the App Store) + its Command Line Tools:
  ```
  xcode-select --install
  ```
- **CocoaPods** (iOS native dependency manager):
  ```
  sudo gem install cocoapods
  ```
  or `brew install cocoapods` if you prefer Homebrew's Ruby.
- **An Apple ID signed into Xcode** — Xcode → Settings → Accounts. A
  free "Personal Team" is enough to build and run on your own devices;
  you only need a paid Apple Developer Program membership for
  capabilities like Push Notifications (not needed for basic local dev).
- **Docker Desktop** — for the backend stack (Postgres/PostGIS, Redis,
  Django, Celery, MinIO).
- **Node.js via `nvm`** — this project doesn't rely on a system-wide
  Node install:
  ```
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  nvm install --lts
  ```
  Every fresh terminal session needs `nvm` loaded before `node`/`npm`
  work:
  ```
  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
  ```

---

## 2. Clone and install dependencies

```
git clone <repo-url> Prizm_App
cd Prizm_App
npm install
```

This is an npm workspaces monorepo (`apps/*`, `packages/*`) — one
`npm install` at the root installs everything for the backend-adjacent
tooling and both apps.

---

## 3. Environment files

Three `.env` files, all gitignored, each copied from a checked-in
`.env.example`:

```
cp .env.example .env
cp apps/worker/.env.example apps/worker/.env
cp apps/customer/.env.example apps/customer/.env
```

The root `.env` defaults (Postgres/Redis/MinIO credentials, `DEBUG=True`)
are fine as-is for local dev. The two app `.env` files mostly don't need
edits either — `EXPO_PUBLIC_API_URL` is commented out by default because
the apps auto-detect the backend host from Metro's own dev-server
address. You'll only need to set it explicitly if you connect a physical
iPhone over USB (see §7) or hit the "LAN IP drift" issue in §8.

`EXPO_PUBLIC_USE_RN_FETCH=1` must stay set in both app `.env` files — a
real Expo SDK 57 mechanism this project depends on for file uploads to
work (see `PROGRESS.md` if curious why).

---

## 4. Start the backend

From the repo root:

```
docker compose up -d
docker compose ps
```

You should see `backend`, `celery`, `db`, `redis`, `minio`, and
`createbuckets` all up (the last one exits immediately after seeding
MinIO's bucket — that's expected, not a failure).

**OTPs are not sent via real SMS in local dev** — they're logged to the
backend container's console. To find one after requesting it in-app:

```
docker compose logs backend --tail 20 | grep "DEV OTP"
```

Add `-f` instead of `--tail 20` to follow the log live while you test.

---

## 5. Find your Mac's LAN IP

```
ipconfig getifaddr en0
```

Both mobile apps and the backend need to agree on this IP so a phone or
simulator on the same Wi-Fi network can reach the Django server running
in Docker. **This IP drifts often** (DHCP lease renewal) — if anything
network-shaped breaks later, re-run this command before assuming
something else is wrong.

If you ever need to set it explicitly (see §7 for when), three places
must all match:

1. `EXPO_PUBLIC_API_URL` in **both** `apps/worker/.env` and
   `apps/customer/.env`:
   ```
   EXPO_PUBLIC_API_URL=http://<your-ip>:8000
   ```
2. `DJANGO_ALLOWED_HOSTS` in the root `.env` (only actually enforced
   once `DEBUG=False`, but keep it in sync anyway):
   ```
   DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,<your-ip>
   ```
3. `AWS_S3_PUBLIC_ENDPOINT_URL` in the root `.env` — easy to forget
   since it's backend-only, but a stale value here silently breaks
   *displaying* any already-uploaded photo/ID doc (uploads still
   succeed; the signed URLs handed back to the client just point at the
   wrong host):
   ```
   AWS_S3_PUBLIC_ENDPOINT_URL=http://<your-ip>:9000
   ```

After changing the root `.env`, the backend container needs a
**force-recreate**, not just a restart, to pick up the new values:

```
docker compose up -d --force-recreate backend
```

This is safe — your data lives in a named Docker volume and survives
the recreate.

---

## 6. Run on the iOS Simulator

**Boot a simulator:**

```
xcrun simctl list devices available   # find one you like, note its UDID
xcrun simctl boot <udid>
open -a Simulator
```

**Start Metro for each app** (each in its own terminal/background
process — worker and customer use different ports so they can run
side-by-side):

```
cd apps/worker && npx expo start --dev-client -c --port 8081
```
```
cd apps/customer && npx expo start --dev-client -c --port 8082
```

**Build and install onto the simulator** (first time, or after any
native dependency change):

```
cd apps/worker && npx expo run:ios --device <simulator-udid>
```
```
cd apps/customer && npx expo run:ios --device <simulator-udid>
```

This does a full native build (several minutes the first time — Xcode
compiling all the native dependencies), then installs and launches the
app, connected to the Metro server on its respective port.

**For subsequent runs** (no native changes, just JS), you don't need to
rebuild — just make sure Metro is running and reopen the app icon on
the simulator's home screen.

**Gotcha — wrong Metro port:** since both apps' dev-client launchers can
auto-discover *any* Metro server on the network, a relaunch can
sometimes connect the wrong app to the wrong port (worker to 8082,
customer to 8081). Fix by explicitly pointing it at the right one:

```
xcrun simctl openurl booted "com.juelzgh.prizm-worker://expo-development-client/?url=http%3A%2F%2F<your-ip>%3A8081"
xcrun simctl openurl booted "com.juelzgh.prizm-customer://expo-development-client/?url=http%3A%2F%2F<your-ip>%3A8082"
```

---

## 7. Run on a physical iPhone

1. Connect the iPhone via USB (or ensure it's on the same Wi-Fi network
   as your Mac for a wireless connection later).
2. Trust the computer on the phone if prompted, and trust the phone in
   Finder/Xcode if prompted.
3. Confirm Xcode sees it: **Window → Devices and Simulators**. First
   connection can take a minute ("Preparing device...").
4. Build and install (same command as the simulator, just point at the
   real device instead):
   ```
   cd apps/worker && npx expo run:ios --device
   ```
   If more than one device/simulator is available, this prompts you to
   pick one interactively.
5. The phone must be **unlocked** during install and first launch — a
   locked screen fails the launch step with `Cannot launch ... because
   the device is locked` (just unlock and rerun, no rebuild needed).

**Two ways to keep it connected after the initial install:**

- **Wi-Fi** (recommended for regular use): `npx expo start --dev-client
  -c` from the app's directory, phone on the same Wi-Fi network. The
  dev-client on the phone auto-discovers Metro via Bonjour; if it
  doesn't, use its "Enter URL manually" option with `<your-mac-ip>:8081`
  (or `:8082` for customer).
- **USB** (`npx expo run:ios --device` again, or just reopening an
  app that was last connected this way): Metro gets tunneled through
  USB and reports itself to the app as `localhost` — which is *the
  phone itself* over that tunnel, not your Mac. This is exactly why
  `EXPO_PUBLIC_API_URL` needs to be set explicitly in both apps' `.env`
  files (see §5) whenever you're using a USB connection — otherwise
  every API call silently points at the phone.

---

## 8. Common gotchas, quick reference

- **LAN IP drift** — by far the most common thing that breaks a
  resumed session. Always `ipconfig getifaddr en0` first; update the
  three places in §5 if it's changed.
- **"No such module 'Expo'" in Xcode** — usually stale/missing
  CocoaPods after a dependency change. Fix:
  ```
  cd apps/worker/ios && pod install && cd ../../..
  ```
  (substitute `apps/customer` as needed).
- **PIN/OTP entry not responding to taps on Simulator** — the hidden
  input behind the dots is a small target on a full-size screen; tap
  precisely on the row of dots/boxes itself. If the on-screen keyboard
  never appears at all, toggle "Connect Hardware Keyboard" off with
  `⌘⇧K` so the real keypad renders (or just type on your physical Mac
  keyboard once the field is focused).
- **A gray circle with a gear icon floating top-right on every
  screen** — this is the Expo Dev Client's own menu-launcher overlay,
  not part of the app. It won't exist in a production/TestFlight build.
- **Don't register test accounts with `81 234 5678`** — it's the phone
  field's on-screen placeholder text and collides with a real
  pre-existing seeded account in this project's dev database. Pick
  genuinely random digits.
- **JWT access tokens expire after 30 minutes**, with no mid-session
  refresh yet — if the app starts throwing unexplained 401s after being
  idle, that's why. A relaunch fixes it (re-triggers the refresh-token
  flow).
- **Development for this project happens from Ghana; the real pilot
  target is Namibia** — anything GPS-dependent (including manual-address
  geocoding, see `apps/customer/src/request/geocodeAddress.ts`) defaults
  to validating against Namibia. Set `EXPO_PUBLIC_GEOCODE_REGION=ghana`
  in `apps/customer/.env` only when you specifically need to test
  manual-address entry while physically in Ghana, and unset it
  afterward.

---

## 9. Quick sanity checklist

Once everything's running, in order:

1. `docker compose ps` — all services up.
2. `docker compose logs backend --tail 5` — no errors, "Starting
   development server" visible.
3. Metro terminals for both apps show `Waiting on http://localhost:808x`
   with no red error text.
4. Both apps open to a phone-number entry screen (first launch) or your
   app's Home screen (already logged in).
5. Try registering a fresh test account end-to-end: phone number → OTP
   (from `docker compose logs backend | grep "DEV OTP"`) → PIN → name/
   photo/liability → role-specific home screen.

If all five work, you're fully set up.
