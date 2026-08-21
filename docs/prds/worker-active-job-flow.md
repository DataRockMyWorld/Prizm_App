# PRD: Worker Active-Job Flow

Status: Approved for ticketing
Owner: Jewel Bansah
Created: 2026-08-21
Maps to: `PROGRESS.md` build-order step 8

## 1. Summary

Build the worker-side screens that take a job from "an offer just came in"
through acceptance, on-site status updates, price proposal, and completion.
This is the mobile counterpart to the customer request flow (already built)
— same `JobRequest` lifecycle, opposite side of the table. Also adds a
minimal job-history list to the worker's currently-placeholder Jobs tab,
since a worker needs some way to look back at past/active jobs once this
flow exists.

## 2. Current state (as of 2026-08-21)

- **Backend**: fully built. Every endpoint this flow needs already exists
  under `/api/jobs/` (offer accept/decline, on-my-way/arrived/start,
  complete-with-price, cancel-with-reason, confirm/dispute price, rate,
  report). `JobRequest.Status` and `JobOffer.Status` are already modeled.
  One gap: `CancellationLog` has no field for the optional free-text note
  shown in the W3 mockup (see §6, T1).
- **Frontend (`apps/worker`)**: nothing built yet. `JobsScreen.tsx` and
  `BookingsScreen.tsx` are static placeholders. No navigation routes,
  components, or screens exist for offers, active jobs, cancellation,
  price proposal, or waiting/completion states.
- **`packages/api`**: has `createJobRequest`, `listMyJobs`, `getJob`,
  `cancelJob` (no-reason variant, customer-only), `confirmPrice`,
  `disputePrice`, `reportJob`, `rateJob`. Missing every worker-transition
  call (accept/decline offer, on-my-way, arrived, start, complete,
  cancel-with-reason, incoming-offers poll).
- **Design reference**: `design/brand/prism-auth-flow-hifi.dc.html`,
  section "Worker active-job flow" (lines 674–847), artboards W1, W2, W2b,
  W3, W4, W5.
- **Precedent pattern**: the customer app already solves "wait for a
  status change" with plain 3-second `setInterval` polling of `getJob`
  (`apps/customer/src/screens/request/{SearchingScreen,MatchedScreen,
  JobStatusScreen}.tsx`). This flow reuses that pattern rather than
  introducing push notifications or websockets, since neither exists yet
  (steps 9/11 are unbuilt).

## 3. Goals

- Worker who is online can receive a broadcast job offer, see it as a
  full-screen interrupt with a live 60-second countdown, and accept or
  decline it.
- Once accepted, worker can walk the job through
  on_my_way → arrived → in_progress → mark complete (propose price) →
  wait for customer confirmation → see a completion summary.
- Worker can cancel within the free 10-minute window with a required
  reason (+ optional note), matching the existing backend rule exactly.
- Worker can see a simple list of past/active jobs (Jobs tab) and tap into
  a read-only detail view.

## 4. Non-goals (explicitly out of scope for this PRD)

- **Real chat.** W2 shows a chat icon in the header; this PRD ships it as
  a disabled/"coming soon" affordance only. Real messaging is step 9 in
  `PROGRESS.md` and gets its own PRD.
- **Push notifications.** Offer delivery and status-change awareness use
  polling, per the existing customer-side precedent. Step 11.
- **In-app map/turn-by-turn.** "Get Directions" deep-links to the native
  Maps app; no embedded map view.
- **Earnings/payment.** The completion screen shows the agreed price as a
  confirmation, not an earnings ledger — mobile money integration is step
  10 and still stubbed.
- **Jobs tab richness.** History list only — no filters, search, sort
  options, or pagination UI. Just `GET /api/jobs/` rendered newest-first.
- **Admin-side dispute handling.** If the customer disputes the price,
  the worker sees a notice and the job routes to manual admin review per
  existing CLAUDE.md rules — no new dispute-resolution UI for the worker.

## 5. User flow

Numbering follows the design file's artboard labels; W2b is an
implicit design state (same artboard family as W2, "In progress" segment
active) rather than a separately labeled mockup.

