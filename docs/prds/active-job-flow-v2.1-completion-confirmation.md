# PRD: Active-Job Flow v2.1 — Customer Completion Confirmation

Status: Draft — tickets drafted (`docs/tickets/active-job-flow-v2.1-completion-confirmation.md`)
Owner: Jewel Bansah
Created: 2026-09-10
Extends: `docs/prds/active-job-flow-v2.md` (v2 must be merged first)
Raised: during the v2 live-test pass (T10) — "I want the customer to
confirm job completion as well so we know both parties are in agreement."

## 1. Summary

v2 moved **price** agreement to before the work (worker quotes on site,
customer confirms). This adds the mirror step at the end: after the
worker taps "Complete job", the **customer confirms the work is
actually done** before the job counts as `completed`. Symmetric mutual
sign-off — price agreed up front by both, completion agreed at the end
by both.

If the customer says it's *not* done, the job goes back to the worker
(`in_progress`) with a note, rather than pulling in admin. If the
customer never responds, the job **auto-confirms after 24 hours** so an
unresponsive customer can't hold up the worker's record.

## 2. Current state (post-v2)

- `POST /api/jobs/<id>/complete/` (`backend/jobs/views.py` `CompleteJobView`)
  takes no body and does `in_progress → completed` directly.
- `JobRequest.Status`: `… quote_accepted → in_progress → completed`
  (+ terminal `cancelled` / `declined` / `disputed`).
- Customer `JobStatusScreen` polls; on `completed` it holds a ~1.8s beat
  then `navigation.replace("Rating", …)`. `RatingScreen` posts to
  `/rate/` (gated on `status == completed`) then `popToTop()`.
- Worker `ActiveJobScreen` in_progress phase: "Complete job" →
  `completeJob()` → `navigation.replace("JobComplete", …)`.
- `DisputePriceView` is gated on `status == completed` (pricing disputes,
  post-work — unchanged by this PRD).
- Celery runs (broker + worker; `send_push_notification` task) but there
  is **no Celery Beat / periodic task** and no scheduler. Offer expiry is
  handled *lazily* on read (`jobs/matching.py refresh_job_matching`),
  which `jobs/matching.py` documents as this project's deliberate
  "polling-first, no background scheduler" approach.

## 3. Decisions (from the 2026-09-10 scoping session)

| Question | Decision |
|---|---|
| Gate strength | **Hard gate.** New status `awaiting_completion_confirmation` between `in_progress` and `completed`. Worker's jobs-completed count, the rating prompt, and future payment all wait for the customer's confirm. |
| "Not done" path | **Send back to the worker.** Job returns to `in_progress` with the customer's note; worker finishes and taps Complete again. No admin involvement. |
| Unresponsive customer | **Auto-confirm after 24 h** from when the worker marked complete. |
| Rating placement | **Separate screen after confirm** — unchanged `RatingScreen`, just now reached only once the customer has confirmed (or it auto-confirmed). |

## 4. Goals

1. `in_progress → completed` always passes through
   `awaiting_completion_confirmation`, resolved by the customer or by the
   24 h auto-confirm.
2. Customer can send an unfinished job back to `in_progress` once (or
   many times) with a short note the worker sees.
3. Worker gets a clear "waiting for the customer to confirm" state (not a
   dead "done" screen) and can see when it will auto-confirm.
4. Rating, payment stub, pricing-dispute, Jobs tabs, matching, chat — no
   regressions.

## 5. Non-goals

