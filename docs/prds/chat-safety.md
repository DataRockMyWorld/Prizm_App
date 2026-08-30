# PRD: Chat Safety — Report Message / Block User

## 1. Summary

App-store-readiness T6 (`docs/tickets/app-store-readiness.md`) — Apple
Guideline 1.2 requires any app with user-to-user messaging to let a user
report objectionable content and block another user from contacting them
again. Prism's existing "Report a problem" flow (`Report` model,
`ReportJobView`) covers job-*outcome* disputes (No-show, Safety concern,
Quality of work, Pricing disagreement) routed to manual admin review — it
does not cover reporting a specific chat message, and there is no
blocking concept anywhere in the codebase. This PRD adds both, scoped to
the per-job chat thread built in `docs/prds/chat.md`, and was blocked on
its own design pass until now (see that PRD's T6 entry).

## 2. Current state (as of 2026-08-30)

- **`Report` model** (`backend/jobs/models.py:118`): `job`, `reporter`,
  `category` (`no_show` / `safety_concern` / `quality_of_work` /
  `pricing_disagreement`), `details`, `status` (`open` / `reviewing` /
  `resolved`), timestamps. `ReportJobView` (`backend/jobs/views.py:255`)
  at `POST /api/jobs/<pk>/report/` — any job participant (customer or
  worker) can file one; `ReportCreateSerializer` validates `category` +
  optional `details`. Reviewed manually via Django admin
  (`ReportAdmin`) — no automated dispute bot, matching CLAUDE.md.
- **No blocking concept exists anywhere** — no `Block` model, no field
  on `User`, nothing in the matching engine
  (`backend/jobs/matching.py`) that excludes a candidate for any
  reason other than category/radius/online status/already-offered.
- **Chat screens** (`apps/worker/src/screens/ChatScreen.tsx`,
  `apps/customer/src/screens/request/ChatScreen.tsx`, both built per
  `docs/prds/chat.md`): a plain header (back arrow, avatar, name — no
  overflow menu), a `ScrollView` of message bubbles, and an input row
  that's replaced with a "This job is closed" note once
  `job.status` is terminal (`completed`/`cancelled`/`disputed`).
  Nothing in either header is currently interactive besides the back
  arrow.
- **The existing "Report a problem" entry point is customer-only
  today** — `ReportProblemScreen.tsx` and the `ReportProblem` nav route
  live only in `apps/customer` (`JobStatusScreen.tsx:144`); no
  equivalent screen or route exists in `apps/worker`, even though the
  backend already accepts a report from either party. Not this PRD's
  bug to fix retroactively, but this PRD's new report/block UI must
  ship symmetrically in both apps rather than following that gap.
- **Matching** (`backend/jobs/matching.py`): sequential single-offer,
  `_best_candidate()` filters online workers in the job's category
  within `MATCHING_RADIUS_KM`, already-offered workers excluded,
  ranked by Certified → Verified → distance. This is the one place a
  persistent block needs to plug in.

## 3. Goals

- **Report a specific chat message**: long-press a message bubble in
  either app → a report screen with chat-appropriate categories
  (Harassment/abusive language, Inappropriate content, Spam or scam,
  Other) + optional details, filed against that message, routed to the
  same manual admin review queue as existing reports.
- **Report the other party generally** (not tied to one message): a
  header overflow menu item, same categories/screen, filed without a
  specific message attached — covers a pattern of behavior across the
  thread rather than one message.
- **Block the other party, account-wide, once the job is terminal**: a
  header overflow menu item, available only once `job.status` is
  `completed`/`cancelled`/`disputed`. Creates a persistent block that
  the matching engine respects going forward — a blocked pair is never
  matched to each other again, in either direction.
- Both apps get identical capability (report message, report user,
  block user) — no repeat of the current customer-only asymmetry.

## 4. Non-goals (explicitly out of scope for this PRD)

- **Blocking during an active (non-terminal) job.** The block action is
  simply unavailable while a job is still in progress — see §7 for why.
  A genuine active-job safety concern still has an existing path:
  "Report a problem → Safety concern," already routed to human review.
- **Unblocking / a blocked-users management screen.** Blocks are
  one-way, permanent from the app's perspective, and manageable only by
  an admin editing the `Block` row directly — consistent with this
  codebase's existing "no self-service reversal, manual admin
  intervention" pattern for other moderation actions (ID/certification
  review). Worth revisiting if pilot feedback shows accidental blocks
  are common (§10).