1. **Global offer interrupt (W1 — "New job request")**
   Triggered by background polling (see §6) while the worker is online.
   Full-screen modal over whatever screen the worker is on. Shows
   category, distance, description, address, estimate-range banner
   ("Est. N$150–300 · final price is agreed with the customer"), and a
   live "Respond within 1:00" countdown tied to the offer's
   `responds_by`. Accept / Decline buttons.
   - Accept → `POST /api/jobs/offers/<id>/accept/` → job status
     `accepted` → go to Active Job (§5.2).
   - Decline → `POST /api/jobs/offers/<id>/decline/` → dismiss, return to
     whatever screen was interrupted.
   - Timer hits 0 before a choice is made → treat as expired, dismiss
     modal, return to previous screen (backend already expires the offer
     server-side).

2. **Active job (W2 / W2b — "Active job")**
   Header: "Active job" + a disabled chat icon (see §4).
   Customer card: name, address. "Get Directions" button deep-links to
   native Maps with the job's address/coordinates as destination.
   Segmented "Update status" control: On my way / Arrived / In progress
   — reflects and drives the job's current status.
   - Selecting a segment ahead of the current status calls the matching
     transition endpoint (`on-my-way/`, `arrived/`, `start/`) and updates
     the highlighted segment on success.
   - Once status is `in_progress`, a full-width primary "Mark Job
     Complete" button appears above the cancel link, routing to §5.4.
   - "Cancel job" text link, visible only while cancellation is still
     free (see §5.3 for the exact rule), routes to §5.3.

3. **Cancel job (W3 — "Cancel job")**
   Shown only when within 10 minutes of `accepted_at` (matches backend
   `CancellationLog` window exactly — the backend is the source of truth;
   client-side visibility of the "Cancel job" link is a courtesy, not the
   enforcement point). Warning banner explains the window. Single-select
   reason chips (Personal emergency / Vehicle or transport issue / Job
   details unclear / Other) + optional note textarea. "Confirm
   Cancellation" → `POST /api/jobs/<id>/cancel/` with `{ reason, note }`
   (see §6, T1 for the backend note-field addition) → job reverts to
   `searching` server-side → worker returns to Home.

