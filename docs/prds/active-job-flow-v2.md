# PRD: Active-Job & Pricing Flow v2

Status: Shipped — T1–T10 done, live-tested on the Simulator across
several rounds (2026-09-08/11), merged to `main` (`cdb4abb`) and pushed.
One v2.1 follow-up open (customer completion confirmation — scoped, not
built; see `docs/prds/active-job-flow-v2.1-completion-confirmation.md`).
Hi-fi: `docs/design/prism-hifi-v2.dc.html`.
Owner: Jewel Bansah
Created: 2026-09-08
Supersedes: `docs/prds/worker-active-job-flow.md` (the on-site-status /
propose-price-after portion), and the customer-side price-agreement screen
from the original customer request flow.
Maps to: `PROGRESS.md` build-order step 8 (rework)
Design reference: `docs/design/active-job-flow-v2-brief.md` → updated hi-fi
(to be produced before ticketing).

## 1. Summary

Move price agreement from **after** the work to an **on-site step before the
work starts**, and cut the worker's active-job flow down to what an
informal-sector tradesperson actually does: accept, travel, look at the job,
quote it, get a yes, work, done.

Today the worker marks a job complete, *then* proposes a price on a dedicated
screen, *then* waits on a customer confirm/dispute screen. That is heavy,
easy to get wrong, and backwards from how trades quote. In v2 the worker
runs an **Evaluate** step on arrival (Accept → enter a quote, or Decline →
job closes), the customer taps **Confirm** in-app, and only then does "Start
work" unlock. "Complete" becomes a true finish line with nothing hanging
after it.

This is a two-app change (worker + customer) plus a backend status-model
change. It came out of a full Simulator test pass on 2026-09-07/08 and a
design session the same day — see `CLAUDE.md` → "Active-job & pricing flow
redesign (2026-09-08 design session)" for the decision record.

## 2. Current state (as of 2026-09-08)

### Backend (`backend/jobs/`)
- `JobRequest.Status`: `requested, searching, matched, accepted, on_my_way,
  arrived, in_progress, awaiting_price_confirmation, completed, cancelled,
  disputed`. `TERMINAL_STATUSES = (completed, cancelled, disputed)` — shared
  with `DeleteAccountView`'s active-job guard.
- Per-stage timestamps on `JobRequest`: `accepted_at, on_my_way_at,
  arrived_at, started_at` (added for the customer timeline redesign).
- Worker transition views (`backend/jobs/views.py`):
  `_WorkerJobTransitionView` subclasses `OnMyWayView` (accepted→on_my_way),
  `ArrivedView` (on_my_way→arrived), `StartJobView` (arrived→in_progress),
  each stamping a `timestamp_field`. `CompleteJobView` (in_progress→
  awaiting_price_confirmation) takes `agreed_price` + optional `note` via
  `CompleteJobSerializer` and writes `agreed_price`, `worker_note`.
- `ConfirmPriceView` (awaiting_price_confirmation→completed),
  `DisputePriceView` (awaiting_price_confirmation→disputed, also files a
  `Report`).
- `ReportJobView` (`POST /api/jobs/<id>/report/`) — creates a `Report` and
  returns 201; it does **not** change job status (No-show / Safety / Quality
  reports leave the job running for admin review).
- `DisputePriceView` (`POST /api/jobs/<id>/dispute-price/`) — the *only*
  thing that flips a job to `disputed`; also files a
  `pricing_disagreement` `Report`. Currently gated on
  `status == awaiting_price_confirmation` (confirmed live 2026-09-03/04 via
  the customer's "This isn't right" button on the old price-agreement
  screen).
- `WorkerCancelView` path inside `JobCancelView`: worker free-cancel is only
  valid at `status == accepted` (writes a `CancellationLog`, returns job to
  `searching`); anything later is 400 → "use the dispute flow".
- `CancellationLog` model: `job, worker, reason (personal_emergency /
  transport_issue / job_details_unclear / other), note, created_at`.
- Matching (`backend/jobs/matching.py`): `rematch_nearby_jobs_for_worker`
  only sweeps `status__in=[searching, matched]`.
- `JobRequestSerializer` exposes `accepted_at, on_my_way_at, arrived_at,
  started_at, agreed_price, worker_note, current_offer_responds_by,
  rating, last_message`.

