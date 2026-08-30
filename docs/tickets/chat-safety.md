# Tickets: Chat Safety — Report Message / Block User

See `docs/prds/chat-safety.md` for full context, goals/non-goals, and
reasoning behind the technical decisions referenced here.

---

### T1 — Backend: `Report` model chat categories + per-message reporting ✅ Done

**Implementation notes:** built as planned, with the `get_object_or_404`
reading kept rather than an explicit 400 — a `message_id` that doesn't
belong to the job in the URL now surfaces as 404, matching this file's
existing idiom for every other job-scoped lookup (`get_object_or_404
(JobRequest, pk=pk)` at the top of nearly every view). Didn't bundle in
the optional `TERMINAL_STATUSES`-sharing refactor mentioned in T2's
sketch — out of this ticket's scope, and turned out to already exist
(`JobRequest.TERMINAL_STATUSES`, already shared by `MessageListCreateView`
and `DeleteAccountView`) so there's nothing left to extract there when T2
picks it up. Added `ReportFactory` to `jobs/tests/factories.py` (didn't
exist before — no report tests existed anywhere in the suite prior to
this ticket) even though the new tests construct jobs/messages directly
rather than needing it themselves; kept for T2 and any future report
tests, matching this codebase's per-model-factory convention. 13 new
tests in `jobs/tests/test_reports.py` (all four new categories validate;
regression coverage on all four existing categories with no `message_id`,
confirming `report.message` stays `None`; message-scoped report sets
`report.message`; cross-job and nonexistent `message_id` both 404 with no
`Report` row created; both customer and worker can report a message;
unrelated user gets 403), all passing. Full backend suite 116/116, no
regressions. Migration `jobs/migrations/0006_report_message_alter_report_category.py`
generated and applied against the local Docker Postgres.

**Depends on:** none.
**Touches:** `backend/jobs/models.py`, `backend/jobs/serializers.py`,
`backend/jobs/views.py`, `backend/jobs/migrations/`,
`backend/jobs/tests/factories.py`, `backend/jobs/tests/` (new or
extended report tests).

