# Tickets: Android session bugfixes (2026-08-30)

No PRD for this file — these are two bugs found and root-caused during the
2026-08-30 Android emulator device-testing pass (`PROGRESS.md`'s "Bugs
found this session — need tickets" section), not a new feature. Each
ticket below already has a concrete fix; skipping the PRD stage per
`CLAUDE.md`'s "tiny fixes/tweaks" carve-out.

---

### T1 — Customer: geocode manually-typed addresses instead of requiring GPS

**Problem:** `RequestSubmissionScreen.tsx` and `AddressFormScreen.tsx`
both gate their submit button on `coords` being a real `{latitude,
longitude}` pair, and both only ever set `coords` from
`Location.getCurrentPositionAsync()`. When GPS fails or is denied, each
screen shows a "enter your address manually" text field/error message,
but typing into it never populates `coords` — so the button stays
disabled forever, even though the user has provided everything a human
would consider a valid address. Not Android- or emulator-specific (the
emulator's `google_apis` image just has no working GPS at all, which is
what surfaced it — see `PROGRESS.md`'s Android setup notes), the same
dead end hits a real phone with poor/no GPS signal (indoors, airplane
mode, denied permission).

**Depends on:** none.
**Touches:** `apps/customer/src/screens/request/RequestSubmissionScreen.tsx`,
`apps/customer/src/screens/AddressFormScreen.tsx`, and (new) a small
shared geocoding helper — location TBD by implementer, e.g.
`apps/customer/src/request/geocodeAddress.ts` if both screens can share
one, or `packages/api` if it belongs there instead (it's a device-SDK
call via `expo-location`, not a backend endpoint, so `apps/customer` is
the more likely home — implementer's call).

- Both screens currently import `Location` from `expo-location`
  (`~57.0.11` per `apps/customer/package.json`) and only ever call
  `getCurrentPositionAsync`/`reverseGeocodeAsync`. Add the forward-
  geocoding counterpart, `Location.geocodeAsync(addressString)` — check
  the exact v57 signature/return shape against
  https://docs.expo.dev/versions/v57.0.0/sdk/location/ before writing
  code, per `apps/customer/AGENTS.md`'s standing instruction (don't
  assume the API from memory/older docs).
- `RequestSubmissionScreen.tsx`: when `isEditingAddress` is true and the
  user has typed something into the address field (`onBlur` or a
  debounced `onChangeText`, implementer's call), call
  `geocodeAsync(address)`. On a result, set `coords` from the first
  match; on an empty result or thrown error, leave `coords` null and
  show an inline "Couldn't find that address — try adding more detail"
  message rather than silently doing nothing (current behavior: the
  submit button just stays disabled with no explanation once the user
  has typed something).
- `AddressFormScreen.tsx`: same idea — today it has *no* manual-fallback
  UI at all beyond `locationError` text; the address text field always
  existed but was purely descriptive when GPS failed. Wire the same
  `geocodeAsync` call, triggered off the existing `addressText` field
  once `locationError` is set (i.e. only bother geocoding client-typed
  text when GPS already failed — don't fight the existing "GPS coords
  win by default" behavior described in the screen's own comment for the
  happy path).
- `canSubmit` on both screens stays "boolean requires coords" — the fix
  is giving the manual path a way to *populate* `coords`, not relaxing
  the requirement (a `JobRequest`/`Address` row without real coordinates
  would break the matching radius query, which is a hard requirement per
  `CLAUDE.md`).
- Handle the geocoder returning zero results (typo, incomplete address,
  or — plausible in Namibia's pilot area — sparse geocoding-provider
  coverage) as a normal user-facing error state, not a crash: don't let
  the promise rejection propagate unhandled.

**Acceptance criteria**
- On `RequestSubmissionScreen`, with GPS denied/failed: typing a real
  address into the manual field and letting it resolve enables Submit;
  the submitted `JobRequest` has non-null lat/long matching the
  geocoded location (verify via Django admin/shell, not just that the
  button enabled).
- Same for `AddressFormScreen`'s Save button and the resulting `Address`
  row.
- Typing an unresolvable string (gibberish, empty) shows a clear inline
  error and leaves Submit/Save disabled — no silent dead end, no crash.
- The existing GPS-success path (permission granted, position resolves)
  is unaffected — no regression on the common case.

**Tests**
- Extract the "geocode this address string, return coords-or-null"
  logic as a plain function (matching this codebase's "logic, not
  full-screen rendering" test policy) and unit-test it against a mocked
  `Location.geocodeAsync`: a normal successful lookup, an empty-array
  result, and a thrown/rejected call — each should map to the right
  return shape/error for the two screens to consume.

---

### T2 — Customer: `JobsScreen` shows a real error state instead of a false-empty one on fetch failure

**Problem:** `JobsScreen.tsx`'s `loadJobs()` does
`catch { setJobs([]); }` — any failure (most concretely, an expired
30-min JWT access token with no mid-session refresh, a known standing
gap — see `PROGRESS.md`'s Environment gotchas) renders as "No active
jobs," indistinguishable from the customer genuinely having none.
Reproduced directly during the 2026-08-30 Android session: 6 real jobs
existed server-side while the tab showed 0; a plain relaunch (which
re-triggers the refresh-token flow) fixed it instantly with no other
change.

**Depends on:** none.
**Touches:** `apps/customer/src/screens/JobsScreen.tsx`.

**Scope note:** this ticket is the minimal fix — a real error state with
a retry action — not the bigger structural fix of adding a 401→refresh→
retry interceptor to `apiRequest` (`packages/api/src/client.ts`), which
`PROGRESS.md` floats as the "would fix this app-wide" alternative. That's
a separate, higher-blast-radius change (touches every API call in both
apps) and deserves its own ticket if/when it's prioritized — not bundled
in here. `ProfileScreen.tsx`'s similar silent `catch` (`apps/customer/
src/screens/ProfileScreen.tsx:29`) was checked as part of scoping this
ticket and left alone deliberately: it explicitly leaves the screen's
prior state intact on failure rather than replacing real data with a
misleading empty/zero state, which is a materially different (and
already reasonable) failure mode — not the same bug.

- `loadJobs()` currently discards the caught error entirely. Track
  fetch-failed as its own state (e.g. a `"idle" | "loading" | "loaded" |
  "error"` status, or a simpler `hasError` boolean alongside the
  existing `jobs` state — implementer's call on shape) instead of
  collapsing "failed" into "loaded with zero jobs."
- Render a distinct error view when the last fetch failed: reuse the
  existing empty-state visual language (icon circle + heading + caption,
  matching the current "No active jobs" card's structure) but with
  honest copy ("Couldn't load your jobs — check your connection and try
  again") and a retry button that calls `loadJobs()` again, rather than
  the "Request a service" CTA the genuine-empty state shows.
- `ApiError` (from `@prizm/api`, thrown by `apiRequest` on any non-2xx
  response) is already exported with a `.status` field — no new backend
  or client work needed, this is presentation-layer only. Don't special-
  case 401 specifically; any fetch failure should show the error state,
  since a flaky connection is just as real a cause as an expired token.

**Acceptance criteria**
- A failed `listMyJobs` call (simulate via an expired/invalid token, or
  by temporarily stopping the backend) shows the new error state, not
  "No active jobs."
- The error state's retry button re-attempts the fetch and, on success,
  replaces itself with the real job list — no separate remount/navigate-
  away-and-back needed to recover.
- A genuinely empty account (real 200 response, empty array) still shows
  the existing "No active jobs" empty state unchanged — the two states
  must stay visually distinguishable, not just distinguishable in code.

**Tests**
- No new pure-logic extraction is obviously required (the existing
  `jobsTab/*` helper modules already have their own tests and aren't
  touched by this fix) — if the loading/error status tracking ends up
  complex enough to warrant extracting as a pure reducer/helper, add a
  unit test the same way this codebase's other extracted logic does;
  otherwise typecheck + a manual repro (stop the backend, confirm the
  error state, restart it, confirm retry recovers) is sufficient,
  consistent with this project's "logic, not full-screen rendering" test
  policy.

---

## Suggested implementation order

T1 and T2 are fully independent — either order, or in parallel.
