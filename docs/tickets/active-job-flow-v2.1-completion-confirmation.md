# Tickets: Active-Job Flow v2.1 — Customer Completion Confirmation

PRD: `docs/prds/active-job-flow-v2.1-completion-confirmation.md`
Depends on: the `active-job-flow-v2` branch being merged to `main` first
(this builds directly on the v2 status model and screens).

Implement in order — each ticket its own commit, reviewed before the
next. **Every ticket's "Tests" subsection must exist and pass before it's
done.**

## Before starting

- **PRD §10 open questions — using these answers unless told otherwise:**
  reopen is uncapped; auto-confirm window is **24 h**; auto-confirm push
  fires on the triggering read; no worker "nudge" button.
- T1–T4 (backend + api) don't need the hi-fi. T5–T6 (screens) should
  wait for the Claude Design brief output (T7) or be built against the
  brief copy with a visual pass after.

---

### T1 — Backend: status + timestamp/note fields + migration

**Depends on:** v2 merged. **Touches:** `backend/jobs/models.py`,
`backend/jobs/migrations/`, `backend/jobs/tests/`

- `JobRequest.Status`: add
  `AWAITING_COMPLETION_CONFIRMATION = "awaiting_completion_confirmation"`
  (ordered between `IN_PROGRESS` and `COMPLETED`).
- `TERMINAL_STATUSES` unchanged (this status is in-flight).
- New fields:
  - `work_finished_at = DateTimeField(null=True, blank=True)`
  - `completed_at = DateTimeField(null=True, blank=True)`
  - `reopen_note = TextField(blank=True, default="")`
- Migration (schema only).
- Audit non-terminal lists / parametrized tests for the new value:
  `backend/accounts/tests/test_delete_account.py` `NON_TERMINAL_STATUSES`,
  `backend/jobs/tests/test_block.py`, any `status__in=[...]` in
  `backend/`.

**Acceptance criteria**
- `makemigrations --check` clean once committed.
- `AWAITING_COMPLETION_CONFIRMATION` is **not** in `TERMINAL_STATUSES`;
  the account-deletion guard treats a job in it as blocking.

**Tests** (`backend/jobs/tests/test_status_model.py` — extend)
- new status present, not terminal.
- `DeleteAccountView` blocks deletion for a job in
  `awaiting_completion_confirmation`.

---

### T2 — Backend: completion endpoints

**Depends on:** T1. **Touches:** `backend/jobs/views.py`,
`backend/jobs/urls.py`, `backend/jobs/serializers.py`,
`backend/jobs/tests/`

- **`CompleteJobView`**: change target from `COMPLETED` to
  `AWAITING_COMPLETION_CONFIRMATION`; still `required_current == IN_PROGRESS`,
  no body. Stamp `work_finished_at = now()`, clear `reopen_note`. Push to
  `job.customer_id` (`data.type = "completion_pending"`).
- **`ConfirmCompletionView`** (new, `POST /jobs/<id>/confirm-completion/`,
  `IsCustomerRole`, must be `job.customer`): valid when
  `status == AWAITING_COMPLETION_CONFIRMATION` → `COMPLETED`, stamp
  `completed_at = now()`. Push to `job.worker_id`
  (`data.type = "completion_confirmed"`).
- **`ReopenJobView`** (new, `POST /jobs/<id>/reopen/`, `IsCustomerRole`,
  must be `job.customer`): valid when
  `status == AWAITING_COMPLETION_CONFIRMATION` → `IN_PROGRESS`. Body
  `{note?}` (optional, plain `request.data.get("note", "")` or a
  1-field serializer). Store on `job.reopen_note`. Push to
  `job.worker_id` (`data.type = "job_reopened"`).
- `urls.py`: add the two routes.
- `JobRequestSerializer`: add `work_finished_at`, `completed_at`,
  `reopen_note`.
- `RateJobView` / `DisputePriceView` — no change (still `completed`-gated);
  add a regression test that `/rate/` 400s from
  `awaiting_completion_confirmation`.

**Acceptance criteria**
- Happy chain `in_progress → complete → confirm-completion → completed`
  with `work_finished_at` then `completed_at` set.
- `reopen` → `in_progress`, `reopen_note` stored; a subsequent
  `/complete/` clears it.
- `confirm-completion` / `reopen`: 400 from wrong status, 403 for the
  worker / a stranger.
- `/rate/` still 400 unless `completed`.
- `jobs_completed` (WorkerPublicSerializer) counts the job only once
  `completed`.

**Tests** (`backend/jobs/tests/test_completion_confirmation.py` — new;
`test_active_job_transitions.py` — update the happy chain)
- all transitions + guards above.
- serializer exposes the 3 new fields.
- `jobs_completed` gating.

---

### T3 — Backend: 24-hour lazy auto-confirm