- `Report.Category` (`backend/jobs/models.py:119`): add four choices —
  `HARASSMENT = "harassment", "Harassment or abusive language"`,
  `INAPPROPRIATE_CONTENT = "inappropriate_content", "Inappropriate
  content"`, `SPAM = "spam", "Spam or scam"`, `OTHER = "other",
  "Other"`. Existing four choices are untouched, same enum — no new
  `source`/`kind` field (PRD §7: admin's existing `list_filter =
  ("category", "status")` already separates the two report "kinds" in
  the review queue).
- `Report` model: add `message = models.ForeignKey("jobs.Message",
  on_delete=models.CASCADE, null=True, blank=True,
  related_name="reports")`. `null=True` covers every existing report
  row and the "report the user generally" path (no specific message);
  set only when reporting one message.
- Migration: `makemigrations jobs` — new choices (no schema change by
  themselves) + the new nullable FK column.
- `ReportCreateSerializer` (`backend/jobs/serializers.py:187`): add
  `message_id = serializers.IntegerField(required=False,
  allow_null=True)`. Validation that it actually belongs to the job in
  the URL happens in the view (see below), matching how this
  serializer already leaves job-scoping to its caller rather than
  needing request context injected into the serializer itself.
- `ReportJobView.post` (`backend/jobs/views.py:255`): after
  `serializer.is_valid(raise_exception=True)`, look up the optional
  message:
  ```python
  message = None
  message_id = serializer.validated_data.pop("message_id", None)
  if message_id is not None:
      message = get_object_or_404(Message, pk=message_id, job=job)
  report = Report.objects.create(
      job=job, reporter=request.user, message=message, **serializer.validated_data
  )
  ```
  Using `get_object_or_404(Message, pk=message_id, job=job)` (404, not
  a 400-with-custom-detail) is a deliberate departure from the PRD's
  "400 otherwise" phrasing — `get_object_or_404` is this exact file's
  existing idiom everywhere else in it (`get_object_or_404(JobRequest,
  pk=pk)` at the top of nearly every view here); a message id that
  doesn't belong to this job is functionally "not found in this job's
  scope," consistent with that idiom. Note the discrepancy from the
  PRD's wording in implementation notes if this reading is kept, or
  swap to an explicit 400 if a reviewer prefers exact PRD wording —
  implementer's call, but pick one and note which.
- `MessageFactory` already exists (from the `chat` PRD's T1) — no new
  factory needed; reuse it to create a message to attach a report to
  in tests. If `ReportFactory` doesn't already exist, add one
  (`job (SubFactory(JobRequestFactory)), reporter
  (SubFactory(UserFactory)), category (Report.Category.OTHER)`).

**Acceptance criteria**
- `POST /api/jobs/<id>/report/` with one of the four new categories
  succeeds the same way the four existing categories already do.
- `POST` with a `message_id` belonging to the job sets `report.message`
  to that message.
- `POST` with a `message_id` belonging to a *different* job (or a
  nonexistent id) is rejected.
- `POST` with no `message_id` behaves exactly as it does today
  (`report.message` is `None`) — no regression on the existing
  job-outcome report path.

**Tests**
- New categories validate via `ReportCreateSerializer` the same as
  existing ones.
- `message_id` belonging to the job → `report.message` set correctly.
- `message_id` belonging to a different job → rejected, no `Report`
  row created.
- `message_id` omitted → `report.message` is `None` (regression
  coverage on the existing no-message report path — the four existing
  categories' tests, if any, should keep passing unmodified).

---

### T2 — Backend: `Block` model + block endpoint + matching exclusion ✅ Done

**Implementation notes:** built as planned. The optional
`TERMINAL_STATUSES`-sharing refactor floated in the original sketch turned
out to be unnecessary — `JobRequest.TERMINAL_STATUSES` already existed
(shared by `MessageListCreateView` and `DeleteAccountView` before this
ticket), so `BlockCounterpartView` just reuses it directly, no refactor
needed. Added one guard not in the original sketch: if `other_party`
resolves to `None` (a job the customer cancelled while still `SEARCHING`,
before any worker was ever assigned — terminal but with no counterpart),
the endpoint now 400s with "This job has no other party to block"
rather than attempting `Block.objects.get_or_create(blocked=None, ...)`,
which would otherwise hit the FK's `NOT NULL` constraint. Not reachable
via the planned chat UI (which requires `job.worker` to exist), but this
endpoint is a plain job-scoped POST — spotted while writing the test for
this edge case, kept as a defensive check. `Block` registered in
Django admin (`BlockAdmin`, `list_display = ("blocker", "blocked", "job",
"created_at")`) per the sketch. New `BlockFactory` in
`accounts/tests/factories.py`. 15 new tests in `jobs/tests/test_block.py`
(terminal-success for both directions across all three terminal statuses;
active-rejection across five non-terminal statuses; 403 for a
non-participant; idempotent double-block; the no-other-party edge case;
matching exclusion in both block directions; an unrelated block pair left
unaffected) — reused the `worker_profile_factory`/`_live_job` local-fixture
pattern already established in `test_push_notifications.py` rather than
promoting either to `conftest.py`, matching this codebase's existing
per-file duplication for these small test helpers. All passing. Full
backend suite 131/131, no regressions. Migrations
`accounts/migrations/0012_block.py` (depends on
`jobs/migrations/0006_...` for the `job` FK) generated and applied
against the local Docker Postgres.

**Depends on:** none. Independent of T1 — can be done in parallel.
**Touches:** `backend/accounts/models.py`, `backend/accounts/admin.py`,
`backend/accounts/migrations/`, `backend/jobs/views.py`,
`backend/jobs/urls.py`, `backend/jobs/matching.py`,
`backend/accounts/tests/factories.py` (or wherever `UserFactory`/
`JobRequestFactory` live — confirm actual location before adding),
`backend/jobs/tests/test_matching.py` (or equivalent existing matching
test module).

- `Block` model (new, `backend/accounts/models.py`, placed near
  `Certification` — PRD §5/§7 reasoning: a `User`↔`User` relationship
  the matching engine consults, not a `JobRequest`-owned record):
  ```python
  class Block(models.Model):
      blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_made")
      blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_received")
      job = models.ForeignKey("jobs.JobRequest", on_delete=models.SET_NULL, null=True, blank=True)
      created_at = models.DateTimeField(auto_now_add=True)

      class Meta:
          unique_together = ("blocker", "blocked")

      def __str__(self):
          return f"Block({self.blocker_id} -> {self.blocked_id})"
  ```
  `job` is a nullable audit pointer only (PRD §5) — never read by
  matching logic, `SET_NULL` so it can't block a `JobRequest` deletion.
- Migration: `makemigrations accounts`.
- `backend/accounts/admin.py`: register `Block` —
  ```python
  @admin.register(Block)
  class BlockAdmin(admin.ModelAdmin):
      list_display = ("blocker", "blocked", "job", "created_at")
  ```
  (add `Block` to the existing `from .models import ...` line.)
- `BlockCounterpartView` (new, `backend/jobs/views.py`, placed near
  `ReportJobView` — same shape):
  ```python
  class BlockCounterpartView(APIView):
      """Blocks the other party of `job`, account-wide, once the job is
      terminal. Target is always derived from the job, never client-
      supplied — see chat-safety PRD §7 (no way to block an id you
      don't share a job with)."""

      permission_classes = [IsAuthenticated]

      def post(self, request, pk):
          job = get_object_or_404(JobRequest, pk=pk)
          if request.user.id not in (job.customer_id, job.worker_id):
              return Response({"detail": "Not your job."}, status=403)
          if job.status not in (
              JobRequest.Status.COMPLETED,
              JobRequest.Status.CANCELLED,
              JobRequest.Status.DISPUTED,
          ):
              return Response({"detail": "This job is still active."}, status=400)
          other_party = job.worker if request.user.id == job.customer_id else job.customer
          Block.objects.get_or_create(
              blocker=request.user, blocked=other_party, defaults={"job": job}
          )
          return Response(status=201)
  ```
  Note the terminal-status set here is copy-pasted from
  `MessageListCreateView.post`'s existing terminal check
  (`jobs/views.py`, from the `chat` PRD) rather than imported as a
  shared constant — that view doesn't currently expose one; pulling
  both into a shared `TERMINAL_STATUSES` tuple in `models.py` is a
  reasonable small refactor to bundle into this ticket if touching
  both files anyway, implementer's call.
- URL: `path("<int:pk>/block/", BlockCounterpartView.as_view(),
  name="job-block")` in `jobs/urls.py`, grouped with the other
  `<int:pk>/<action>/` routes.
- `backend/jobs/matching.py`: import `Block` alongside the existing
  `from accounts.models import Certification, User` line. In
  `_best_candidate()`, add the exclusion right after the existing
  `already_offered` one:
  ```python
  blocked_worker_ids = set(
      Block.objects.filter(blocker=job.customer).values_list("blocked_id", flat=True)
  ) | set(
      Block.objects.filter(blocked=job.customer).values_list("blocker_id", flat=True)
  )
  candidates = list(
      User.objects.filter(...)
      .exclude(id__in=list(already_offered))
      .exclude(id__in=blocked_worker_ids)
      ...
  )
  ```
  Checking both directions is what makes a single `Block` row
  bidirectional for matching purposes (PRD §5) — whichever side
  initiated the block, neither is offered the other again.

**Acceptance criteria**
- A job participant can block the other party once the job is terminal;
  the endpoint returns 201 and a `Block` row exists.
- Blocking is rejected (400) while the job is still active (any
  non-terminal status).
- An authenticated user who isn't part of the job gets 403.
- Calling the endpoint twice for the same pair/job is idempotent — one
  `Block` row, still 201 (not a 400/409 on the duplicate).
- The blocked worker is never returned by `_best_candidate()` for that
  customer's future jobs, and vice versa (block from either direction
  excludes in both directions).
- An unrelated worker/customer pair's matching is unaffected.

**Tests**
- `BlockCounterpartView`: terminal-job success case (each terminal
  status — `completed`, `cancelled`, `disputed`); active-job rejection
  (each non-terminal status worth spot-checking, at least one); 403 for
  a non-participant; idempotent double-call.
- Matching: create a `Block(blocker=customer, blocked=worker)` and
  confirm `worker` is excluded from `_best_candidate()` for a new job
  from that `customer`; repeat with the row reversed
  (`blocker=worker, blocked=customer`) and confirm the same exclusion
  holds; confirm an unrelated worker is still returned; confirm
  existing `already_offered`/radius/category/online-status exclusion
  behavior is unchanged (regression run of `matching.py`'s existing
  test module).

---

### T3 — `@prizm/api`: report-message + block-user client functions ✅ Done

**Implementation notes:** built as planned. `reportJob` gained `messageId`
as a new optional 5th parameter (not a second function), and the body's
`message_id: messageId` relies on `JSON.stringify` dropping `undefined`
values — confirmed by round-tripping both the with- and without-`messageId`
shapes against the live backend (see below), not just assumed. The
`interface`-vs-`type` pitfall flagged in the sketch turned out to be moot,
exactly as predicted — both new functions' bodies are inline object
literals, same as `sendMessage`'s. Both apps typecheck clean (`npx tsc
--noEmit`, no output = no errors) and both Jest suites are unaffected
(worker 58/58, customer 42/42 — pure addition to `jobs.ts`, no existing
tests touch these paths). Round-tripped against the local Docker backend:
created a throwaway customer/worker/job/message via Django shell, issued
a real JWT, then `curl`'d the exact request shapes these functions
produce — `reportJob(..., messageId)` (201, `report.message` set),
`reportJob(...)` with no `messageId` (201, key correctly absent from the
JSON body), `blockCounterpart` while the job was still `ACCEPTED` (400,
matching T2's active-job rejection), then moved the job to `COMPLETED`
and confirmed `blockCounterpart` succeeds (201) and is idempotent on a
second call (201 again, not a 409). All throwaway data (job, messages,
reports, block row, both users) deleted afterward — confirmed gone.

**Depends on:** T1, T2 (needs both live endpoints to round-trip
against).
**Touches:** `packages/api/src/jobs.ts`.

- Extend the existing `reportJob` signature
  (`packages/api/src/jobs.ts:176`) with an optional `messageId`
  parameter rather than adding a second function — PRD §7's "one
  shared endpoint" decision carries through to the client:
  ```ts
  export type ReportCategory =
    | "no_show"
    | "safety_concern"
    | "quality_of_work"
    | "pricing_disagreement"
    | "harassment"
    | "inappropriate_content"
    | "spam"
    | "other";

  export function reportJob(
    token: string,
    jobId: number,
    category: ReportCategory,
    details?: string,
    messageId?: number
  ) {
    return apiRequest(`/api/jobs/${jobId}/report/`, {
      method: "POST",
      token,
      body: { category, details, message_id: messageId },
    });
  }
  ```
  Confirm `apiRequest`'s body typing accepts `message_id: number |
  undefined` without the `interface`-vs-`type` pitfall noted in the
  `chat` PRD's T2 implementation notes (this body is already an inline
  object literal here, same as `sendMessage`'s, so it's likely moot —
  verify by typechecking, don't assume).
- New `blockCounterpart(token: string, jobId: number)` → `POST
  /api/jobs/${jobId}/block/`, no body.
- Round-trip both against the local Docker backend (same approach as
  every prior `packages/api` ticket): create a throwaway job via
  Django shell/factories, exercise both new call shapes, confirm the
  response status/shape matches what T1/T2 actually return, clean up
  test data afterward.

**Acceptance criteria**
- `reportJob(..., messageId)` and `reportJob(...)` (no `messageId`)
  both typecheck and round-trip correctly against T1's endpoint.
- `blockCounterpart` typechecks and round-trips correctly against T2's
  endpoint, including the 400 case (active job) surfacing as a thrown/
  rejected call the way this codebase's other `apiRequest`-based
  functions already do on non-2xx responses.
- Existing call sites of `reportJob` (the customer app's
  `ReportProblemScreen`, from before this PRD) keep compiling unchanged
  — `messageId` must be optional, not a required new positional
  argument that breaks existing callers.

**Tests**
- None expected beyond typecheck + manual round-trip — thin wiring,
  consistent with this project's testing philosophy (same as `chat`
  PRD's T2).

---

### T4 — Worker: chat safety UI (report message, report user, block user) ✅ Done

**Implementation notes:** built as planned, no deviations. New
`ReportChatScreen.tsx` mirrors the customer app's `ReportProblemScreen.tsx`
layout with the four chat categories instead of the four job-outcome
ones, plus an optional read-only `Card` showing `messageText` when
reporting a specific message. `ChatScreen.tsx`'s header gained a `⋮`
`Pressable` opening an `Alert.alert("Chat options", ...)` button-list menu
— confirmed via a scan of `packages/ui/src/components` that no Modal/
dropdown primitive exists in this codebase, so `Alert.alert` is the
deliberate choice flagged as an option in the original sketch, not a
placeholder. "Report user" always present; "Block user" (destructive
style) only added to the button array when `isClosed`, opening a second
confirming `Alert.alert` naming `job.customer?.full_name || "this
customer"` before calling `blockCounterpart`, then a success alert. Each
message bubble wrapped in a `Pressable` with `onLongPress` navigating to
`ReportChat` with `{ jobId, messageId, messageText }`. `navigation/
types.ts` and `RootNavigator.tsx` updated to register the new route.
Typecheck clean (`npx tsc --noEmit`, no output); worker Jest suite 58/58,
unchanged — no new tests, pure UI wiring with nothing non-trivial
extracted, matching this ticket's own "no new unit tests expected" note.
Live bundle check against the already-running Metro dev server (port
8081): fetched `.expo/.virtual-metro-entry.bundle?platform=ios&dev=true`
(5.7MB), grepped for `ReportChatScreen` (8 hits), `"Block user"` (1),
`"Chat options"` (1) — confirms Metro actually compiles this with zero
resolution/syntax errors, not just that `tsc` is happy. Built in parallel
with T5 by a separate agent scoped strictly to `apps/worker/` — no file
overlap with T5's `apps/customer/` changes (confirmed via `git status`
after both landed). Not verified: actual tap-through in a simulator — no
UI automation tool available this session, same gap as prior UI tickets.

