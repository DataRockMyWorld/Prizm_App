# Tickets: In-App Chat (Both Apps)

See `docs/prds/chat.md` for full context, goals/non-goals, and reasoning
behind the technical decisions referenced here.

---

### T1 — Backend: Message API ✅ Done

**Implementation notes:** built as planned, following the sketch closely.
One `MessageSerializer` handles both read and create (no separate
create-input serializer needed — `text` is the only writable field,
`sender`/`id`/`created_at` are `read_only_fields`; `sender` set
explicitly in the view via `Message.objects.create(job=job,
sender=request.user, ...)`, not through the serializer's `save()`).
Added a `validate_text` override (`strip()`, reject if empty after
stripping) since the model's plain `TextField` only rejects an
exactly-empty string, not whitespace-only — needed to satisfy the
ticket's "blank/whitespace-only" rejection requirement. `last_message`
on `JobRequestSerializer` uses `obj.messages.order_by("-created_at")
.first()` rather than `.last()`, since `Message.Meta.ordering` is
ascending. `MessageListCreateView` matches `ReportJobView`'s exact
403/`get_object_or_404` shape verbatim. 10 new tests in
`jobs/tests/test_messages.py` (permission scoping on both verbs, blank/
whitespace rejection, no-worker rejection, terminal-status rejection on
POST but not GET — parametrized across completed/cancelled/disputed,
ordering, `last_message` null and populated cases), all passing; full
backend suite 31/31. Also manually round-tripped against the live local
backend (not just tests): created a real customer+worker+job via Django
shell, POSTed from both sides, confirmed `GET` ordering and
`last_message` on the job-detail endpoint reflect exactly what's
expected — cleaned up the test users afterward.

**Depends on:** none.
**Touches:** `backend/jobs/serializers.py`, `backend/jobs/views.py`,
`backend/jobs/urls.py`, `backend/jobs/tests/factories.py`,
`backend/jobs/tests/`.

- `MessageSenderSerializer` (new, `jobs/serializers.py`): `id, full_name,
  photo` off the `User` model directly — **not** `WorkerPublicSerializer`/
  `CustomerPublicSerializer`, since a message's sender can be either role
  and those two serializers carry role-specific fields (`verified`,
  `rating_average`) that don't apply generically.
- `MessageSerializer`: `id, sender (MessageSenderSerializer), text,
  created_at`, all read-only except `text` on create (mirrors
  `RatingCreateSerializer`/`ReportCreateSerializer`'s separation of
  concerns — a plain `serializers.Serializer` with just `text =
  CharField()` for the create-input shape is fine too; implementer's
  call on whether one serializer or two, note which in implementation
  notes).
- `MessageListCreateView` (new, `jobs/views.py`) — **plain `APIView`
  with `get`/`post`, matching this file's own established convention**
  (every existing job-action view here — `JobRequestListCreateView`,
  `ReportJobView`, `RateJobView`, etc. — is a plain `APIView`, not a DRF
  generic view; don't introduce `generics.ListCreateAPIView` just because
  `accounts/views.py` uses that pattern elsewhere — different app,
  different established convention, follow the one already in this file):
  ```python
  class MessageListCreateView(APIView):
      permission_classes = [IsAuthenticated]

      def get(self, request, pk):
          job = get_object_or_404(JobRequest, pk=pk)
          if request.user.id not in (job.customer_id, job.worker_id):
              return Response({"detail": "Not your job."}, status=403)
          messages = job.messages.select_related("sender")
          return Response(MessageSerializer(messages, many=True).data)

      def post(self, request, pk):
          job = get_object_or_404(JobRequest, pk=pk)
          if request.user.id not in (job.customer_id, job.worker_id):
              return Response({"detail": "Not your job."}, status=403)
          if job.worker_id is None:
              return Response({"detail": "No worker assigned yet."}, status=400)
          if job.status in (JobRequest.Status.COMPLETED, JobRequest.Status.CANCELLED, JobRequest.Status.DISPUTED):
              return Response({"detail": "This job is closed."}, status=400)
          # validate + create, sender=request.user
  ```
  (sketch — implementer fills in the actual serializer validation call;
  exact status-code choices should match this file's existing
  conventions, e.g. 400 vs 403 usage above mirrors `RateJobView`.)
- URL: `path("<int:pk>/messages/", MessageListCreateView.as_view(),
  name="job-messages")` in `jobs/urls.py`, grouped with the other
  `<int:pk>/<action>/` routes — matches this file's exact existing
  pattern (`<int:pk>/report/`, `<int:pk>/rate/`, etc.), not a new
  `<job_id>` naming style.
- `JobRequestSerializer` gains `last_message` (`SerializerMethodField`):
  `null` if the job has no messages, else `{text, created_at,
  sender_id}` of the most recent one (`job.messages.order_by("-created_at").first()`
  — `Message.Meta.ordering` is ascending, so this needs an explicit
  `.order_by("-created_at")`, not just `.last()` on the default manager
  unless confirmed safe).
- `MessageFactory` (new, `jobs/tests/factories.py`): `job
  (SubFactory(JobRequestFactory)), sender (SubFactory(UserFactory)),
  text (Faker("sentence"))`.

**Acceptance criteria**
- A job's customer and its assigned worker can both `GET`/`POST`
  `/api/jobs/<id>/messages/`; any other authenticated user gets 403 on
  both.
- `POST` with blank/whitespace-only `text` is rejected (400).
- `POST` is rejected (400) when `job.worker` is `None`.
- `POST` is rejected (400) once `job.status` is `completed`/`cancelled`/
  `disputed`; `GET` still succeeds in that state (history stays
  readable).
- Messages come back oldest-first.
- `GET /api/jobs/<id>/` (existing endpoint) now includes `last_message`:
  `null` with no messages, else the most recent message's summary.

**Tests**
- Factory-driven `pytest-django`: permission scoping (customer ✓, worker
  ✓, unrelated user ✗) on both `GET` and `POST`; blank-text rejection;
  no-worker rejection; terminal-status rejection on `POST` but not `GET`;
  ordering (oldest-first) with 3+ messages; `last_message` `null` case
  and populated case (create 2 messages, assert it reflects the newer
  one, not the older).

---

### T2 — `@prizm/api`: `messages.ts` resource ✅ Done

**Implementation notes:** built as planned — `Message`/`MessageSender`
types plus `listMessages`/`sendMessage`, thin `apiRequest` wiring. No
`interface`-vs-`type` body-typing issue this time (`sendMessage`'s body
is an inline `{ text }` object literal, not a named interface, so the
`profile-redesign` T4 pitfall didn't apply here). Added `JobLastMessage`
and a `last_message: JobLastMessage | null` field to the existing
`JobRequest` type in `jobs.ts`, matching T1's backend addition. Making
`last_message` **required** (not optional) on the type broke 5 existing
test-fixture object literals across both apps (`sortJobs.test.ts` ×2,
`jobsTabGrouping.test.ts` ×2, `useJobStatusPolling.test.ts` ×1) that
construct a `JobRequest` by hand without it — fixed each by adding
`last_message: null` alongside their existing `rating: null`/`accepted_at:
null` lines, rather than making the field optional, since the backend
always returns it and an optional type would let every future consumer
skip a null-check it doesn't actually need to skip. Both apps typecheck
clean; worker 49/49, customer 24/24 (no new tests added by this ticket
itself — pure fixture fixes, not new behavior). Round-tripped
`sendMessage`/`listMessages`'s exact request/response shapes against the
live backend (created a throwaway job via Django shell, `curl`'d the same
path/method/body the functions construct), confirmed the response
matches `Message`/`MessageSender` field-for-field. Test data cleaned up
afterward.

**Depends on:** T1.
**Touches:** new `packages/api/src/messages.ts`,
`packages/api/src/index.ts`, `packages/api/src/jobs.ts` (add
`last_message` to the existing `JobRequest` type).

- `Message` type: `{ id, sender: { id, full_name, photo }, text,
  created_at }`.
- `listMessages(token, jobId)` → `GET /api/jobs/<jobId>/messages/`.
- `sendMessage(token, jobId, text)` → `POST /api/jobs/<jobId>/messages/`.
- `JobRequest` (in `jobs.ts`) gains `last_message: { text: string,
  created_at: string, sender_id: number } | null`.
- Watch for the same TS pitfall hit in `profile-redesign` T4/T5: if any
  request body ends up typed via a named `interface` rather than a
  `type` alias, assigning it to `apiRequest`'s `Record<string, unknown> |
  FormData` body param will fail to typecheck — use `type`, not
  `interface`, for the create-input shape (a one-field `{ text: string
  }` here, so likely moot, but keep it in mind).

**Acceptance criteria**
- Both functions typecheck and round-trip against T1's live endpoints
  (manual check against the local Docker backend is sufficient, same as
  `profile-redesign` T4's approach).

**Tests**
- None expected unless non-trivial branching logic appears — thin
  wiring, consistent with this project's testing philosophy.

---

### T3 — Worker: `ChatScreen` + polling hook ✅ Done

**Implementation notes:** built as planned. `useMessagePolling` mirrors
`useJobStatusPolling`'s shape but returns `{ messages, refresh }` instead
of a status branch — `refresh` (the same `poll` function, exposed) lets
`ChatScreen` force an immediate re-fetch right after `sendMessage`
succeeds rather than waiting up to `intervalMs` for the new message to
appear, without needing an optimistic-append/reconciliation dance.
`ChatScreen` determines "mine vs theirs" by comparing `message.sender.id`
to `job.worker?.id` — **not** a separately-fetched own-user id — since
the `Profile` type from `useAuth()` has no `id` field at all (only
`phone_number, role, full_name, photo, ...`), and the worker viewing this
screen is definitionally `job.worker` once a job is reachable via
`ActiveJobScreen`. This avoids a broader change to `ProfileSerializer`/
`Profile` just for this. Bubbles use a plain `ScrollView` + ref +
`scrollToEnd` on message-count change rather than an `inverted`
`FlatList` (the standard RN chat pattern) — deliberately avoided, since
`inverted` requires transform-flipping every child to read right-side-up
again, a real source of subtle bugs that's hard to verify without
click-testing available this session; a plain scroll-to-bottom is simpler
and safer to get right blind. `Screen` (this codebase's shared safe-area
wrapper) is used here even though `ActiveJobScreen` itself doesn't use
it — `ActiveJobScreen`'s raw-`View` approach looked like a pre-existing
outlier, not a pattern worth copying into a brand-new screen. 5 new tests
in `useMessagePolling.test.ts` (immediate poll, interval re-poll, cleanup
on unmount, `refresh()` triggering an extra poll, no polling with a null
token), all passing; full worker suite 54/54. Typecheck clean. Confirmed
Metro's real bundler compiles the app with this ticket's new code present
(same live-bundle-fetch-and-grep check as previous tickets).
**Same click-through gap as every UI ticket this round**: the chat
button → real screen flow is unverified beyond code review — no UI
automation available this session.

**Depends on:** T2.
**Touches:** new `apps/worker/src/chat/useMessagePolling.ts`, new
`apps/worker/src/screens/ChatScreen.tsx`,
`apps/worker/src/navigation/types.ts`,
`apps/worker/src/navigation/RootNavigator.tsx`,
`apps/worker/src/screens/ActiveJobScreen.tsx`.

- `useMessagePolling(jobId, accessToken)`: mirrors
  `useJobStatusPolling.ts`'s exact shape (immediate poll on mount, then
  `setInterval`/`clearInterval` in a `useEffect`, in-flight ref guard,
  silent catch-and-retry, cleanup on unmount/param change) — copy that
  hook's structure as the starting point, adapted to call `listMessages`
  instead of `getJob`.
- `ChatScreen.tsx`: on mount, fetch the job once via the existing
  `getJob(jobId)` (needed for the customer's name/photo in the header
  and to know `job.status`/`job.worker` for the terminal-state gate —
  **not** re-fetched on every poll tick, just once; a job transitioning
  to terminal mid-chat-session without the screen noticing is an
  accepted edge case, not handled here, per the PRD's scope). Message
  list via `useMessagePolling`; bubbles right-aligned when
  `message.sender.id === (the worker's own user id, from `useAuth()`'s
  `profile`)`, left-aligned otherwise. Text input + send button at the
  bottom, calling `sendMessage`, appending optimistically or just
  re-polling immediately after send (implementer's call, note which).
  If the job (fetched at mount) is already terminal, input area shows
  "This job is closed" instead of the text field — no need to
  re-check this dynamically given the accepted edge-case tradeoff above.
- `navigation/types.ts`: add `Chat: { jobId: number }` to
  `WorkerRootStackParamList`.
- `RootNavigator.tsx`: register `<Stack.Screen name="Chat"
  component={ChatScreen} />`.
- `ActiveJobScreen.tsx:116-122`: replace the `Alert.alert("Chat coming
  soon")` `onPress` with `navigation.navigate("Chat", { jobId })`.

**Acceptance criteria**
- Tapping the chat button on an active job (with an assigned worker,
  which is always true by the time `ActiveJobScreen` is reachable) opens
  a real chat screen showing existing messages and accepting new ones.
- Sending a message and having the customer (or a second test session)
  send one back shows up within one poll interval.
- Input is replaced with a closed-job note if reached for a job that's
  already terminal (shouldn't normally happen via `ActiveJobScreen`'s own
  navigation, but the screen shouldn't crash if it does).

**Tests**
- `useMessagePolling`: same test shape as the existing
  `useJobStatusPolling`/`useIncomingOfferPolling` suites — immediate
  poll fires, interval re-polls, cleanup stops polling on unmount.
- No rendering tests for `ChatScreen` itself, per project policy.

---

### T4 — Customer: `ChatScreen` + polling hook ✅ Done

**Implementation notes:** built as planned, mirroring T3's structure with
the roles flipped: "mine" is `job.customer.id` here (not `job.worker.id`),
the header shows the worker's identity, and this screen uses the typed
`NativeStackScreenProps<RequestStackParamList, "Chat">` pattern (matching
its sibling `JobStatusScreen`'s own convention) rather than
`useNavigation<any>()`/`useRoute<any>()` (which is what the worker app's
`ChatScreen` uses, matching *its* sibling `ActiveJobScreen`'s convention)
— each app's `ChatScreen` follows its own screen-typing convention rather
than picking one arbitrarily. The actual bug-fix half of this ticket:
`JobStatusScreen.tsx`'s chat icon was a bare `View` with no `onPress` at
all (not even a broken `Alert`, unlike the worker side) — now a real
`Pressable` navigating to `Chat`. Own copy of `useMessagePolling` (not
shared with T3's, per the PRD's explicit per-app decision) — same shape,
same 5-test suite adapted to this app's testing conventions. Customer
suite now 29/29 (24 + 5 new); worker suite re-checked, still 54/54
(shared `packages/api` untouched by this ticket, but worth reconfirming
after touching sibling navigation files). Both apps typecheck clean.
Confirmed Metro's real bundler compiles the customer app with this
ticket's code present (same check as T3, against port 8082). Same
click-through gap as T3 — unverified beyond code review this session.

**Depends on:** T2. Independent of T3 — can be done in parallel.
**Touches:** new `apps/customer/src/request/useMessagePolling.ts`, new
`apps/customer/src/screens/request/ChatScreen.tsx`,
`apps/customer/src/navigation/types.ts`,
`apps/customer/src/navigation/RequestNavigator.tsx`,
`apps/customer/src/screens/request/JobStatusScreen.tsx`.

- `useMessagePolling`: own copy in the customer app (not shared with
  T3's worker version — per the PRD's explicit decision, matching this
  codebase's existing per-app-not-shared polling hook precedent).
- `ChatScreen.tsx` (placed under `screens/request/`, alongside
  `JobStatusScreen`/`PriceAgreementScreen`, since it's reached from that
  same stack): same shape as T3's — fetch job once via `getJob` for
  header + terminal-gate, poll messages, bubbles aligned via comparing
  `sender.id` to the customer's own id from `useAuth()`.
- `navigation/types.ts`: add `Chat: { jobId: number }` to
  `RequestStackParamList` (already extended once this PRD's round for
  `AddressForm` in `profile-redesign` T6 — same file, same pattern).
- `RequestNavigator.tsx`: register the `Chat` screen.
- `JobStatusScreen.tsx:87-89`: the chat icon changes from a bare `View`
  to a `Pressable` with `onPress={() => navigation.navigate("Chat", {
  jobId })}` — this is the actual bug-fix half of this ticket, not just
  new-screen wiring.

**Acceptance criteria**
- Tapping the (now-real) chat icon on `JobStatusScreen` for a job with
  an assigned worker opens the same thread the worker sees on their side.
- Messages sent from either app are visible on the other within one poll
  interval.

**Tests**
- Same shape as T3: `useMessagePolling` gets the standard polling-hook
  test suite. No rendering tests for `ChatScreen`.

---

### T5 — Customer: Messages tab → real inbox ✅ Done

**Implementation notes:** built as planned. `sortThreadsByRecency` is a
pure sort only — the `job.worker !== null` filter lives inline in
`MessagesScreen` (a one-line `.filter()`, not worth its own extracted/
tested predicate, unlike the sort itself which has real boundary logic
worth pinning down: `last_message?.created_at ?? updated_at` as the sort
key). `formatRelativeTime` buckets: <60s "Just now", <60m "Xm ago", <24h
"Xh ago", exactly 1 day "Yesterday" (up to 48h), 2+ days a short date
("Aug 20", or "Aug 20, 2025" outside the current year) — every boundary
(60s, 1h, 24h, 48h) tested explicitly in both directions, matching this
project's established discipline (`groupByRecency`'s 7-day boundary
test, `canRemoveCategory`'s last-item boundary, etc.). `ThreadRow` reuses
the `JobsScreen` card-row shape (`Avatar` + info column + trailing meta)
but drops the status-tone rail/dot — a chat thread doesn't have a job
status concept the way a Jobs-tab card does. Empty state kept as the
original placeholder's plain `Card` shape (not the richer icon-based
empty state `JobsScreen`'s "No active jobs" uses) since the PRD only
specified plain text here, no icon. 13 new tests
(`sortThreads.test.ts` ×3, `formatRelativeTime.test.ts` ×10); customer
suite now 42/42. Typecheck clean. Confirmed Metro's real bundler
compiles the app with this ticket's code present. Same click-through gap
as T3/T4 — unverified beyond code review this session.

This closes out the `chat` PRD — all 5 tickets done.

**Depends on:** T1 (`last_message`), T4 (`ChatScreen` must exist to
navigate into).
**Touches:** `apps/customer/src/screens/MessagesScreen.tsx` (full
rewrite), new `apps/customer/src/messages/` directory for extracted
logic.

- Fetch via the existing `listMyJobs` (already used by the Jobs tab —
  no new endpoint), filter to `job.worker !== null`, sort by most recent
  activity — extract as a pure function, e.g.
  `apps/customer/src/messages/sortThreads.ts`:
  `sortThreadsByRecency(jobs: JobRequest[]): JobRequest[]`, using
  `job.last_message?.created_at ?? job.updated_at` as the sort key.
- Row: worker `Avatar` + `full_name`, last-message preview text (or "No
  messages yet — say hello" if `last_message` is `null`), a relative
  timestamp — extract as
  `apps/customer/src/messages/formatRelativeTime.ts`
  (`formatRelativeTime(dateString, now): string` — "2m ago"/"3h
  ago"/"Yesterday"/a short date beyond that; implementer picks the exact
  bucket boundaries and notes them, similar to how `groupByRecency`'s
  7-day boundary was made explicit in `customer-jobs-tab-and-profile-editing`
  T1).
- Tap a row → `navigation.navigate("Chat", { jobId: job.id })` (same
  stack as `JobStatusScreen`/the new `ChatScreen` from T4 — `Tabs` is
  nested inside `RequestNavigator`, so this cross-tab navigation works
  the same way `JobsScreen`'s existing `getJobsTabRoute` navigation
  already does).
- Empty state (no jobs with an assigned worker yet): "Messages will
  appear here once you're matched with a worker."

**Acceptance criteria**
- A job that just got a worker assigned (any status from `accepted`
  onward) appears in the inbox even with zero messages sent yet.
- Sending a message from either side updates that job's row's preview
  and moves it to the top of the list on next inbox visit.
- Tapping a row opens the correct job's thread.

**Tests**
- `sortThreadsByRecency`: correct ordering with a mix of
  has-last-message and no-last-message jobs, stable for equal timestamps.
- `formatRelativeTime`: coverage for each bucket boundary the
  implementation defines (e.g. under a minute, minutes, hours, exactly
  1 day, several days) — pick and assert specific boundary behavior,
  don't leave it ambiguous (same discipline as `groupByRecency`'s test
  suite).

---

## Suggested implementation order

T1 → T2 (needs T1's live endpoints to be meaningfully verified) → T3 and
T4 in parallel (both only need T2) → T5 (needs T1's `last_message` field
and T4's `ChatScreen` to route into).