4. **Propose price (W4 — "Job done — propose a price")**
   Numeric amount field (native numeric keyboard), pre-populated with
   nothing (mockup's "220" is a filled-example, not a default). Helper
   text shows the job's typical range. Optional "What was done" textarea
   → `worker_note`. "Send to Customer" →
   `POST /api/jobs/<id>/complete/` with `{ agreed_price, note }` → job
   status `awaiting_price_confirmation` → go to §5.5.

5. **Waiting for confirmation (W5)**
   Full-screen centered spinner. "Waiting for {customer_first_name} to
   confirm." Summary chip: amount · category · short description. Polls
   `getJob` every 3s (same interval as the customer-side pattern):
   - Status → `completed` → go to §5.6 (completion summary).
   - Status → `disputed` → show a brief notice ("The customer flagged a
     pricing issue — this has been sent for review.") and return to Home.
     No further worker-side dispute UI (see §4).

6. **Completion summary (new screen, not in design file — decided in
   grilling, see PRD history)**
   Simple confirmation: "Job complete", final agreed price, customer
   name. One button, "Done", back to Home. No earnings ledger (§4).

7. **Jobs tab (worker's job history — replaces current placeholder)**
   `GET /api/jobs/`, rendered as a simple list: category, status badge,
   date, price (if set), newest-first, no pagination. Tap a row → a
   read-only detail screen (same fields as the list, plus description,
   address, and cancellation/report info if applicable). No actions
   available from history — this is read-only, distinct from the live
   Active Job screen in §5.2.

## 6. Technical decisions

- **T1 — Backend: add `note` to `CancellationLog`.** Currently
  `WorkerCancelSerializer` only accepts `reason`
  (`backend/jobs/serializers.py:118-119`); the model has no note field
  either (`backend/jobs/models.py:146-163`). Add an optional
  `note = models.TextField(blank=True, default="")`, migration, and
  extend the serializer/view to accept and store it. Small, additive,
  matches the W3 mockup.
- **T2 — Offer polling.** Poll `GET /api/jobs/worker/incoming/` on an
  interval (proposed: 5s) whenever the worker is online, from a
  top-level location (e.g. a hook/context mounted in `RootNavigator` or
  `RootTabs`), not per-screen — this is what makes the "global interrupt"
  requirement (§5.1) work. Stop polling when offline or when an offer
  modal is already showing.
- **T3 — Active-job status polling vs. local updates.** The status
  segmented control (§5.2) is driven by the transition endpoints'
  responses directly (optimistic local update on success), not polling —
  the worker is the one causing these transitions. Polling is only used
  where the worker is waiting on someone else's action (W1 offer expiry
  is timer-based client-side + server-enforced; W5 waits on the
  customer).
- **T4 — `cancelJob` API split.** The existing `packages/api` `cancelJob`
  has no `reason`/`note` params and is used by the customer flow. Add a
  separate function (e.g. `cancelJobAsWorker`) rather than overloading
  the existing one, to avoid touching the already-working customer path.

## 7. Testing strategy

No test infrastructure exists anywhere in this repo yet (verified
2026-08-21: backend apps have empty `tests.py` boilerplate only, no
pytest/factory_boy; frontend has no jest config, no testing-library, no
test files at all; no CI). This PRD stands that up as part of the work,
not as an afterthought — see T0a/T0b in the tickets doc.

- **Backend**: `pytest-django` + `factory_boy`. Every ticket touching
  `backend/jobs/` adds real test cases to `backend/jobs/tests/` (replacing
  the empty boilerplate), using factories for `User`/`WorkerProfile`/
  `CustomerProfile`/`JobRequest` so multi-model setup (a job with a
  matched worker in a specific status) is a few lines, not a wall of
  `setUp`.
- **Frontend**: `jest-expo` + `@testing-library/react-native`, scoped to
  **logic, not full-screen rendering** — this flow's actual risk is in
  timing/state logic (countdown accuracy, polling start/stop, valid
  status-transition ordering, the 10-minute cancel window, price
  validation), not JSX layout, and screens are still likely to change
  shape before pilot. Concretely: extract the risky bits as plain
  functions/hooks (e.g. `computeRemainingSeconds(respondsBy)`,
  `isCancelWindowOpen(acceptedAt)`, `getNextValidStatus(current)`,
  `validatePriceAmount(input)`) so they're unit-testable without
  rendering a component tree. `jest.useFakeTimers()` for anything
  interval/countdown-based instead of real waits.
- **CI**: out of scope for this PRD — tests run
  locally (`docker compose exec backend pytest`, `npm test --workspace=
  apps/worker`) and are part of each ticket's "done" definition. Wiring
  GitHub Actions to run them automatically is a follow-up ticket, not
  blocking this feature.
- **What "done" means per ticket**: a ticket implementing backend logic
  or frontend logic (not pure UI wiring) is not complete until its
  tests exist and pass — see the "Tests" subsection on each ticket in
  `docs/tickets/worker-active-job-flow.md`.

## 8. Acceptance criteria (summary — full detail in tickets)

- A worker who is online and receives a broadcast offer sees it within
  one polling interval, anywhere in the app, with a live countdown.
- Accept/decline/expiry all reflect correctly against the backend's
  actual offer state (no client-only optimism that could desync).
- The status stepper only allows forward transitions matching backend's
  enforced order (on_my_way → arrived → in_progress); attempting an
  invalid transition is not exposed as an option in the UI at all.
- Cancellation is blocked in the UI (link hidden) past 10 minutes from
  `accepted_at`, and the reason is always sent — note is optional.
- Price proposal requires a positive amount; note is optional.
- Waiting screen correctly branches on `completed` vs `disputed`.
- Jobs tab shows real data from `GET /api/jobs/`, no crash on empty list.

## 9. Open risks / follow-ups

- Polling intervals (5s offers / 3s status) are guesses matching existing
  precedent, not load-tested — revisit if battery/data usage or backend
  load becomes a concern before push notifications (step 11) land.
- Chat and push notifications are explicitly deferred; the disabled chat
  icon and polling-based waiting screen are known temporary shims that
  should be revisited when steps 9 and 11 are built.
