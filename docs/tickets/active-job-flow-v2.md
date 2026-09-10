# Tickets: Active-Job & Pricing Flow v2

PRD: `docs/prds/active-job-flow-v2.md`
Design brief: `docs/design/active-job-flow-v2-brief.md`

Implement in order — each ticket is its own commit (or small PR), reviewed
before the next. **Every ticket has a "Tests" subsection — a ticket isn't
done until those tests exist and pass**, per PRD §7/§8.

## Before starting

- **Hi-fi:** T1–T4 (backend + api client) don't need it. T5–T9 (screens)
  should wait for the updated hi-fi from the design brief, or proceed
  against the brief's copy with a visual pass once the hi-fi lands.
- **Open questions (PRD §9) — resolved to the PRD defaults unless you say
  otherwise:** no quote-expiry timer; worker may re-submit a quote while
  `quote_pending` (overwrites); `declined` is its own terminal status;
  customer Reject captures no reason; push triggers **are** in scope (T3);
  `dispute-price` kept and retargeted to `completed`. Flag now if any of
  these should flip — T1/T2/T3 encode them.
- **Dev DB:** the shared Postgres has in-flight test jobs in soon-to-be-
  removed statuses. T1's data migration remaps them; spot-check afterwards
  and cancel anything nonsensical.

---

### T1 — Backend: status model + timestamps + migration  ✅ Done

**Depends on:** nothing. **Touches:** `backend/jobs/models.py`,
`backend/jobs/migrations/`, `backend/jobs/tests/`

- `JobRequest.Status`: remove `ON_MY_WAY`, `AWAITING_PRICE_CONFIRMATION`;
  add `QUOTE_PENDING = "quote_pending"`, `QUOTE_ACCEPTED = "quote_accepted"`,
  `DECLINED = "declined"`.
- `TERMINAL_STATUSES = (COMPLETED, CANCELLED, DECLINED, DISPUTED)`.
- Drop `JobRequest.on_my_way_at`. Add `quoted_at`, `quote_accepted_at`
  (`DateTimeField(null=True, blank=True)`, same comment block as the
  existing per-stage timestamps).
- Migration, two parts:
  1. schema: field add/remove (the `status` choices change is not a DB
     constraint — no data op needed for the column type).
  2. data (`RunPython`, reversible-ish): `on_my_way → accepted`,
     `awaiting_price_confirmation → quote_pending`. Copy `on_my_way_at`
     nowhere (dropped). Leave a comment that prod had no real job data at
     write time.
- Audit every `TERMINAL_STATUSES` / `status__in=[...]` / `status ==` use
  site in `backend/` (`grep -rn "on_my_way\|awaiting_price_confirmation\|
  TERMINAL_STATUSES" backend/`): `DeleteAccountView`, `matching.py`,
  `JobRequestListCreateView` (`status_group` filter), serializers, admin.

**Acceptance criteria**
- `python manage.py makemigrations --check` clean after the migration is
  committed.
- Migration applies forward on a DB seeded with one `on_my_way` and one
  `awaiting_price_confirmation` job and leaves them `accepted` /
  `quote_pending`.
- No Python references to the two removed enum members remain
  (grep is clean except comments describing the change).
- `declined` is in `TERMINAL_STATUSES`; the account-deletion active-job
  guard treats a `declined` job as not-blocking.

**Tests** (`backend/jobs/tests/test_status_model.py` + migration test)
- `TERMINAL_STATUSES` contains exactly the 4 expected values.
- A data-migration test (use `django-test-migrations` if already
  available, else a plain `call_command('migrate', ...)` round-trip in a
  test) asserting the remap.
- Regression: `DeleteAccountView` allows deletion when the user's only
  job is `declined`; still blocks on `quote_pending` / `in_progress`.

---

### T2 — Backend: endpoints for the new flow  ✅ Done

**Depends on:** T1. **Touches:** `backend/jobs/views.py`,
`backend/jobs/urls.py`, `backend/jobs/serializers.py`,
`backend/jobs/models.py` (CancellationLog), `backend/jobs/tests/`

- **`CancellationLog`**: add `kind` — `Kind = (CANCELLATION =
  "cancellation", ON_SITE_DECLINE = "on_site_decline")`, default
  `CANCELLATION`. Migration.