**Depends on:** T2. **Touches:** `backend/jobs/` (new `completion.py` or
add to `matching.py`), `backend/jobs/views.py`, `backend/jobs/tests/`

- `AUTO_CONFIRM_AFTER = timedelta(hours=24)`.
- `resolve_stale_completion(job)`: if
  `status == AWAITING_COMPLETION_CONFIRMATION` and `work_finished_at` and
  `now - work_finished_at >= AUTO_CONFIRM_AFTER` → `COMPLETED` +
  `completed_at = now()` + push both parties
  (`data.type = "completion_auto_confirmed"`).
- Call it from:
  - `JobRequestDetailView.get` (before serializing), and
  - `JobRequestListCreateView.get` for each row in that status.
- Mirror the docstring style of `jobs/matching.py refresh_job_matching`
  (explain the deliberate lazy/no-scheduler choice).

**Acceptance criteria**
- GET on a job with `work_finished_at` set 25 h ago returns it already
  `completed` with `completed_at` set; a fresh one (1 h) is untouched.
- Same via the Jobs list endpoint.
- Exactly one push per party on the auto-confirm.

**Tests** (`test_completion_confirmation.py`)
- freeze time / backdate `work_finished_at`; assert the GET flips it.
- boundary (just under vs just over 24 h).
- no double-confirm if read twice.

---

### T4 — `packages/api`: client functions

**Depends on:** T2. **Touches:** `packages/api/src/jobs.ts`,
`packages/api/src/jobs.test.ts`

- `JobStatus` union: add `"awaiting_completion_confirmation"`.
- `JobRequest` type: add `work_finished_at: string | null`,
  `completed_at: string | null`, `reopen_note: string`.
- `completeJob` — unchanged signature/body; update its doc comment
  (returns `awaiting_completion_confirmation` now).
- `confirmCompletion(token, jobId)` → `POST …/confirm-completion/`.
- `reopenJob(token, jobId, note?)` → `POST …/reopen/`, body `{ note }`
  (omit key when not passed, per file convention).

**Acceptance criteria**
- `packages/api` typechecks; both apps typecheck (screen call sites land
  in T5/T6 — note expected TS errors in the PR or coordinate).

**Tests** (`jobs.test.ts`, mocked fetch)
- method + path for the two new fns; `reopenJob` body shape (note
  present vs omitted); `completeJob` still sends no body.

---

### T5 — apps/worker: completion-wait phase + reopen banner

**Depends on:** T4. **Touches:** `apps/worker/src/activeJob/`,
`apps/worker/src/screens/ActiveJobScreen.tsx`,
`apps/worker/src/waitingForConfirmation/` (or a new
`useCompletionPolling`), `apps/worker/src/jobsTab/`

- `activeJob/statusTransitions.ts` — add phase
  `awaiting_completion_confirmation → "awaiting_completion"`; test.
- `ActiveJobScreen`:
  - `in_progress` phase: if `job.reopen_note`, render a banner above the
    actions — "[customer first name] sent this back: {reopen_note}".
  - "Complete job" → `completeJob()` → `setJob(result)` (screen
    re-renders into the `awaiting_completion` phase — do **not**
    `replace("JobComplete")` any more).
  - new `awaiting_completion` phase: wait card — "Waiting for [customer]
    to confirm the job's done", sub "Auto-confirms in ~24h if they don't
    respond", `Message` button, and a "Back to Jobs" link (same escape
    pattern as `WaitingForConfirmationScreen`).
  - poll while in this phase: reuse `useJobStatusPolling` with an
    extended branch set, or a small `useCompletionPolling` — on
    `completed` → `replace("JobComplete")`; on `in_progress` → re-render
    (the customer sent it back; `useFocusEffect`'s existing reload
    already covers the banner).
- `jobsTab/formatJobStatus.ts` — `awaiting_completion_confirmation`:
  label "Confirming completion", tone `waiting`; `getPriceCaption` →
  "agreed" (price is locked).
- `jobsTab/jobsTabGrouping.ts` (`isActiveJobStatus`) — include it.
- `jobsTab/jobsTabRouting.ts` — include it in `ACTIVE_STATUSES` (→
  `ActiveJob`).

**Acceptance criteria**
- After "Complete job", the worker sees the wait card, not
  `JobCompleteScreen`.
- Customer confirm → worker lands on `JobComplete`.
- Customer send-back → worker is back on the in_progress actions with the
  banner showing the note.
- Jobs tab shows the job as active with the right label; tapping it opens
  `ActiveJob`.

**Tests**
- `activeJob/statusTransitions.test.ts` — the new phase for the new
  status; all others unchanged.
- polling hook test — advances on `completed`, returns to work on
  `in_progress`.
- `jobsTab/formatJobStatus.test.ts` / grouping / routing — new status.

---

### T6 — apps/customer: confirm-completion screen + timeline