### `packages/api` (`src/jobs.ts`)
`acceptOffer, declineOffer, markOnMyWay, markArrived, markInProgress,
completeJob(token, jobId, agreedPrice, note?), confirmPrice, disputePrice,
cancelJobAsWorker(token, jobId, reason, note?), getIncomingOffers, getJob,
listActiveJobs, listCompletedJobsPage, reportJob, rateJob`.

### apps/worker (`src/`)
- `activeJob/statusTransitions.ts` (+ test) — the current on-my-way→arrived
  →in-progress→complete state machine as a plain function.
- `activeJob/priceValidation.ts` (+ test) — quote amount validation.
- `activeJob/directions.ts` (+ test) — maps deep-link.
- `screens/ActiveJobScreen.tsx` — segmented status control (On my way /
  Arrived / In progress) + "Mark Job Complete".
- `screens/ProposePriceScreen.tsx` — amount + note, "Send to Customer".
- `screens/WaitingForConfirmationScreen.tsx` +
  `waitingForConfirmation/useJobStatusPolling.ts` (+ test) — polls until the
  customer confirms/disputes, *after* the work.
- `screens/CancelJobScreen.tsx` — reason picker + note (10-min window).
- `screens/JobCompleteScreen.tsx` — post-confirmation summary.
- `jobsTab/jobDetailFormatting.ts`, `jobsTab/sortJobs.ts`,
  `jobsTab/jobsTabGrouping.ts` (+ tests) — Jobs tab list.

### apps/customer (`src/`)
- `screens/request/JobStatusScreen.tsx` — 6-row gradient-hero timeline
  (Requested / Accepted / On my way / Arrived / Job started / Complete),
  dynamic headline per status, glowing "most recently reached" ring,
  `reachedStepIndex` logic, per-step timestamps via
  `request/formatClockTime.ts`.
- `screens/request/PriceAgreementScreen.tsx` — "Confirm the price" /
  "This isn't right" (→ dispute), shown *after* the work.
- `screens/request/MatchedScreen.tsx` — 3s auto-advance to JobStatus.
- `screens/request/ReportProblemScreen.tsx` — the 4 Report categories.
- `jobsTab/formatJobStatus.ts` (+ test) — status → chip label/colour.

### Tests (all green as of 2026-09-05: backend 142, worker 58, customer 57)
Relevant: `backend/jobs/tests/test_active_job_transitions.py`,
`test_job_*`; worker `activeJob/*.test.ts`,
`waitingForConfirmation/useJobStatusPolling.test.ts`; customer
`jobsTab/formatJobStatus.test.ts`.

## 3. Goals

1. Price is proposed by the worker **on site, after arriving, before work
   starts**, and confirmed by the customer in-app. Work cannot start until
   the quote is confirmed.
2. The worker can **Decline** a job on-site after evaluating it — a
   sanctioned, penalty-free exit (with a reason) that is distinct from the
   10-minute cancel and from a dispute. Declining **closes the job**
   (terminal `declined`); the customer is told and can re-request. No
   automatic rematch.
3. Remove the "On my way" step. After `accepted`, the worker's next action
   is "I've arrived", which opens the Evaluate step.
4. Remove the post-work pricing step entirely. `in_progress → completed` is
   a single tap with no body.
5. Customer's job-status timeline reflects the new sequence
   (Requested / Accepted / Arrived / Price agreed / In progress / Complete).
6. No regression to: matching, offers, chat, reporting, ratings, payment
   stub, account-deletion guard, Jobs tab.

## 4. Non-goals

- **Re-quoting for scope creep.** The evaluate quote is final. A genuine
  post-agreement dispute goes through `Report → Pricing disagreement` (which
  already exists and routes to admin). No "revise the price" UI.
- **Auto-rematch after a decline.** A declined job is terminal; the customer
  re-requests manually.
- **Customer-side reason capture on Reject.** Rejecting a quote is a single
  confirm — no reason form (see §9 open question if we want one later).
- **A quote-expiry timer.** If the customer never confirms, the worker is
  not auto-released; they can Decline or message. (See §9.)
