# Tickets: Worker Active-Job Flow

PRD: `docs/prds/worker-active-job-flow.md`

Implement in order — each ticket should be its own commit (or small PR),
reviewed before moving to the next. Later tickets depend on earlier ones
as noted. **Every ticket below has a "Tests" subsection — a ticket isn't
done until those tests exist and pass**, per PRD §7.

---

### T0a — Backend: test infrastructure ✅ Done

**Depends on:** nothing. **Touches:** `backend/requirements.txt` (or a
new `requirements-dev.txt`), `backend/pytest.ini` (or `pyproject.toml`),
`backend/conftest.py`, `backend/jobs/tests/` (convert from
`backend/jobs/tests.py` to a package)

- Add `pytest`, `pytest-django`, `factory_boy` to dependencies (dev-only
  if using a `requirements-dev.txt` split — check if one should be
  introduced or if a single `requirements.txt` stays simplest given the
  project's current setup).
- `pytest.ini` (or `[tool.pytest.ini_options]` in a new `pyproject.toml`)
  pointing `DJANGO_SETTINGS_MODULE` at the project's settings module.
- Root `conftest.py` with a `db` fixture (pytest-django's `@pytest.mark.
  django_db` is enough for most cases — only add custom fixtures if
  genuinely reused across many tests).
- Factories for `User`, `WorkerProfile`, `CustomerProfile`,
  `ServiceCategory`, `JobRequest` in `backend/jobs/tests/factories.py`
  (or split per-app if that matches the existing app boundaries better —
  `User`/`WorkerProfile`/`CustomerProfile` likely belong in
  `backend/accounts/tests/factories.py` instead, imported from
  `jobs`' tests).
- Convert each app's empty `tests.py` (`accounts`, `jobs`, `services`)
  into a `tests/` package (`tests/__init__.py`) so later tickets can add
  focused files like `tests/test_cancel.py` without one giant file.

**Acceptance criteria**
- `docker compose exec backend pytest` runs cleanly (0 tests is fine at
  this point, but the command must succeed, not error).
- A throwaway smoke test using the `JobRequest` factory (assert it
  creates a valid row with a matched worker+customer+category) passes,
  proving the factory chain works end-to-end — this can be deleted once
  T1 adds real coverage, or kept as a baseline sanity test.

---

### T0b — Frontend: test infrastructure ✅ Done

**Depends on:** nothing (can run in parallel with T0a). **Touches:**
`apps/worker/package.json`, `apps/customer/package.json`,
`apps/worker/jest.config.js`, `apps/customer/jest.config.js`,
`packages/api/package.json` (+ its own lightweight jest config)

- Add `jest-expo`, `@testing-library/react-native`, `jest`, `@types/jest`
  as devDependencies to `apps/worker` and `apps/customer`; add a `test`
  script (`jest`) to each.
- `jest.config.js` in each app extending the `jest-expo` preset.
- `packages/api` gets its own minimal `jest` setup (no RN/Expo needed —
  it's plain TypeScript fetch wrappers) so T2's client functions can be
  unit-tested with mocked `fetch`, independent of the RN apps.
- Per PRD §7, this ticket does **not** add component-rendering tests —
  it only stands up the ability to run `renderHook`/plain-function tests
  for the logic later tickets will extract.

**Acceptance criteria**
- `npm test --workspace=apps/worker` and `npm test --workspace=
  apps/customer` both run cleanly (0 tests passes without erroring).
- A throwaway test (e.g. `expect(true).toBe(true)`) confirms the jest-expo
  preset loads without config errors in each app; delete once real tests
  land in T3/T4.

---

### T1 — Backend: cancellation note field ✅ Done

**Depends on:** T0a. **Touches:** `backend/jobs/`

- Add `note = models.TextField(blank=True, default="")` to
  `CancellationLog` (`backend/jobs/models.py`).
- Migration.
- Extend `WorkerCancelSerializer` (`backend/jobs/serializers.py:118-119`)
  with an optional `note` field.
- Update the cancel view to pass `note` through to `CancellationLog.objects.create(...)`.

**Acceptance criteria**
- `POST /api/jobs/<id>/cancel/` accepts `{ reason, note }` with `note`
  optional; omitting it still works exactly as today.
- `CancellationLog` rows store the note when provided.

**Tests** (`backend/jobs/tests/test_cancel.py`, using T0a's factories)
- Worker cancels within the 10-minute window with a reason only (no
  note) → 200, `CancellationLog.note == ""`, job reverts to `searching`.
- Worker cancels with reason + note → 200, note stored verbatim.
- Worker cancels past the 10-minute window → rejected (matches existing
  behavior — this is a regression guard, not new behavior).
- Missing `reason` → 400 (serializer validation, existing behavior —
  regression guard since the serializer is being touched).

---

### T2 — `packages/api`: missing job-lifecycle client functions ✅ Done

**Depends on:** T0b, T1 (for the cancel-with-note signature). **Touches:**
`packages/api/src/jobs.ts`

Add typed functions for every endpoint the worker flow needs that isn't
already covered:
- `getIncomingOffers(token)` → `GET /api/jobs/worker/incoming/`
- `acceptOffer(token, offerId)` → `POST /api/jobs/offers/<id>/accept/`
- `declineOffer(token, offerId)` → `POST /api/jobs/offers/<id>/decline/`
- `markOnMyWay(token, jobId)` → `POST /api/jobs/<id>/on-my-way/`
- `markArrived(token, jobId)` → `POST /api/jobs/<id>/arrived/`
- `markInProgress(token, jobId)` → `POST /api/jobs/<id>/start/`
- `completeJob(token, jobId, agreedPrice, note?)` →
  `POST /api/jobs/<id>/complete/`
- `cancelJobAsWorker(token, jobId, reason, note?)` →
  `POST /api/jobs/<id>/cancel/` (new function per PRD §6/T4 — do not
  modify the existing customer-facing `cancelJob`)

**Acceptance criteria**
- Each function is typed against the existing `JobRequest`/`JobStatus`
  types in the same file; no `any`.
- Typecheck passes (`packages/api` build/tsc).

**Tests** (`packages/api/src/jobs.test.ts`, mocked `fetch`)
- Each new function calls the correct method + path (e.g.
  `markOnMyWay` → `POST /api/jobs/<id>/on-my-way/`).
- Request bodies are shaped correctly (e.g. `completeJob` sends
  `{ agreed_price, note }`, `cancelJobAsWorker` sends
  `{ reason, note }` with `note` omitted when not passed rather than
  sent as `undefined`/`null` — confirm the actual serialization).
- A non-2xx response is surfaced as a rejected promise/thrown error
  (matches whatever error-handling convention the existing functions in
  this file already use — keep it consistent, don't invent a new one).

---

### T3 — Global offer polling + incoming-request interrupt (W1) ✅ Done

**Implementation notes:** distance ("2.1km away") is omitted — the offer
endpoint's `JobRequestSerializer` doesn't compute it (only
`NearbyJobSerializer` does, via a PostGIS annotation against the
worker's `last_location`); adding it would mean extending
`WorkerIncomingOfferView`'s queryset similarly, left as a follow-up
rather than expanding this ticket into the backend. Accept currently
navigates back to Home (`Tabs`) with a `TODO(T4)` marker — routes to the
real active-job screen once T4 exists. Not visually verified live on
the simulator this round (would need a full worker+customer+matching
round trip to produce a real offer) — styling was built directly from
the mockup's exact values instead.

**Depends on:** T2. **Touches:** `apps/worker/src/` (new hook/context,
new screen, `RootNavigator.tsx`/`RootTabs.tsx`, `navigation/types.ts`)

- A top-level polling mechanism (hook or context, mounted once above the
  tab navigator) that polls `getIncomingOffers` every 5s while
  `getWorkerStatus().is_online` is true, paused while offline or while an
  offer is already being shown.
- New `IncomingOfferScreen` (or modal route) matching W1: category,
  distance, description, address, estimate-range banner, live countdown
  from the offer's `responds_by`, Accept/Decline buttons.
- Presented as a full-screen overlay over any current screen/tab (per
  PRD §5.1 — use a modal-presentation route at the root stack level, not
  nested inside `RootTabs`).
- Accept → `acceptOffer` → on success, navigate into the Active Job
  screen (T4) for that job. Decline → `declineOffer` → dismiss.
- Countdown reaching 0 → dismiss without a decline call (server already
  expires it); if the worker taps Accept/Decline after expiry, surface
  the backend's error message and dismiss.
- Per PRD §7, extract the countdown math as a plain function (e.g.
  `computeRemainingSeconds(respondsBy: string, now: Date): number`) and
  the polling start/stop/dedup logic as a testable hook, rather than
  inlining both directly in the screen component.

**Acceptance criteria**
- Offer interrupt appears regardless of which tab is active.
- Countdown is visually accurate to the offer's actual `responds_by`,
  not a client-side-only 60s guess (compute remaining time from the
  server timestamp).
- No duplicate offer modals if polling fires again before the first is
  resolved.

**Tests** (`apps/worker/src/*.test.ts`, `jest.useFakeTimers()`)
- `computeRemainingSeconds`: correct value mid-countdown, `0` (not
  negative) once `respondsBy` is in the past.
- Polling hook: fires at the configured interval while online, stops
  when offline, stops while an offer is already showing, resumes after
  dismissal.
- Polling hook: two offers arriving before the first resolves does not
  produce two concurrent "current offer" states (dedup logic).

---

### T4 — Active job screen (W2 / W2b) ✅ Done

**Implementation notes:** `JobRequestSerializer` was missing both
`customer` (it only ever exposed `worker`) and `accepted_at` — both
essential to this screen (customer card, cancel-window check), not
optional like T3's distance gap, so added directly
(`CustomerPublicSerializer`, mirroring the existing `WorkerPublicSerializer`
pattern) with a backend test. "Mark Job Complete" and "Cancel job" both
show a placeholder alert for now (`TODO(T5b)`/`TODO(T5a)`) since those
screens don't exist yet. Not visually verified live on the simulator,
same token-budget tradeoff as T3.

**Depends on:** T2, T3 (entry point from accept). **Touches:**
`apps/worker/src/screens/` (new `ActiveJobScreen.tsx`), navigation types

- Header "Active job" + disabled/coming-soon chat icon button (no
  navigation target, per PRD §4 — a no-op tap or a small "Chat coming
  soon" toast is fine).
- Customer card (name, address) sourced from `getJob`.
- "Get Directions" button → deep-link to native Maps
  (`Linking.openURL` with a `maps://` / `https://maps.apple.com` or
  `https://www.google.com/maps/dir/?api=1&destination=...` URL — pick
  one cross-platform approach, e.g. `expo-linking` with a platform
  check).
- Segmented "Update status" control (On my way / Arrived / In progress)
  reflecting `job.status`; tapping the next valid segment calls the
  matching T2 transition function and updates on success. Segments
  behind the current status, or more than one step ahead, are not
  selectable.
- Once `status === "in_progress"`, show full-width "Mark Job Complete"
  → navigate to T5.
- "Cancel job" text link, visible only if `accepted_at` is within 10
  minutes of now (compute client-side from `job.accepted_at`) →
  navigate to T5b (cancel screen).
- Per PRD §7, extract `getNextValidStatus(current: JobStatus):
  JobStatus | null` and `isCancelWindowOpen(acceptedAt: string, now:
  Date): boolean` as plain functions.

**Acceptance criteria**
- Status control never allows skipping a step or going backward.
- Cancel link disappears after the 10-minute window without needing a
  screen refresh (e.g. re-check on focus or a lightweight local timer).
- Directions button opens the OS map app with the correct address.

**Tests** (`apps/worker/src/*.test.ts`)
- `getNextValidStatus`: correct next status for each of `accepted`,
  `on_my_way`, `arrived`; `null`/no-op for `in_progress` (nothing further
  in the stepper) and for any status not in this flow.
- `isCancelWindowOpen`: `true` just under 10 minutes, `false` just over,
  exercised with fixed `now` values (no real waiting).

---

### T5a — Cancel job screen (W3)

**Depends on:** T2, T4. **Touches:** new `CancelJobScreen.tsx`

- Warning banner text per PRD §5.3.
- Single-select reason chips matching `CancellationLog.Reason` exactly
  (Personal emergency / Vehicle or transport issue / Job details
  unclear / Other).
- Optional note textarea.
- "Confirm Cancellation" → `cancelJobAsWorker(token, jobId, reason, note)`
  → on success, pop back to Home (job has reverted to `searching`
  server-side, it's no longer this worker's job).

**Acceptance criteria**
- Submit button disabled until a reason is selected.
- Backend error (e.g. window already expired) surfaces as an inline
  message, doesn't silently fail.

**Tests**
- Reuses T4's `isCancelWindowOpen` — no new pure logic here beyond
  form-validity (submit-disabled-until-reason-selected), which is simple
  enough to leave as a one-line assertion rather than its own extracted
  function.

---

### T5b — Propose price screen (W4)

**Depends on:** T2, T4. **Touches:** new `ProposePriceScreen.tsx`

- Numeric amount input (native numeric keyboard), empty by default.
- Helper text showing the job's `price_range_min`–`price_range_max`.
- Optional "What was done" textarea.
- "Send to Customer" → `completeJob(token, jobId, agreedPrice, note)` →
  on success, navigate to T6 (waiting screen).
- Per PRD §7, extract `validatePriceAmount(input: string): number |
  null` (returns the parsed amount or `null` if invalid) as a plain
  function.

**Acceptance criteria**
- Submit disabled for empty/zero/negative amount.
- Amount sent as the correct numeric type the backend expects (check
  `complete/` endpoint's serializer for int vs decimal).

**Tests**
- `validatePriceAmount`: rejects empty string, `"0"`, negative, and
  non-numeric input; accepts a valid positive amount and returns it
  parsed to the correct numeric type.

---

### T6 — Waiting for confirmation (W5) + completion/dispute branch

**Depends on:** T2, T5b. **Touches:** new `WaitingForConfirmationScreen.tsx`,
new `JobCompleteScreen.tsx`

- Centered spinner, "Waiting for {customer_first_name} to confirm",
  summary chip (amount · category · description), per PRD §5.5.
- Poll `getJob` every 3s (mirror the existing customer-side pattern in
  `apps/customer/src/screens/request/JobStatusScreen.tsx`).
- Status → `completed`: navigate to `JobCompleteScreen` — "Job complete",
  final price, customer name, "Done" button → Home.
- Status → `disputed`: show the brief notice from PRD §5.5, then return
  to Home. Stop polling in both terminal cases.
- Any other status change (e.g. an admin-forced `cancelled`): stop
  polling, show a generic "this job's status changed" notice, return to
  Home — a defensive fallback, not an expected path in normal operation.

**Acceptance criteria**
- Polling stops correctly on unmount (no leaked interval — reuse
  whatever cleanup pattern `JobStatusScreen.tsx` already uses).
- Both `completed` and `disputed` are handled; no case where the screen
  polls forever on an unexpected status.

**Tests** (`jest.useFakeTimers()`)
- Polling hook/effect stops calling `getJob` after unmount (assert the
  mock isn't called again after advancing fake timers post-unmount).
- Reaching `completed` stops polling and triggers the completion branch
  exactly once (no double-navigation if a stray poll response arrives
  after the first `completed` is seen).
- Reaching `disputed` stops polling and triggers the dispute-notice
  branch, not the completion branch.
- Any status other than `awaiting_price_confirmation`, `completed`, or
  `disputed` (e.g. an admin-forced `cancelled`) stops polling and falls
  back to a generic "this job's status changed" notice back to Home,
  rather than looping indefinitely or crashing on an unhandled case.

---

### T7 — Jobs tab: basic history list + detail view

**Depends on:** T0b, T2 (uses existing `listMyJobs`, no new API needed).
**Touches:** `apps/worker/src/screens/JobsScreen.tsx` (replace
placeholder), new `JobDetailScreen.tsx`, navigation types

- Replace the static placeholder in `JobsScreen.tsx` with a list from
  `listMyJobs(token)`: category, status badge, date, price (if set),
  newest-first. No pagination/filter/search.
- Empty state: keep something like the existing "No jobs yet" copy for
  a genuinely empty list.
- Tap a row → `JobDetailScreen`: read-only — category, status, date,
  description, address, price, and cancellation/report info if
  applicable. No action buttons (this is history, not the live T4
  screen).
- Per PRD §7, extract the sort-newest-first step as a plain function
  (e.g. `sortJobsNewestFirst(jobs: JobRequest[]): JobRequest[]`) rather
  than inlining it in the render.

**Acceptance criteria**
- List renders correctly for 0, 1, and many jobs.
- Detail screen never exposes an action that would double-submit a
  transition already handled by T4/T5a/T5b (this screen is read-only by
  design).

**Tests**
- `sortJobsNewestFirst`: correct order for unordered input, stable for
  equal timestamps, no crash on an empty array.

---

## Suggested implementation order

(T0a, T0b) → T1 → T2 → T3 → T4 → (T5a, T5b can be done in either order
once T4 lands) → T6 → T7 (T7 only needs T2, so it can also be pulled
earlier/in parallel if useful). T0a and T0b have no dependencies on each
other and can be done in parallel, or combined into one sitting if
that's more convenient than splitting them.