**Depends on:** T4. **Touches:**
`apps/customer/src/request/jobStatusSteps.ts` (+ test),
`apps/customer/src/screens/request/JobStatusScreen.tsx`,
new `apps/customer/src/screens/request/ConfirmCompletionScreen.tsx`,
`apps/customer/src/navigation/{types.ts,RequestNavigator.tsx}`,
`apps/customer/src/jobsTab/{formatJobStatus.ts,jobsTabRouting.ts}` (+ tests)

- `jobStatusSteps.ts`:
  - `timelineState("awaiting_completion_confirmation")` →
    `{ lastDone: 4, current: 5 }`.
  - `headlineForStatus` → `Confirm ${name} finished the job`.
  - `timestampForStep` — index 5 ("Complete") now backed by
    `job.completed_at` (was hard-coded null).
- `JobStatusScreen`:
  - while `awaiting_completion_confirmation`: headline is tappable →
    `ConfirmCompletion`; the "Complete" timeline row shows "Waiting for
    you to confirm"; render a **"Confirm completion"** button (reuse the
    `reviewButton` style used for "Review the quote").
  - poll: `awaiting_completion_confirmation` → **do not** auto-navigate
    (mirror `quote_pending`); `completed` → existing beat → `Rating`;
    `in_progress` after a reopen → just keep showing the timeline.
- new `ConfirmCompletionScreen`:
  - "Did {worker} finish the job?" + recap (category · N$agreed_price).
  - **"Yes, all done"** → `confirmCompletion()` → `replace("JobStatus")`.
  - **"Not finished yet"** → reveal a short note `TextField` → button
    **"Send back to {worker}"** → `reopenJob(note)` → `replace("JobStatus")`.
  - `‹` back → JobStatus.
- nav types: add `ConfirmCompletion: { jobId: number }`.
- `RequestNavigator`: register it.
- `jobsTab/formatJobStatus.ts` — label "Confirm completion".
- `jobsTab/jobsTabRouting.ts` — `awaiting_completion_confirmation` →
  `"ConfirmCompletion"` (add to the union + the branch, like
  `quote_pending`).
- `jobsTab/jobsTabGrouping.ts` — non-terminal already ⇒ active; add a
  test line.

**Acceptance criteria**
- Timeline renders correctly for the new status (5 of 6, "Complete" is
  the current ask, no crash).
- "Confirm completion" → `ConfirmCompletion` → "Yes, all done" → job
  `completed` → Rating.
- "Not finished yet" + note → job `in_progress`, worker sees the banner.
- Jobs tab: tapping a job in this status opens `ConfirmCompletion`.

**Tests**
- `request/jobStatusSteps.test.ts` — new state, headline,
  `completed_at`-backed timestamp.
- `jobsTab/formatJobStatus.test.ts` + `jobsTabRouting.test.ts` — new
  status.
- any note-field / branch logic in `ConfirmCompletionScreen` worth
  extracting → its own test.

---

### T7 — Docs + hi-fi

**Depends on:** T1–T6 design settled. **Touches:** `CLAUDE.md`,
`docs/design/active-job-flow-v2.1-brief.md` (new)

- `CLAUDE.md`:
  - "Job lifecycle" chain → insert `awaiting_completion_confirmation`
    before `completed`; add the transition bullets.
  - Amend the v2 design-session note's "No post-work pricing step.
    'Complete' is now a true finish line." → there's now a post-work
    *completion sign-off* (not pricing): the worker's "Complete job"
    starts it; the customer confirms, sends it back, or it auto-confirms
    after 24 h.
  - Core business rules → a "Completion sign-off" bullet.
- Write `docs/design/active-job-flow-v2.1-brief.md` (Claude Design
  prompt) for: worker completion-wait card, customer
  `ConfirmCompletionScreen` (+ "not finished" note state), and the
  `JobStatus` "Complete"-step CTA state. Reference
  `docs/design/prism-hifi-v2.dc.html` for the visual system. Run it.

**Acceptance criteria**
- No stale "true finish line" claim left in `CLAUDE.md`.
- Hi-fi updated / a v2.1 delta file exists.

---

### T8 — Live pass + PROGRESS

**Depends on:** T1–T7. **Touches:** `PROGRESS.md`

- Two-app Simulator run (Claude drives one side via REST):
  1. Confirm path: worker complete → customer "Yes, all done" → Rating.
  2. Send-back path: worker complete → customer "Not finished yet" +
     note → worker sees banner → completes again → confirm.
  3. Auto-confirm: backdate `work_finished_at` 25 h via shell → customer
     opens JobStatus → sees it `completed`.
- Fix what surfaces.
- `PROGRESS.md`: fold v2.1 into the step-8 entry; final test counts.

**Acceptance criteria**
- All three paths verified live.
- backend / worker / customer / api suites green; counts recorded.