- **`ArrivedView`**: `required_current` `ON_MY_WAY → ACCEPTED`; keep
  `timestamp_field = "arrived_at"`. Update `error_detail`.
- **`StartJobView`**: `required_current` `ARRIVED → QUOTE_ACCEPTED`.
  Update `error_detail`.
- **Remove `OnMyWayView`** + its `urls.py` line.
- **`QuoteView`** (new, `POST /jobs/<id>/quote/`, `IsWorkerRole`, must be
  `job.worker`):
  - valid when `status in (ARRIVED, QUOTE_PENDING)` — the second allows an
    overwrite while still pending.
  - body via `QuoteSerializer` (rename `CompleteJobSerializer`):
    `agreed_price` (Decimal, `> 0`, `max_digits=8`), `note` (optional).
  - sets `agreed_price`, `worker_note`, `status = QUOTE_PENDING`,
    `quoted_at = now()` (only stamp `quoted_at` on the first transition,
    not on an overwrite — or always; decide and note. Suggest: stamp on
    first only, so the customer sees when the quote first arrived).
- **`ConfirmQuoteView`** (rename `ConfirmPriceView`, `POST
  /jobs/<id>/confirm-quote/`, `IsCustomerRole`):
  - valid when `status == QUOTE_PENDING` → `QUOTE_ACCEPTED`,
    `quote_accepted_at = now()`.
  - keep the old `/confirm-price/` path as a 410/redirect? No — no prod
    clients. Just rename; T4 updates the only caller.
- **`RejectQuoteView`** (new, `POST /jobs/<id>/reject-quote/`,
  `IsCustomerRole`):
  - valid when `status == QUOTE_PENDING` → `CANCELLED`. No body.
- **`DeclineJobView`** (new, `POST /jobs/<id>/decline/`, `IsWorkerRole`,
  must be `job.worker`):
  - valid when `status in (ARRIVED, QUOTE_PENDING)` → `DECLINED`.
  - body: `reason` (required, `CancellationLog.Reason` choices), `note`
    (optional). Writes `CancellationLog(job, worker, reason, note,
    kind=ON_SITE_DECLINE)`.
  - clears `job.worker`? **No** — keep it for the customer's "declined by
    X" screen and analytics; `declined` is terminal so matching won't
    touch it.
- **`CompleteJobView`**: drop `CompleteJobSerializer` usage and the
  `agreed_price`/`worker_note` writes. Now: valid when `status ==
  IN_PROGRESS` → `COMPLETED`, no body. (`agreed_price` is already set from
  the quote step.)
- **`DisputePriceView`**: `required_current`
  `AWAITING_PRICE_CONFIRMATION → COMPLETED`. Everything else unchanged
  (still files a `pricing_disagreement` `Report`, still → `DISPUTED`).
- **`JobRequestSerializer`**: remove `on_my_way_at`; add `quoted_at`,
  `quote_accepted_at`.
- **`WorkerCancelView`** path: no logic change; add a comment that
  `arrived`+ now exits via `/decline/`.