- **Real payments.** C6/C6b stay stubbed (build-order step 10).
- **Scheduling / "Bookings".** Still not a real concept.
- **Negotiation / counter-offer.** Customer can Confirm or Reject, nothing
  in between.

## 5. User flow

Artboard labels refer to the v2 hi-fi (`active-job-flow-v2-brief.md`).

### 5.1 Worker

1. **Incoming offer (W1)** — unchanged. Accept → `POST /offers/<id>/accept/`
   → `accepted`.
2. **Heading there (W2)** — worker/customer card, Get Directions, chat,
   Cancel job (still the free 10-min cancel, valid only at `accepted`).
   Primary: **"I've arrived"** → `POST /jobs/<id>/arrived/` → `arrived`,
   stamps `arrived_at`.
3. **Evaluate — decision (W2-eval-a)** — "Assess the job". **Accept & send
   quote** → W2-eval-b. **Decline this job** → W2-decline.
4. **Send quote (W2-eval-b)** — amount (validated, `> 0`, within a sane
   ceiling) + optional "what's included" note. **Send quote** →
   `POST /jobs/<id>/quote/` `{agreed_price, note}` → `quote_pending`, stamps
   `quoted_at`, writes `agreed_price` + `worker_note`.
   - Worker may re-submit `quote` while still `quote_pending` (overwrites) —
     covers a fat-fingered amount without forcing a decline. (See §9.)
5. **Decline (W2-decline)** — reason (reuse `CancellationLog.Reason`) +
   optional note → `POST /jobs/<id>/decline/` `{reason, note}` → `declined`
   (terminal), writes a `CancellationLog` row with `kind=on_site_decline`.
6. **Waiting for the customer (W-quote-wait)** — poll `getJob`; advance when
   `status == quote_accepted`; bail to a "job closed" state if
   `status == cancelled` (customer rejected). "Message [customer]" link.
   "Decline this job" still available here.
7. **Ready to start (W-ready)** — "Agreed · N$X" chip. **Start work** →
   `POST /jobs/<id>/start/` → `in_progress`, stamps `started_at`.
8. **In progress (W-inprogress)** — **Complete job** →
   `POST /jobs/<id>/complete/` (no body) → `completed`. No free cancel here;
   "Report a problem" link instead.
9. **Done (W-done)** — "Job complete · N$X · [customer] pays via Mobile
   Money" → Back to Jobs.

### 5.2 Customer

1. **Matched (C3) → auto-advance (unchanged) → Job status (C4).**
2. **Tracking (C4)** — 6-step timeline. Headline strings per §brief. While
   `arrived`: "[worker] is assessing the job". While `quote_pending`: a card
   / CTA "Confirm [worker]'s price to get started" → C-quote.
3. **Confirm the quote (C-quote)** — shows N$X, worker's note, the original
   estimate range. **Confirm N$X** → `POST /jobs/<id>/confirm-quote/` →
   `quote_accepted`, stamps `quote_accepted_at`. **Reject** (confirm dialog:
   "Rejecting closes this job") → `POST /jobs/<id>/reject-quote/` →
   `cancelled`.
4. **Work happens** — timeline shows In progress.
5. **Complete** → **Payment (C6/C6b, stub)** → **Rating (C7)** — all
   unchanged, still after `completed`.
6. **Worker declined (C-declined)** — if `status` becomes `declined`: a
   terminal screen with the reason (unless "Other") and **Request again** →
   pre-fills a new request with the same category/description/location.