- **Admin review of completion.** "Not done" bounces to the worker; it
  does not create a `Report` or a `disputed` job. (A genuine
  quality/safety problem still goes through the existing "Report a
  problem" flow, unchanged.)
- **A photo / proof-of-work upload.** The worker's "Complete job" stays a
  single tap. Could be a later addition.
- **Partial completion / partial payment.** Binary: done or not done.
- **Celery Beat.** The 24 h auto-confirm is a *lazy* check on read (see
  §6.3), consistent with how offer expiry already works — no new service,
  no scheduler.
- **Re-opening a `completed` job.** Once confirmed (or auto-confirmed),
  it's terminal; pricing/quality complaints use the existing report/
  dispute paths.

## 6. Technical design

### 6.1 Status + fields

- `JobRequest.Status`: add
  `AWAITING_COMPLETION_CONFIRMATION = "awaiting_completion_confirmation"`
  between `IN_PROGRESS` and `COMPLETED`.
  New chain: `… quote_accepted → in_progress →
  awaiting_completion_confirmation → completed`.
  **Not** terminal — `TERMINAL_STATUSES` unchanged.
- New `JobRequest` fields:
  - `work_finished_at` (nullable datetime) — stamped when the worker taps
    "Complete job". Drives the 24 h window and the timeline's "Complete"
    row.
  - `completed_at` (nullable datetime) — stamped when the customer
    confirms or the job auto-confirms. The real completion time.
  - `reopen_note` (TextField, blank) — the customer's "what's missing"
    note; shown to the worker on the in_progress screen; cleared each
    time the worker re-submits `/complete/`.
- Migration. No data migration needed for prod (no live jobs); the shared
  dev DB has none in flight either after v2's cleanup, but any stray
  `in_progress` rows are unaffected.

### 6.2 Endpoints (`backend/jobs/views.py`)

| Method + path | Transition | Body | Notes |
|---|---|---|---|
| `POST /jobs/<id>/complete/` | `in_progress → awaiting_completion_confirmation` | none | **changed** from `→ completed`. Stamps `work_finished_at`, clears `reopen_note`. Push to customer: "Is your job done? Confirm to close it out." |
| `POST /jobs/<id>/confirm-completion/` | `awaiting_completion_confirmation → completed` | none | **new**, customer only. Stamps `completed_at`. Push to worker: "[customer] confirmed the job's done." |
| `POST /jobs/<id>/reopen/` | `awaiting_completion_confirmation → in_progress` | `{note?}` | **new**, customer only. Stores `reopen_note`. Push to worker: "[customer] says the job isn't finished — check the note." |
| `POST /jobs/<id>/rate/` | (unchanged) | `{stars, comment?}` | still gated on `status == completed` — now genuinely means "both parties agree it's done". |

- `IsCustomerRole` + `job.customer_id == request.user.id` on the two new
  views, mirroring `ConfirmQuoteView` / `RejectQuoteView`.
- Reuse a tiny serializer for `reopen` (`{note}` optional, like
  `QuoteSerializer` minus the price) or just `request.data.get("note", "")`.

### 6.3 24-hour auto-confirm (lazy)

Add `AUTO_CONFIRM_AFTER = timedelta(hours=24)` and a helper
`resolve_stale_completion(job)` (in `jobs/matching.py` or a new
`jobs/completion.py`):

```
if job.status == AWAITING_COMPLETION_CONFIRMATION
   and job.work_finished_at
   and timezone.now() - job.work_finished_at >= AUTO_CONFIRM_AFTER:
       job.status = COMPLETED
       job.completed_at = timezone.now()
       job.save(...)
       push both parties: "auto-confirmed after 24 hours"
```

Call it from every place a job in this status is read by a client:
- `JobRequestDetailView.get` (both apps poll this)
- `JobRequestListCreateView.get` (Jobs tabs) — for each such row
- optionally `WorkerIncomingOfferView` isn't relevant here

This mirrors `refresh_job_matching`'s lazy-expiry pattern exactly. If
*neither* party opens either app for >24 h the job sits until one does —
acceptable, same trade-off offer expiry already makes. (If we later want
hard wall-clock behaviour, a `celery-beat` service + one periodic task is
the drop-in upgrade — out of scope here.)

### 6.4 Serializer

`JobRequestSerializer`: add `work_finished_at`, `completed_at`,
`reopen_note`.

### 6.5 `packages/api`

- `completeJob(token, jobId)` — unchanged signature; now returns a job in
  `awaiting_completion_confirmation`.
- `confirmCompletion(token, jobId)` — new, `POST …/confirm-completion/`.
- `reopenJob(token, jobId, note?)` — new, `POST …/reopen/`, body
  `{ note }` (omit when empty, per the file's convention).
- `JobStatus` union: add `awaiting_completion_confirmation`.
- `JobRequest` type: add `work_finished_at`, `completed_at`,
  `reopen_note`.

### 6.6 apps/worker

- `activeJob/statusTransitions.ts` — add a phase:
  `awaiting_completion_confirmation → "awaiting_completion"`. Renders a
  wait card ("Waiting for [customer] to confirm the job's done",
  "Auto-confirms in ~24h if they don't respond", Message button, and a
  "Back to Jobs" escape like the quote wait screen).
- `ActiveJobScreen`:
  - in_progress phase: if `reopen_note` is set, show a banner
    ("[customer] sent this back: …") above the actions.
  - "Complete job" → `completeJob()` → stay on ActiveJob, which
    re-renders into the `awaiting_completion` phase (poll for
    `completed` → `JobComplete`; `in_progress` → back to work with the
    banner).
  - Needs polling in this phase (like `WaitingForConfirmationScreen`).
    Simplest: reuse `waitingForConfirmation/useJobStatusPolling` with an
    extended branch set, or add a second small hook
    `useCompletionPolling`.
- `JobCompleteScreen` — unchanged (reached on `completed`).
- `jobsTab/formatJobStatus.ts` — label + tone for
  `awaiting_completion_confirmation` ("Confirming completion", waiting
  tone).
- `jobsTab/jobsTabGrouping.ts` (`isActiveJobStatus`) +
  `jobsTab/jobsTabRouting.ts` — include the new status as active →
  routes to `ActiveJob`.

### 6.7 apps/customer

- `request/jobStatusSteps.ts`:
  - `timelineState("awaiting_completion_confirmation")` →
    `{ lastDone: 4, current: 5 }` ("In progress" done, "Complete" is the
    current ask).
  - `headlineForStatus` → "Confirm [worker] finished the job".
  - `timestampForStep` — "Complete" row now backed by `completed_at`
    (was always null).
- `JobStatusScreen`:
  - while `awaiting_completion_confirmation`: the "Complete" step shows
    "Tap to confirm the job's done"; a **"Confirm completion"** button
    (same treatment as the existing "Review the quote" button); the poll
    routes `awaiting_completion_confirmation` to a CTA, not an
    auto-redirect (mirror of `quote_pending`).
  - `completed` → the existing ~1.8s beat → `Rating` (unchanged).
- New `ConfirmCompletionScreen` (customer):
  - "Did [worker] finish the job?" + a one-line recap (category, agreed
    price).
  - **"Yes, all done"** → `confirmCompletion()` → `replace("JobStatus")`
    (which then beats to Rating).
  - **"Not finished yet"** → reveals a short note field → `reopenJob()`
    → `replace("JobStatus")` (shows `in_progress` again).
  - `‹` back → JobStatus.
- `jobsTab/formatJobStatus.ts` — label for
  `awaiting_completion_confirmation` ("Confirm completion").
- `jobsTab/jobsTabRouting.ts` — `awaiting_completion_confirmation` →
  `ConfirmCompletion` (like `quote_pending` → `ConfirmQuote`).
- `jobsTab/jobsTabGrouping.ts` — already treats everything non-terminal
  as active; no change needed, but add a test.
- Navigation types + `RequestNavigator`.

### 6.8 Docs

- `CLAUDE.md`:
  - "Job lifecycle" chain → add `awaiting_completion_confirmation`.
  - The v2 design-session note says "No post-work pricing step. 'Complete'
    is now a true finish line." → amend: there's now a post-work
    *completion sign-off* (not pricing); "Complete job" starts it, the
    customer (or the 24 h timer) ends it.
  - Core business rules → add a "Completion sign-off" bullet.
- New Claude Design brief: `docs/design/active-job-flow-v2.1-brief.md`
  for the two new screens (worker completion-wait, customer
  ConfirmCompletion + "not finished" note) + the JobStatus "Complete"
  step CTA state.

## 7. User flow

### Worker
`in_progress` → **Complete job** → `awaiting_completion_confirmation`
→ *"Waiting for [customer] to confirm — auto-confirms in ~24h"* →
- customer confirms → `completed` → **Job complete** screen
- customer sends back → `in_progress` with a **"[customer] sent this
  back: …"** banner → fix → **Complete job** again
- 24 h pass → `completed` → **Job complete** screen (push: "auto-confirmed")

### Customer
timeline shows **In progress** → worker marks done → timeline's
**Complete** step becomes the active ask + a **Confirm completion**
button → tap → **ConfirmCompletion** screen →
- **Yes, all done** → `completed` → (beat) → **Rating**
- **Not finished yet** → note → job back to **In progress** on the
  timeline
- ignore it for 24 h → auto-confirms → next time they open the app the
  timeline shows **Complete** and (if not yet rated) they can still rate

## 8. Acceptance criteria

- [ ] `/complete/` moves `in_progress → awaiting_completion_confirmation`,
  stamps `work_finished_at`, clears `reopen_note`; 400 from any other
  status; no body required.
- [ ] `/confirm-completion/` moves
  `awaiting_completion_confirmation → completed`, stamps `completed_at`;
  400 otherwise; 403 for the worker.
- [ ] `/reopen/` moves `awaiting_completion_confirmation → in_progress`,
  stores `reopen_note`; 400 otherwise; 403 for the worker.
- [ ] A job whose `work_finished_at` is ≥24 h old auto-confirms to
  `completed` (with `completed_at`) the next time it's read via
  `JobRequestDetailView` or the Jobs list.
- [ ] `/rate/` still only accepts `completed`; a job in
  `awaiting_completion_confirmation` can't be rated.
- [ ] Worker's `jobs_completed` count (WorkerPublicSerializer) does not
  increment until `completed`.
- [ ] Worker sees the wait state (not `JobComplete`) while
  `awaiting_completion_confirmation`; sees the reopen banner after a
  send-back.
- [ ] Customer's timeline + Confirm-completion CTA render for the new
  status; "Not finished yet" + note round-trips.
- [ ] `awaiting_completion_confirmation` groups as an **active** job in
  both apps' Jobs tabs and routes to the right screen.
- [ ] Backend / worker / customer / api suites green.
- [ ] Live two-app Simulator pass: confirm path, send-back path,
  (simulated) 24 h auto-confirm.

## 9. Testing strategy

Same stack (pytest-django + factory_boy; jest-expo scoped to logic).

- **Backend** (`backend/jobs/tests/`): new
  `test_completion_confirmation.py` — the three transitions + guards, the
  lazy auto-confirm (freeze/patch `timezone.now` or set
  `work_finished_at` back 25 h then GET the job), `jobs_completed`
  gating, `/rate/` still 400 pre-confirm. Update
  `test_active_job_transitions.py`'s happy chain to route through the new
  status. Update `test_delete_account.py`'s `NON_TERMINAL_STATUSES`.
- **apps/worker**: `activeJob/statusTransitions.test.ts` (+ the new
  phase); `jobsTab/*` label/grouping/routing tests.
- **apps/customer**: `request/jobStatusSteps.test.ts`
  (`awaiting_completion_confirmation` state + `completed_at` on the
  Complete row); `jobsTab/formatJobStatus.test.ts` + routing.
- **packages/api**: `jobs.test.ts` — `confirmCompletion` / `reopenJob`
  method+path+body.

## 10. Open questions

1. **Reopen count** — cap how many times a customer can bounce a job
   back? MVP: uncapped (same spirit as "no quote-expiry timer"). Revisit
   with pilot data.
2. **Auto-confirm notification** — do we need to *reliably* notify on
   auto-confirm, given it fires lazily on someone's read (so at least one
   party is online)? MVP: push both on the read that triggers it; good
   enough.
3. **Worker "nudge"** — a button to re-send the "please confirm" push
   after some hours? MVP: no; the worker uses chat.
4. **Auto-confirm window** — 24 h assumed. Confirm that's the number
   (12 h? 48 h?) before building.

## 11. Ticket outline

- **T1** Backend: status + `work_finished_at` / `completed_at` /
  `reopen_note` fields + migration; `TERMINAL_STATUSES` unchanged but
  audit `NON_TERMINAL` lists/tests. Tests.
- **T2** Backend: retarget `/complete/`; add `/confirm-completion/`,
  `/reopen/`; serializer fields. Tests.
- **T3** Backend: `AUTO_CONFIRM_AFTER` + `resolve_stale_completion` +
  wire into detail/list reads + push. Tests.
- **T4** `packages/api`: `confirmCompletion`, `reopenJob`, `JobStatus` +
  type updates. Tests.
- **T5** apps/worker: new `awaiting_completion` phase in ActiveJob +
  polling + reopen banner; Jobs-tab labels/grouping/routing. Tests.
- **T6** apps/customer: `jobStatusSteps` + `JobStatusScreen` CTA + new
  `ConfirmCompletionScreen` + nav; Jobs-tab labels/routing. Tests.
- **T7** Docs: `CLAUDE.md` lifecycle + business rules + v2 note
  amendment; run the Claude Design brief for the 2 new screens.
- **T8** Live two-app Simulator pass (confirm / send-back / auto-confirm)
  + `PROGRESS.md`.