- **`NearbyJobsView` / matching**: confirm nothing offered a `declined`
  job (it's terminal; `try_match` early-returns on non-`searching`).

**Acceptance criteria**
- `POST /jobs/<id>/arrived/` works from `accepted`, 400 from anything else.
- `POST /jobs/<id>/quote/` from `arrived` → `quote_pending` with price +
  note + `quoted_at` set; a second call from `quote_pending` overwrites
  the price; 400 from `accepted`/`in_progress`/terminal.
- `POST /jobs/<id>/confirm-quote/` from `quote_pending` → `quote_accepted`
  + `quote_accepted_at`; 400 otherwise; 403 for the worker.
- `POST /jobs/<id>/reject-quote/` from `quote_pending` → `cancelled`; 403
  for the worker.
- `POST /jobs/<id>/decline/` from `arrived` or `quote_pending` →
  `declined` + a `CancellationLog(kind=on_site_decline)` row with the
  reason; 400 from `accepted`/`in_progress`; missing `reason` → 400.
- `POST /jobs/<id>/start/` only from `quote_accepted`.
- `POST /jobs/<id>/complete/` takes no body, only from `in_progress`.
- `POST /jobs/<id>/dispute-price/` only from `completed`; still → 
  `disputed` + `Report`.
- `/on-my-way/` route is gone (404).
- Serializer payload has `quoted_at`, `quote_accepted_at`, no
  `on_my_way_at`.

**Tests** (`backend/jobs/tests/test_active_job_transitions.py` — rewrite;
`test_quote_and_decline.py` — new)
- Full happy chain `accepted → arrived → quote → confirm → start →
  complete`, asserting status + each timestamp at each step.
- Quote overwrite while `quote_pending`.
- Decline from `arrived` and from `quote_pending`; `CancellationLog`
  written with `kind` + reason; job `declined`.
- Reject from `quote_pending` → `cancelled`.
- Every guard: wrong-state 400s, wrong-role 403s, not-your-job 403s, for
  each endpoint.
- `complete/` rejects a body with a price (ignored) and works with none.
- `dispute-price/` from `completed` → `disputed`; from `quote_pending` →
  400.
- Regression: offer accept/decline, customer cancel pre-arrival, worker
  10-min cancel from `accepted`, rating on `completed`, all still pass.

---

### T3 — Backend: push notification triggers  ✅ Done

**Depends on:** T2. **Touches:** `backend/jobs/views.py`,
`backend/notifications/`, `backend/jobs/tests/`

Wire `send_push_notification.delay(...)` at three points, matching the
existing style in `try_match` / `AcceptOfferView` / `MessageListCreateView`
(`data={"type": ..., "job_id": job.id}`):
- `QuoteView` first transition → **customer**: "New price for your [cat]
  job — tap to review".
- `ConfirmQuoteView` → **worker**: "[customer first name] accepted your
  quote — you can start".
- `RejectQuoteView` and `DeclineJobView` → the other party:
  - reject → **worker**: "[customer] didn't accept the quote".
  - decline → **customer**: "[worker] couldn't take the job".

**Acceptance criteria**
- Each transition enqueues exactly one push to the right recipient with
  the right `data.type`.
- No push on a quote *overwrite* (only the first `arrived → quote_pending`).

**Tests** (`backend/jobs/tests/test_active_job_notifications.py`, mock/
assert `send_push_notification.delay`)
- One assertion per trigger: recipient id + `data` payload shape.
- Overwrite quote → no second push.
- Mirrors the existing `notifications` test style (T1–T4 of push PRD).

---

### T4 — `packages/api`: client functions  ✅ Done

**Depends on:** T2 (paths/shapes). **Touches:** `packages/api/src/jobs.ts`,
`packages/api/src/jobs.test.ts`, both apps' call sites (compile only).

- Remove `markOnMyWay`.
- `completeJob(token, jobId)` — drop `agreedPrice` / `note` params + body.
- Rename `confirmPrice → confirmQuote` (`POST .../confirm-quote/`).
- Add:
  - `submitQuote(token, jobId, agreedPrice, note?)` → `POST .../quote/`,
    body `{ agreed_price, note }` (omit `note` key when not passed, per
    the existing convention — check `cancelJobAsWorker`).
  - `declineJob(token, jobId, reason, note?)` → `POST .../decline/`,
    body `{ reason, note }`.
  - `rejectQuote(token, jobId)` → `POST .../reject-quote/`, no body.
- `disputePrice` unchanged.
- Update `JobStatus` union type: drop `on_my_way`,
  `awaiting_price_confirmation`; add `quote_pending`, `quote_accepted`,
  `declined`. Add `quoted_at` / `quote_accepted_at` to the `JobRequest`
  type; remove `on_my_way_at`.

**Acceptance criteria**
- `packages/api` typechecks; both apps typecheck (call sites for the
  removed/renamed fns are updated in T5–T9, so expect this ticket to
  leave a few known TS errors in the apps — list them in the PR
  description, or stub them; don't leave `main` red — coordinate with
  T5).
- `JobStatus` has no stale members.

**Tests** (`packages/api/src/jobs.test.ts`, mocked `fetch`)
- Method + path for each new/changed fn.
- `submitQuote` / `declineJob` body shape (note omitted vs empty).
- `completeJob` sends no body.
- Non-2xx → rejected promise, same convention as the file's other fns.

---

### T5 — apps/worker: active-job state machine + screens  ✅ Done

**Depends on:** T4. **Touches:** `apps/worker/src/activeJob/`,
`apps/worker/src/screens/` (`ActiveJobScreen`, new `EvaluateScreen`,
`ProposePriceScreen → SendQuoteScreen`, new `DeclineJobScreen` or extend
`CancelJobScreen`, `WaitingForConfirmationScreen`, `JobCompleteScreen`),
`apps/worker/src/navigation/` (`types.ts`, `RootNavigator.tsx`),
`apps/worker/src/waitingForConfirmation/useJobStatusPolling.ts`

- **`activeJob/statusTransitions.ts`** — rewrite as the single source of
  "given a job status, what does the worker see / what's the primary
  action":
  - `accepted` → ActiveJob "heading there", primary "I've arrived"
  - `arrived` → EvaluateScreen (Accept & send quote / Decline)
  - `quote_pending` → WaitingForConfirmation ("waiting for the customer")
  - `quote_accepted` → ActiveJob "ready to start", primary "Start work"
  - `in_progress` → ActiveJob "in progress", primary "Complete job"
  - `completed` → JobComplete
  - `declined` / `cancelled` → terminal notice, back to Jobs
  Keep it a pure function/table so it's unit-testable.
- **`ActiveJobScreen`** — status-driven container; remove the
  On-my-way/Arrived/In-progress segmented control. One contextual primary
  button. Header keeps chat + (contextual) cancel/report. "Get Directions"
  on `accepted` and `quote_accepted`, drop on `in_progress` (PRD §9.6).
- **`EvaluateScreen`** (new) — "Assess the job" + helper + two buttons.
- **`ProposePriceScreen → SendQuoteScreen`** — rename; same amount field +
  `priceValidation` + typical-range helper + optional note; button "Send
  quote"; calls `submitQuote`; on success → WaitingForConfirmation.
- **Decline** — extract the reason-picker from `CancelJobScreen` into a
  shared component; `DeclineJobScreen` (or a mode of `CancelJobScreen`)
  uses it, calls `declineJob`, on success → terminal notice.
- **`WaitingForConfirmationScreen`** + **`useJobStatusPolling`** —
  target status becomes `quote_accepted` (advance → ActiveJob ready); also
  handle `cancelled` (customer rejected → "quote declined" notice) and
  `declined`. Still 3s polling.
- **`JobCompleteScreen`** — strip any price entry; show agreed amount as
  read-only confirmation + "Back to Jobs".
- **Nav types**: `ProposePrice → SendQuote`; add `Evaluate`, `DeclineJob`
  (if separate). Keep param shape `{ jobId: number }`.

**Acceptance criteria**
- Worker can drive `accepted → arrived → quote → (wait) → start →
  complete` entirely from these screens, against a real backend.
- Decline from the Evaluate screen closes the job and returns the worker
  to Jobs.
- No screen offers a price entry after "Complete".
- No reference to `on_my_way` / `markOnMyWay` /
  `awaiting_price_confirmation` in `apps/worker`.

**Tests** (`apps/worker/src/activeJob/statusTransitions.test.ts` rewrite;
`waitingForConfirmation/useJobStatusPolling.test.ts` update;
`activeJob/priceValidation.test.ts` unchanged — confirm still green)
- `statusTransitions` returns the right screen/action for all 7 statuses
  + the two terminals.
- `useJobStatusPolling`: advances on `quote_accepted`; surfaces the
  "rejected" branch on `cancelled`; stops polling on any terminal.

---

### T6 — apps/worker: Jobs tab status labels  ✅ Done

**Depends on:** T4 (types). **Touches:**
`apps/worker/src/jobsTab/jobDetailFormatting.ts` (+ `sortJobs.ts`,
`jobsTabGrouping.ts` if they branch on removed statuses), their tests.

- New status → chip label/colour: `arrived` "EVALUATING",
  `quote_pending` "QUOTE SENT", `quote_accepted` "READY", `in_progress`
  "IN PROGRESS", `declined` "DECLINED" (neutral grey). Remove "ON MY WAY".
- Confirm Active/Completed grouping still puts `declined` under Completed
  (terminal) not Active.

**Acceptance criteria**
- Every current `JobStatus` renders a chip; no `undefined`/fallthrough.
- `declined` groups with completed/cancelled.

**Tests** (`jobsTab/jobDetailFormatting.test.ts` etc.)
- Label + colour for each new/changed status.
- Grouping test covers `declined`.

---

### T7 — apps/customer: job-status timeline (C4)  ✅ Done

**Depends on:** T4. **Touches:**
`apps/customer/src/screens/request/JobStatusScreen.tsx`,
new `apps/customer/src/request/jobStatusSteps.ts` (+ test)

- Extract to `jobStatusSteps.ts` (pure, tested):
  - `STEP_LABELS = ["Requested", "Accepted", "Arrived", "Price agreed",
    "In progress", "Complete"]`
  - `reachedStepIndex(status)` for the new set — `quote_pending` and
    `quote_accepted` both map to index 3 (Price agreed), the latter as
    "reached", the former as "current/pending action".
  - `headlineForStatus(status, name)` — one string per status per the
    design brief.
  - `timestampIsoByIndex(job)` — `[created_at, accepted_at, arrived_at,
    quote_accepted_at, started_at, null]`.
- `JobStatusScreen` consumes it; the poll effect redirects: on
  `quote_pending` → surface the "confirm the quote" CTA (route to
  `ConfirmQuote`); on `declined` → `WorkerDeclined`; on `cancelled` /
  `disputed` → existing behaviour; `completed` → payment/rating as now.
- Remove `on_my_way` handling.

**Acceptance criteria**
- All 6 steps render with correct reached/current/pending + timestamps
  for every status.
- `quote_pending` shows the confirm CTA; tapping it opens `ConfirmQuote`.

**Tests** (`apps/customer/src/request/jobStatusSteps.test.ts`)
- `reachedStepIndex` for every status (incl. `quote_pending` vs
  `quote_accepted`).
- `headlineForStatus` snapshot per status.
- `timestampIsoByIndex` picks the right field.

---

### T8 — apps/customer: confirm-quote + declined screens  ✅ Done

**Depends on:** T4, T7. **Touches:**
`apps/customer/src/screens/request/PriceAgreementScreen.tsx →
ConfirmQuoteScreen.tsx`, new `WorkerDeclinedScreen.tsx`,
`apps/customer/src/navigation/types.ts`, `RootNavigator.tsx`,
`RequestSubmissionScreen` (prefill support)

- **`PriceAgreementScreen → ConfirmQuoteScreen`** — shown at
  `quote_pending`. Shows `agreed_price`, `worker_note`, the estimate
  range. **Confirm N$X** → `confirmQuote` → back to `JobStatus`.
  **Reject** → confirm dialog ("Rejecting closes this job — you can
  request again") → `rejectQuote` → `JobStatus` (which then routes on
  `cancelled`). Remove the "This isn't right → dispute" affordance.
- **`WorkerDeclinedScreen`** (new) — terminal. Shows the decline reason
  (from `job` — needs the serializer to expose the latest
  `CancellationLog` reason, or a `decline_reason` convenience field;
  add to T2 if not there). "Request again" → `RequestSubmission` with
  `{ prefill: { categoryId, description, address, coords } }` from the
  old job. "Back to home".
- **`RequestSubmissionScreen`** — accept an optional `prefill` param
  (reuse the saved-address application pattern).
- **Nav types**: `PriceAgreement → ConfirmQuote`; add `WorkerDeclined:
  { jobId: number }`; `RequestSubmission` param gains optional `prefill`.
- Post-completion **"Pricing disagreement"** stays in
  `ReportProblemScreen`; wire that option (when `job.status ===
  "completed"`) to `disputePrice` instead of `reportJob` so it flips to
  `disputed` (or confirm the existing wiring already does — check).

**Acceptance criteria**
- Customer confirms a quote → job `quote_accepted`, worker advances.
- Customer rejects → job `cancelled`, both apps show it closed.
- `declined` job → `WorkerDeclined` with the reason; "Request again"
  opens a pre-filled request.

**Tests**
- `apps/customer/src/request/` — if any prefill-merge logic is
  non-trivial, extract + test it (mirror `applySavedAddress.test.ts`).
- Reject confirm-dialog gating logic if extracted.

---

### T9 — apps/customer: Jobs tab status labels  ✅ Done

**Depends on:** T4. **Touches:**
`apps/customer/src/jobsTab/formatJobStatus.ts` (+ test)

- New labels for `arrived` / `quote_pending` / `quote_accepted` /
  `in_progress`; add `declined` ("Declined by worker", neutral). Remove
  `on_my_way`, `awaiting_price_confirmation`.
- Confirm `declined` groups under Completed.

**Tests** (`jobsTab/formatJobStatus.test.ts`)
- Label + treatment for every status; `declined` present; no stale keys.

---

### T10 — Full click-test pass + docs

**Depends on:** T1–T9. **Touches:** `PROGRESS.md`, `CLAUDE.md` (only if a
detail drifted from the design-session note)

- Two-app Simulator run (worker + customer, Claude driving one side via
  REST as in the 2026-09-07/08 pass):
  1. Happy path: request → match → accept → arrived → quote → customer
     confirm → start → complete → pay (stub) → rate.
  2. Decline path: worker declines at Evaluate → customer sees
     `WorkerDeclined` → "Request again" works.
  3. Reject path: worker quotes → customer rejects → job closed both
     sides.
- Fix whatever the run surfaces (expect 1–3 small bugs, as every prior
  pass).
- Update `PROGRESS.md`: mark step 8 reworked, move the "decided, not
  built" section to "done", record final test counts.

**Acceptance criteria**
- All three paths verified live with screenshots/DB checks.
- `backend` + `worker` + `customer` suites green; note the counts.
- No `on_my_way` / `awaiting_price_confirmation` anywhere in the repo
  (grep, excluding this PRD/tickets/CLAUDE historical notes).

---

## Follow-up (raised during T10, 2026-09-08) — customer completion confirmation

**Feedback:** after the worker taps "Complete job", the customer should
also confirm the work is done, so both parties agree the job is finished
(symmetry with the pre-work quote confirmation).

Not yet designed. Open questions before it can be ticketed:
- New status between `in_progress` and `completed` (e.g.
  `awaiting_completion_confirmation`)? Worker "Complete job" →
  that state → customer "Confirm job done" → `completed`.
- What if the customer says the work *isn't* done? A "not finished yet"
  action that bounces the job back to `in_progress`, vs. routing to the
  existing "Quality of work" report.
- Does it gate the Rating screen / payment, or run alongside?
- Timeout / auto-confirm if the customer is unresponsive (the PRD chose
  no timer for the quote step — likely consistent here).
- Worker-side screen while waiting (repurpose the WaitingForConfirmation
  pattern again).

Needs a short PRD addendum + its own ticket set; treat as a v2.1.

## Follow-up (raised during T10, 2026-09-08) — job details + photo on the incoming offer  ✅ Done

**Feedback:** the worker should see the full job request — including any
photo the customer attached — *before* accepting.

`IncomingOfferScreen` (W1) now shows the customer's photo (the offer's
`job` payload already carried the signed `photo` URL — it just wasn't
rendered) inside a scrollable body, alongside category / description /
address / estimate. Estimate-banner copy updated to "you'll agree the
final price with the customer on site". No backend/api change.