7. A **Pricing disagreement** report (C4c) is available once the job is
   `completed` — `POST /jobs/<id>/dispute-price/` → job to `disputed`, files
   a `pricing_disagreement` `Report`, admin review. Not offered at
   `quote_pending` (that's what Reject is for) or mid-work.

## 6. Technical decisions

### 6.1 Status model

Remove `on_my_way`, `awaiting_price_confirmation`. Add `quote_pending`,
`quote_accepted`, `declined`. Final enum:

```
requested → searching → matched → accepted → arrived → quote_pending
  → quote_accepted → in_progress → completed
        (terminal: cancelled | declined | disputed)
```

- `TERMINAL_STATUSES = (completed, cancelled, declined, disputed)` — the
  account-deletion guard and any `status__in=TERMINAL_STATUSES` filters pick
  `declined` up for free; audit every use site.
- **Migration**: schema change on the `status` CharField choices is a no-op
  for Postgres (it's a varchar); the enum is enforced app-side. A data
  migration remaps any in-flight rows: `on_my_way → accepted`,
  `awaiting_price_confirmation → quote_pending`. Prod has **no** real job
  data yet (pilot not launched), so this only matters for the shared dev DB;
  still write it properly.
- Drop `JobRequest.on_my_way_at`; add `quoted_at`, `quote_accepted_at`
  (same nullable-DateTime pattern as the others) for the customer timeline.

### 6.2 Endpoints (`backend/jobs/`)

| Method + path | Transition | Body | Notes |
|---|---|---|---|
| `POST /jobs/<id>/arrived/` | `accepted → arrived` | — | change `required_current` from `on_my_way` |
| `POST /jobs/<id>/quote/` | `arrived → quote_pending` **or** `quote_pending → quote_pending` | `{agreed_price, note?}` | new; reuse renamed `QuoteSerializer` (was `CompleteJobSerializer`); stamps `quoted_at` |
| `POST /jobs/<id>/decline/` | `arrived → declined`, `quote_pending → declined` | `{reason, note?}` | new; writes `CancellationLog(kind=on_site_decline)`; push to customer |
| `POST /jobs/<id>/confirm-quote/` | `quote_pending → quote_accepted` | — | rename of `ConfirmPriceView`; stamps `quote_accepted_at`; push to worker |
| `POST /jobs/<id>/reject-quote/` | `quote_pending → cancelled` | — | new; customer only; push to worker |
| `POST /jobs/<id>/start/` | `quote_accepted → in_progress` | — | change `required_current` from `arrived` |
| `POST /jobs/<id>/complete/` | `in_progress → completed` | **none** | strip the serializer / price handling |
| `POST /jobs/<id>/dispute-price/` | `completed → disputed` | `{details?}` | **keep** `DisputePriceView`; retarget `required_current` from `awaiting_price_confirmation` to `completed` (post-work bill dispute). Still files a `pricing_disagreement` `Report`. |
| retire | — | — | remove `OnMyWayView` + its URL + `markOnMyWay` client fn |

- `OnMyWayView` gone. `markOnMyWay` client fn gone.
- `DisputePriceView` kept, retargeted to `completed` — it stays the single
  path that flips a job to `disputed`. The customer's post-completion
  "Pricing disagreement" report routes through it (not `ReportJobView`).
  `disputePrice` client fn kept.
- `CompleteJobView` body/serializer removed. `agreed_price` / `worker_note`
  are set at `/quote/` now.
- `WorkerCancelView`: no functional change (free cancel already only valid
  at `accepted`). Add a one-line comment that `arrived`+ uses `/decline/`.

### 6.3 `CancellationLog`

Add a `kind` field: `Kind = (cancellation, on_site_decline)`, default
`cancellation`. Keeps the admin queue able to tell "bailed before arriving"
from "arrived, looked, walked" without a second model. `reason` + `note`
reused as-is.

### 6.4 Serializer

`JobRequestSerializer`: drop `on_my_way_at`; add `quoted_at`,
`quote_accepted_at`. No other shape change — `agreed_price` / `worker_note`
were already exposed.

### 6.5 Notifications

Wire two new `send_push_notification` calls (backend push infra exists —
build-order step 11 T1–T4 done):
- to the **customer** when a job hits `quote_pending` ("[worker] sent a
  price — tap to review").
- to the **worker** when a job hits `quote_accepted` ("[customer] accepted
  your quote — you can start") and when it hits `cancelled` from a reject.
Consistent with the existing trigger points in `try_match` / `AcceptOffer` /
`MessageListCreate`. If push wiring is deemed out of scope for this round,
these are one line each and can be a trailing ticket.

### 6.6 `packages/api`

Remove `markOnMyWay`. Add `submitQuote(token, jobId, price, note?)`,
`declineJob(token, jobId, reason, note?)`, `rejectQuote(token, jobId)`.
Rename `confirmPrice → confirmQuote`. `completeJob(token, jobId)` loses its
price args. `disputePrice` unchanged (path is stable; only its server-side
`required_current` moves).

### 6.7 apps/worker

- `activeJob/statusTransitions.ts` — rewrite the state machine + test:
  `accepted → arrived → (evaluate) → quote_pending → quote_accepted →
  in_progress → completed`, `declined` branch, plus which primary action /
  screen each status maps to.
- `activeJob/priceValidation.ts` — unchanged logic, now consumed by
  `SendQuoteScreen`.
- `ActiveJobScreen.tsx` — becomes a status-driven container (heading-there /
  waiting / ready / in-progress). Remove the segmented control.
- New `EvaluateScreen.tsx` (W2-eval-a). `ProposePriceScreen.tsx` →
  `SendQuoteScreen.tsx` (retitle, same fields, reached from Evaluate).
- New `DeclineJobScreen.tsx` **or** extend `CancelJobScreen.tsx` to serve
  both — extract the reason-picker into a shared component either way.
- `WaitingForConfirmationScreen.tsx` + `useJobStatusPolling.ts` — repurpose
  to "waiting for quote confirmation": target status becomes
  `quote_accepted`; also handle `cancelled` (customer rejected). Update
  test.
- `JobCompleteScreen.tsx` — simplify to a no-price confirmation.
- `jobsTab/jobDetailFormatting.ts` — new status chip labels ("HEADING
  OVER", "EVALUATING", "QUOTE SENT", "IN PROGRESS", "DECLINED"). Update
  test + `sortJobs` / grouping if they branch on the removed statuses.
- Navigation types + `RootNavigator`.

### 6.8 apps/customer

- `JobStatusScreen.tsx` — 6-step timeline (Requested / Accepted / Arrived /
  Price agreed / In progress / Complete). New headline map. `reachedStepIndex`
  rewritten for the new status set (no `on_my_way`; `quote_pending` and
  `quote_accepted` both land on the "Price agreed" step, the latter as
  "reached"). Extract the step-resolution logic to a pure function with its
  own test (it's had two bugs already).
- `PriceAgreementScreen.tsx` → `ConfirmQuoteScreen.tsx` — shown at
  `quote_pending`; **Confirm** / **Reject** (Reject → `reject-quote`, confirm
  dialog). Remove the dispute affordance.
- New `WorkerDeclinedScreen.tsx` — terminal, "Request again" pre-fills a new
  request.
- `MatchedScreen.tsx` — unchanged.
- `jobsTab/formatJobStatus.ts` — new labels + `declined` (+ test).
- `ReportProblemScreen.tsx` — no change; "Pricing disagreement" copy may get
  a "only after a price is agreed" note.

## 7. Acceptance criteria

- [ ] A job cannot reach `in_progress` unless it passed through
  `quote_pending → quote_accepted`. `start/` returns 400 from any other
  state.
- [ ] `complete/` accepts no body and 400s unless `status == in_progress`.
- [ ] Worker `quote/` sets `agreed_price` + `worker_note` + `quoted_at`;
  re-posting while `quote_pending` overwrites; 400 from any other state.
- [ ] Worker `decline/` from `arrived` or `quote_pending` → `declined`
  (terminal), writes a `CancellationLog(kind=on_site_decline)` with the
  reason; customer's app shows the declined terminal screen.
- [ ] Customer `confirm-quote/` → `quote_accepted`; `reject-quote/` →
  `cancelled`; both worker-visible within one poll cycle.
- [ ] `declined` counts as terminal for the account-deletion guard and is
  excluded from `rematch_nearby_jobs_for_worker`.
- [ ] No route, serializer field, client fn, or screen still references
  `on_my_way` / `awaiting_price_confirmation`.
- [ ] Customer timeline renders all 6 steps with correct
  reached/current/pending state for every status, with timestamps.
- [ ] Worker never sees a price-entry screen after "Complete".
- [ ] Existing suites pass; chat, offers, matching, ratings, reporting,
  payment stub, Jobs tabs unaffected.
- [ ] Full happy path + decline path + reject path click-tested on the
  Simulator with both apps (as in the 2026-09-07/08 pass).

## 8. Testing strategy

Same stack as the rest of the project — backend `pytest-django` +
`factory_boy`; mobile `jest-expo` + `@testing-library/react-native` scoped
to **logic** (transition guards, timeline step resolution, quote
validation, polling target-state), not full-screen rendering.

- **Backend** (`backend/jobs/tests/`): rewrite `test_active_job_transitions.py`
  for the new chain; new tests for `quote/`, `decline/`, `confirm-quote/`,
  `reject-quote/`, the no-body `complete/`, the `declined` terminal +
  deletion-guard interaction, and the data migration
  (`on_my_way`/`awaiting_price_confirmation` rows remap). Assert the old
  routes 404 / views are gone.
- **apps/worker**: `activeJob/statusTransitions.test.ts` rewritten;
  `waitingForConfirmation/useJobStatusPolling.test.ts` updated (target
  `quote_accepted`, handle `cancelled`); `activeJob/priceValidation.test.ts`
  unchanged; `jobsTab/jobDetailFormatting.test.ts` new labels.
- **apps/customer**: new `request/jobStatusSteps.test.ts` (extracted step
  resolver — reached/current/pending for each status);
  `jobsTab/formatJobStatus.test.ts` new labels + `declined`.
- **packages/api**: if `jobs.ts` gets a typed-response test file, add the
  new fns; otherwise typecheck only.

## 9. Open risks / questions

1. **Customer never confirms the quote.** Worker sits at `quote_pending`.
   MVP proposal: no timer, no auto-release; worker can Decline or message.
   Acceptable, or do we want a "nudge after N minutes" / auto-expire? →
   *default: no timer for MVP.*
2. **Worker re-quoting while `quote_pending`.** Proposed: allowed
   (overwrite). Any concern about a worker bumping the number repeatedly?
   The customer sees the latest and still has to Confirm. → *default:
   allowed.*
3. **`declined` vs `cancelled`.** Proposed: separate terminal status for
   clean customer messaging ("[worker] couldn't take this job" vs a generic
   cancel) and analytics. Confirm we want the extra enum value. → *default:
   separate.*
4. **Reject reason.** Customer Reject captures no reason in MVP. Worth a
   lightweight "why?" (helps flag bad-quote workers)? → *default: no reason,
   revisit with pilot data.*
5. **Push wiring scope.** Include the two new `send_push_notification`
   triggers in this round or defer to a trailing ticket? → *default:
   include — one line each, infra already built.*
6. **`get Directions` at `quote_accepted`.** Keep the deep-link on the
   ready/in-progress screens too, or drop it once the worker's on site?
   Minor. → *default: keep on W-ready, drop on W-inprogress.*
7. **In-flight jobs in the shared dev DB** at migration time — the remap is
   best-effort; some may be better off just cancelled. Handle in the ticket.

## 10. Ticket outline (for `docs/tickets/active-job-flow-v2.md`)

Rough dependency order — final breakdown in the tickets doc:

- **T1** Backend: status enum + `quoted_at`/`quote_accepted_at` fields,
  drop `on_my_way_at`, `TERMINAL_STATUSES`, data migration. Tests.
- **T2** Backend: `/quote/`, `/decline/` (+ `CancellationLog.kind`),
  `/confirm-quote/` (rename), `/reject-quote/`; retarget `/arrived/`,
  `/start/`, `/dispute-price/`; strip `/complete/`; remove `OnMyWayView`.
  Serializer. Tests.
- **T3** Backend: the two/three push-notification triggers. Tests.
- **T4** `packages/api`: fn add/rename/remove; typecheck both apps.
- **T5** apps/worker: `statusTransitions` rewrite + `ActiveJobScreen`
  container + `EvaluateScreen` + `SendQuoteScreen` + decline flow +
  repurposed waiting screen + simplified complete screen. Nav. Logic tests.
- **T6** apps/worker: Jobs tab status labels / formatting. Tests.
- **T7** apps/customer: `JobStatusScreen` 6-step timeline + extracted step
  resolver + tests.
- **T8** apps/customer: `ConfirmQuoteScreen` (Confirm/Reject) +
  `WorkerDeclinedScreen` + "Request again" prefill. Nav.
- **T9** apps/customer: Jobs tab `formatJobStatus` + tests.
- **T10** Full two-app Simulator click-test pass (happy / decline / reject),
  update `PROGRESS.md`.