**Depends on:** T3.
**Touches:** `apps/worker/src/screens/ChatScreen.tsx`, new
`apps/worker/src/screens/ReportChatScreen.tsx`,
`apps/worker/src/navigation/types.ts`,
`apps/worker/src/navigation/RootNavigator.tsx`.

- `ReportChatScreen.tsx` (new): same layout as the customer app's
  existing `ReportProblemScreen.tsx` (header row with back arrow +
  title, reason list, optional details `TextField`, submit button) but:
  - reason list is the four new chat categories (Harassment/abusive
    language, Inappropriate content, Spam or scam, Other) — **not**
    the four job-outcome ones `ReportProblemScreen` uses.
  - takes `jobId` and an optional `messageId` + `messageText` nav
    param; when `messageText` is present, render it read-only above the
    reason list (PRD §6a — reported message shown for context).
  - submit calls `reportJob(token, jobId, category, details,
    messageId)` (T3) then `navigation.goBack()`.
- `ChatScreen.tsx` header: add an overflow control (⋮, `Pressable` +
  hitSlop, matching the back arrow's existing style) next to the
  existing back arrow/avatar/name row. Tapping it opens a lightweight
  menu (this codebase has no existing dropdown-menu primitive to reuse
  per a scan of `packages/ui` — implementer's call between a small
  custom `Modal`-based menu and `Alert.alert`'s button-list form used
  as a poor-man's menu; note which was used and why):
  - "Report user" → always present →
    `navigation.navigate("ReportChat", { jobId })` (no `messageId`).
  - "Block user" → **only included in the menu when `isClosed` is
    true** (reuse `ChatScreen`'s existing `TERMINAL_STATUSES`/`isClosed`
    check already computed for the input-row gate) — while the job is
    active, the menu shows "Report user" only, per PRD §6c. Confirming
    via `Alert.alert` (destructive-style "Block" button) naming
    `job.customer.full_name` before calling `blockCounterpart`, then a
    brief success `Alert.alert` ("Blocked — you won't be offered jobs
    with them again.").
- Per-message long-press: wrap each message bubble's `View`
  (`ChatScreen.tsx`'s existing `.map()` over `messages`) in a
  `Pressable` with `onLongPress` → `navigation.navigate("ReportChat",
  { jobId, messageId: message.id, messageText: message.text })`.
- `navigation/types.ts`: add `ReportChat: { jobId: number; messageId?:
  number; messageText?: string }` to `WorkerRootStackParamList`.
- `RootNavigator.tsx`: register `<Stack.Screen name="ReportChat"
  component={ReportChatScreen} />`.

**Acceptance criteria**
- Long-pressing any message bubble opens `ReportChatScreen` with that
  message's text shown for context; submitting files a report against
  that specific message.
- The header menu's "Report user" opens the same screen without a
  message attached, from any job status.
- The header menu's "Block user" item is present only once the job is
  terminal; confirming it calls the block endpoint and shows a success
  message; the chat screen itself doesn't crash or change state beyond
  that (job is already closed by this point).
- None of this UI is reachable/attempted on a job with no assigned
  worker (moot in practice — `ChatScreen` is only reachable once
  `job.worker` exists, per the `chat` PRD).

**Tests**
- No new polling/timer/pure-logic extraction is required by this
  ticket's own scope (the terminal-status check already exists and is
  reused, not duplicated) — no new unit tests expected beyond
  typecheck, consistent with this project's "logic, not full-screen
  rendering" test policy. If the menu-open/close or long-press handling
  ends up non-trivial enough to extract as a pure function, it gets a
  unit test the same way other extracted logic in this codebase does —
  implementer's call, note if anything was extracted.

---

### T5 — Customer: chat safety UI (report message, report user, block user) ✅ Done

**Implementation notes:** built as planned, no deviations — the
`Alert.alert`-as-menu choice was already decided by T4's directive rather
than left open, so both apps landed on the identical pattern. New
`ReportChatScreen.tsx` mirrors `ReportProblemScreen.tsx`'s exact layout
with the four chat categories; header title switches between "Report
message" / "Report user" depending on whether `messageText` is present.
`ChatScreen.tsx`'s header gained the same `⋮` → `Alert.alert("Chat
options", ...)` menu as T4's, "Block user" only appended once `isClosed`,
confirming via a second `Alert.alert` naming `job.worker?.full_name ||
"this worker"` before calling `blockCounterpart`. Each message bubble
wrapped in a `Pressable` with `onLongPress` navigating to `ReportChat`.
`navigation/types.ts` and `RequestNavigator.tsx` updated — `ReportChat`
registered with `presentation: "modal"`, matching how `ReportProblem` is
already registered on this stack. Typecheck clean; customer Jest suite
42/42, unchanged — no new tests, same "pure UI wiring" reasoning as T4.
Live bundle check against the already-running Metro dev server (port
8095): fetched `.expo/.virtual-metro-entry.bundle?platform=ios&dev=true`
(6.0MB), grepped for `ReportChatScreen` (8 hits), `"Block user"` (1),
`"Chat options"` (2) — confirms Metro compiles this cleanly. Built in
parallel with T4 by a separate agent scoped strictly to `apps/customer/`
— `git status` after both landed showed no file overlap with T4's
`apps/worker/` changes. Not verified: actual tap-through in a simulator —
no UI automation tool available this session.

This closes out the `chat-safety` PRD — all 5 tickets done.

**Depends on:** T3. Independent of T4 — can be done in parallel.
**Touches:** `apps/customer/src/screens/request/ChatScreen.tsx`, new
`apps/customer/src/screens/request/ReportChatScreen.tsx`,
`apps/customer/src/navigation/types.ts`,
`apps/customer/src/navigation/RequestNavigator.tsx`.

- Same shape as T4, roles flipped: header shows/blocks the **worker's**
  identity (`job.worker.full_name`), "mine" bubble alignment stays
  whatever `ChatScreen.tsx` already uses (unchanged by this ticket).
- `ReportChatScreen.tsx` here can closely mirror the existing
  `ReportProblemScreen.tsx` in the same directory
  (`apps/customer/src/screens/request/`) even more directly than T4's,
  since that file already exists in this app as a layout reference —
  same four new chat categories, same optional message-context block,
  same `reportJob(..., messageId)` call.
- `navigation/types.ts`: add `ReportChat: { jobId: number; messageId?:
  number; messageText?: string }` to `RequestStackParamList` (same
  stack `Chat`/`ReportProblem`/`AddressForm` already live in).
- `RequestNavigator.tsx`: register the `ReportChat` screen.
- Header overflow menu: same "Report user" (always) / "Block user"
  (terminal-only) split as T4, confirming via `Alert.alert` naming the
  worker.

**Acceptance criteria**
- Same as T4's, mirrored for the customer app: long-press → report a
  specific message; header menu → report the worker generally (any
  status) or block them (terminal only).
- This finally closes the customer-only asymmetry noted in the PRD's
  current-state section (§2) for the **new** report/block surface —
  both apps now carry identical chat-safety capability, even though
  the pre-existing job-outcome "Report a problem" screen remains
  customer-only (out of this PRD's scope to retrofit, per PRD §2).

**Tests**
- Same as T4: no new unit tests expected beyond typecheck unless
  something non-trivial gets extracted; note if so.

---

## Suggested implementation order

T1 and T2 in parallel (both independent, both pure backend) → T3
(needs both live endpoints to round-trip against) → T4 and T5 in
parallel (both only need T3).