## Follow-up (raised during T10, 2026-09-10) — navigation audit of the v2 flow  ✅ Done

Every screen in the redesigned flow now has a sensible way back and, where
it makes sense, a one-tap route to home. Fixes:

- **`SendQuoteScreen`** — had no back affordance; worker was committed to
  sending a quote once they tapped "Accept & send quote". Added a `‹`
  header → returns to the evaluate screen (so they can Decline instead, or
  re-read the job).
- **`WaitingForConfirmationScreen` (worker)** — was a spinner with only
  "Message". Added **"Back to Jobs"** and **"Decline this job"** links (the
  job keeps polling and is reachable from the Jobs tab, and the backend
  allows `/decline/` from `quote_pending`).
- **`ActiveJobScreen`** — added a `‹` header button → Jobs tab on all four
  phases. Deliberate "step away" exit; the job persists and re-opens from
  the Jobs tab. `gestureEnabled: false` kept so it can't be swiped away by
  accident.
- **"Decline this job"** on the evaluate screen changed from a bare ghost
  link to an outlined `secondary` button (users repeatedly missed it as a
  tappable control during testing).

Intentionally forward-only: `IncomingOfferScreen` (must Accept/Decline
within the 60s window), `JobCompleteScreen` and `WorkerDeclinedScreen`
(terminal — "Back to Jobs" / "Back to home" only).

Customer side already had it: `JobStatusScreen` `‹` → home, `ConfirmQuote`
`‹` → JobStatus, `WorkerDeclined` → "Back to home" / "Request again".

A full app-wide nav audit (onboarding, Profile, account-deletion, etc.) is
out of scope here.