- **Auto-cancelling or otherwise touching the job itself when a block
  is created.** Since blocking is terminal-job-only, there's no active
  job state left to touch.
- **Content filtering / profanity detection on message text itself**
  (Apple's other Guideline 1.2 requirement, "mechanism to filter
  objectionable content"). Report + block satisfies the "let users
  report and the developer act on it" half; proactive filtering is a
  separate, larger feature not scoped here — flagged in §10.
- **Push notification to admins on new report** — admin review is
  already pull-based (reviewing the Django admin queue), matching how
  existing `Report` rows are handled; no change here.
- **Blocking a user pre-emptively outside of any shared job** — a block
  is only ever created from a specific job's chat header, targeting
  that job's other party. There's no general "block by phone number/
  profile" surface.

## 5. Data model / API

### `Report` model changes (`backend/jobs/models.py`)

- Add four new `Category` choices: `harassment` ("Harassment or abusive
  language"), `inappropriate_content` ("Inappropriate content"), `spam`
  ("Spam or scam"), `other` ("Other"). Existing four choices
  (`no_show`, `safety_concern`, `quality_of_work`,
  `pricing_disagreement`) are untouched — one shared enum, no new
  `source` field. `ReportAdmin`'s existing `list_filter = ("category",
  "status")` already separates chat-abuse reports from job-outcome
  reports in the review queue without any admin-side change.
- Add `message = models.ForeignKey(Message, on_delete=models.CASCADE,
  null=True, blank=True, related_name="reports")`. `null` for every
  existing report and for the new "report the user generally" path;
  set only when reporting a specific message.
- Migration: new choices + nullable FK, no data migration needed.

### `Block` model (new, `backend/accounts/models.py` — alongside
`Certification`, since this is a `User`↔`User` relationship the
matching engine consults, not a `JobRequest`-owned record)

```python
class Block(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_made")
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_received")
    job = models.ForeignKey("jobs.JobRequest", on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("blocker", "blocked")
```

`job` is kept only as an audit trail of which job triggered the block
(nullable so the row survives if that job were ever deleted); it plays
no role in matching logic. `unique_together` makes creating a block
idempotent — a duplicate attempt is a no-op, not an error.

### Endpoints (`backend/jobs/views.py`, `backend/jobs/urls.py` — both
job-scoped, matching `ReportJobView`'s existing shape)

- `ReportCreateSerializer` gains an optional `message_id` field,
  validated to belong to the job in the URL (400 otherwise). Existing
  `ReportJobView` (`POST /api/jobs/<pk>/report/`) handles both "report
  the user" (`message_id` omitted) and "report this message"
  (`message_id` present) — no new view needed, just the serializer
  field.
- New `BlockCounterpartView` at `POST /api/jobs/<pk>/block/`:
  - 403 if `request.user` isn't the job's customer or worker (same
    check as `ReportJobView`).
  - 400 if `job.status` isn't terminal
    (`completed`/`cancelled`/`disputed`).
  - Target is derived from the job (`job.customer` or `job.worker`,
    whichever isn't `request.user`) — **never accepted from the
    client**, so there's no way to block an arbitrary user id you
    don't share a job with.
  - `Block.objects.get_or_create(blocker=request.user,
    blocked=other_party, defaults={"job": job})` — idempotent, 201
    either way.

### Matching engine change (`backend/jobs/matching.py`)

`_best_candidate()` gains one more exclusion alongside the existing
`already_offered` exclusion:

```python
blocked_worker_ids = set(
    Block.objects.filter(blocker=job.customer).values_list("blocked_id", flat=True)
) | set(
    Block.objects.filter(blocked=job.customer).values_list("blocker_id", flat=True)
)
candidates = (
    User.objects.filter(...)
    .exclude(id__in=list(already_offered))
    .exclude(id__in=blocked_worker_ids)
    ...
)
```

Checking both directions (`blocker=customer` and `blocked=customer`)
is what makes the block bidirectional from a matching standpoint even
though only one `Block` row is ever created per pair — whoever
initiated it, neither side is offered the other again.

## 6. User flow

### 6a. Report a specific message

- Long-press a message bubble (either app, either party's messages) →
  opens a new `ReportChatScreen` (job param + `messageId` param),
  mirroring `ReportProblemScreen`'s existing layout: reason list
  (Harassment/abusive language, Inappropriate content, Spam or scam,
  Other), optional details field, submit button. The reported message's
  text is shown read-only at the top for context before the reason
  list.
- On submit → `POST /api/jobs/<id>/report/` with `category` +
  `message_id` + `details` → confirmation, back to the chat thread.
  Available regardless of job status (reading history is always
  available; reporting old history is meaningful too).

### 6b. Report the other party (no specific message)

- Header overflow menu (⋮, added to both `ChatScreen`s next to the
  existing back arrow) → "Report user" → same `ReportChatScreen`,
  `messageId` omitted, no message-preview block at the top.

### 6c. Block the other party

- Header overflow menu → "Block user" — **only rendered as an enabled
  item once `job.status` is terminal**; while the job is still active,
  the menu shows only "Report user" (blocking simply isn't offered,
  rather than being shown disabled with an explanation — keeps the
  active-job menu identical to today's report-only capability plus one
  new report-message affordance).
- Tapping "Block user" shows a native confirm (`Alert.alert`,
  destructive-style "Block" action) naming the other party ("Block
  [name]? You won't be matched with them again.") — a full screen felt
  disproportionate for a single boolean action with no reason field, by
  contrast with e.g. the multi-screen account-deletion flow which has
  real irreversible consequences and required copy. Confirming calls
  `POST /api/jobs/<id>/block/`, then a brief success toast/alert
  ("Blocked — you won't be offered jobs with them again" on the worker
  side, "Blocked — they won't be matched to your requests again" on
  the customer side) and stays on the (already-closed) chat screen.

## 7. Technical decisions

- **Block is account-wide and only becomes available once the job is
  terminal** (resolved during PRD scoping): an automated block that
  could silently cancel or orphan a job that's physically in progress
  (a worker literally at the customer's door) is a materially riskier
  failure mode than making a genuinely active-job safety concern wait
  for the existing human-reviewed "Report a problem → Safety concern"
  path, which already exists and is already the codebase's answer to
  in-progress-job problems. This mirrors the same reasoning CLAUDE.md
  already applies to disputes generally ("no automated dispute bot").
- **One shared `Report` model/enum, not a separate `MessageReport`
  model.** The four new categories are additive to the existing
  `Category` choices; admin filtering by category (already supported)
  is sufficient to separate chat-abuse reports from job-outcome
  reports in the review queue without new admin surface area.
- **`message` FK is nullable on the same `Report` row**, not a
  parallel model, so "report a message" and "report the user
  generally" share one endpoint, one serializer, and one admin queue
  entry shape — the only difference is whether `message` is set.
- **Block target is server-derived from the job, never client-
  supplied** — the endpoint only ever blocks "the other party of a job
  you were actually part of," closing off any IDOR-style attempt to
  block an arbitrary user id.
- **`Block` lives in `accounts/models.py`, not `jobs/models.py`**,
  because it's fundamentally a `User`↔`User` relationship the matching
  engine (which already imports from `accounts.models`) needs to
  consult independent of any one job; `job` is kept only as an audit
  pointer, `on_delete=SET_NULL` so it never blocks a `JobRequest`
  deletion.
- **No `is_blocked`-style denormalized flag anywhere** — the matching
  exclusion is a live query against `Block` (two cheap indexed lookups
  added to an already-existing candidate query), consistent with how
  `already_offered` exclusion works in the same function today.
- New `packages/api` additions: `reportChatMessage(token, jobId,
  category, details?, messageId?)` (or extend the existing `reportJob`
  signature with an optional `messageId` param — simpler, one function,
  matches the backend's single-endpoint decision) and `blockCounterpart
  (token, jobId)` in `jobs.ts`, following the existing
  one-function-per-endpoint convention.
- `ReportChatScreen` is a new screen per app (not shared), consistent
  with `ChatScreen` itself and this codebase's established precedent
  of not forcing shared full-screen components across the two apps.

## 8. Testing strategy

Consistent with prior PRDs: backend `pytest-django` + `factory_boy`,
mobile `jest-expo`, scoped to logic not full-screen rendering.

- **Backend**:
  - `BlockCounterpartView`: a job participant can block the other
    party once the job is terminal; blocking is rejected (400) while
    the job is still active; an unrelated authenticated user gets 403;
    calling it twice for the same pair is idempotent (still one
    `Block` row, still 201); the target is always derived from the job
    regardless of any client-supplied id.
  - Matching: a worker who has blocked a customer (or been blocked by
    them) is excluded from `_best_candidate()` for that customer's
    jobs in **both** directions; an unrelated worker is unaffected;
    existing `already_offered`/radius/category/online-status exclusion
    behavior is unchanged (regression coverage on `matching.py`'s
    existing tests).
  - `ReportJobView` with `message_id`: succeeds and sets `report.
    message` when the message belongs to the job; 400 when it belongs
    to a different job; existing no-`message_id` report-the-user path
    is unaffected (regression coverage on existing report tests); new
    chat categories validate the same as existing ones via
    `ReportCreateSerializer`.
- **Mobile**: no new polling/timer logic here, so no new hook tests are
  required by this PRD's own scope; if a pure guard function is
  extracted for "is Block available" (i.e. `isJobTerminal(status)`,
  likely already exists or trivially reusable from the chat PRD's own
  terminal-status set), it gets a unit test the same way other
  extracted logic in this codebase does.

## 9. Acceptance criteria (summary — full detail in tickets)

- Either party can long-press a message in either app's `ChatScreen`
  and file a report with a chat-appropriate category against that
  specific message.
- Either party can report the other party generally from the chat
  header, without picking a message.
- Once a job is terminal, either party can block the other from the
  chat header; a blocked pair is never matched to each other again in
  either direction, verified against the live matching engine, not
  just a stored flag.
- Blocking is not offered anywhere while a job is still active.
- All new report/block capability exists identically in both apps —
  no repeat of today's customer-only "Report a problem" asymmetry.
- A user who isn't part of a given job cannot report into it or block
  via it.

## 10. Open risks / follow-ups

- **No unblock/management UI** (§4) — if pilot feedback surfaces
  accidental blocks (e.g. a customer blocking a worker they actually
  just wanted to complain about once), the only remedy today is an
  admin manually deleting the `Block` row. Worth watching, not worth
  building preemptively.
- **Content filtering** (Apple's other Guideline 1.2 half) stays
  unaddressed by this PRD — report+block covers "let users report and
  the developer can act," not "proactively filter objectionable
  content before it's sent." If App Store review pushes back on this
  specifically, it's a separate, larger PRD.
- **No hi-fi mockup exists yet** for the overflow menu, the
  message-long-press interaction, or `ReportChatScreen` — this PRD's
  flow section is a reasoned design extending `ReportProblemScreen`'s
  existing shape, not a pixel spec, same situation the chat PRD itself
  was in before its own build.
- **The block confirmation is a native `Alert.alert`, not a screen** —
  flagged in §6c as a deliberate proportionality call, but worth a
  quick gut-check against the actual mockup once one exists, the same
  way other low-fidelity decisions in recent PRDs got revisited after
  a first pass.
- **`Report.category` choices now serve two different mental models**
  (job-outcome vs. message-abuse) in one enum — accepted per §7, but if
  the admin review queue grows enough that this becomes confusing in
  practice, a `source`/`kind` field is the natural follow-up rather
  than re-splitting into two models.
