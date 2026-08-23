# Tickets: Customer Jobs Tab + Profile Editing (Both Apps)

See `docs/prds/customer-jobs-tab-and-profile-editing.md` for full context,
goals/non-goals, and reasoning behind the technical decisions referenced
here.

---

### T1 — Customer jobsTab logic helpers ✅ Done

**Implementation notes:** built as planned —
`apps/customer/src/jobsTab/{sortJobs,formatJobStatus,jobsTabGrouping,
jobsTabRouting,jobDetailFormatting}.ts`, each with its own test file.
`sortJobs.ts`, `formatJobStatus.ts` (label + tone, no `getPriceCaption`),
and `jobDetailFormatting.ts` are direct ports of the worker versions —
genuinely role-agnostic logic. `jobsTabGrouping.ts`'s
`isActiveJobStatus` is the customer-specific piece: inverted framing
from the worker version (anything *not* terminal counts as active,
rather than an explicit inclusion list), since the customer tracks a job
from submission, before any worker is assigned — verified this doesn't
silently drop `requested`/`searching`/`matched` from the Active tab.
`computeAgreedTotalThisMonth` intentionally has no customer equivalent
(worker-earnings concept, see PRD non-goals). `jobsTabRouting.ts`'s
`getJobsTabRoute` sends `matched` straight to `JobStatus` rather than
the one-time `Matched` intro screen — re-entering via the Jobs tab
later shouldn't replay a "you've been matched!" celebration. Added a
`formatJobStatus.test.ts` (worker's T7 didn't have one — added here
since the ticket called for full status→tone coverage) plus a
`groupByRecency` boundary test for a job exactly 7 days old (resolves to
`earlier`, not `thisWeek` — the comparison is strict `<`). 20 tests
across 6 suites pass; typecheck clean.

**Depends on:** none (uses the existing, already role-agnostic
`JobRequest` type from `@prizm/api`).
**Touches:** new `apps/customer/src/jobsTab/` directory (mirrors
`apps/worker/src/jobsTab/` in shape, not content).

- `sortJobs.ts` — `sortJobsNewestFirst(jobs)`. Near-identical to the
  worker version; copy as a starting point.
- `formatJobStatus.ts` — `formatJobStatusLabel(status)`,
  `getStatusTone(status): StatusTone`. Tone mapping isn't role-specific,
  so this should be portable from the worker version essentially as-is.
  **Do not** port `getPriceCaption` — its "Proposed"/"Confirmed" framing
  was written from the worker's price-setting perspective; if the
  customer Jobs tab needs an equivalent caption, write it fresh against
  what makes sense from a price-*receiving* perspective.
- `jobsTabGrouping.ts` — `isActiveJobStatus(status)` (same terminal-state
  boundary as the worker version: anything not
  `completed`/`cancelled`/`disputed` counts as active),
  `groupByRecency(jobs, now)`, `formatJobCardDate(dateString, now)`.
  **Do not** port `computeAgreedTotalThisMonth` — it's a worker-earnings
  concept with no customer equivalent (see PRD non-goals).
- `jobsTabRouting.ts` — `getJobsTabRoute(status)`, returning customer
  stack screen names instead of worker ones:
  `requested`/`searching` → `"Searching"`, `matched`/`accepted`/
  `on_my_way`/`arrived`/`in_progress` → `"JobStatus"`,
  `awaiting_price_confirmation` → `"PriceAgreement"`, everything else →
  `"JobDetail"` (new screen, built in T2).
- `jobDetailFormatting.ts` — `formatFullDateTime(dateString)`,
  `computeJobDuration(acceptedAt, completedAt)`. Direct port of the
  worker version (this logic has no role-specific behavior at all).

**Acceptance criteria**
- All four files typecheck with no dependency on any worker-app file
  (fully self-contained under `apps/customer/`).

**Tests**
- `sortJobsNewestFirst`: unordered input sorts newest-first, stable for
  equal timestamps, no crash on empty array.
- `getStatusTone`: every `JobStatus` value maps to an expected tone (no
  fallthrough gaps).
- `groupByRecency`: jobs within the last 7 days land in `thisWeek`,
  older ones in `earlier`, boundary case (exactly 7 days old) resolves
  one specific way (pick and assert it, don't leave it ambiguous).
- `getJobsTabRoute`: every `JobStatus` value maps to its expected
  customer screen name.
- `formatFullDateTime`/`computeJobDuration`: same cases as the worker
  test suite (multi-hour, sub-hour, missing `accepted_at`, negative
  duration → null).

---

### T2 — Customer Jobs tab: replace Requests/Bookings with list + detail ✅ Done

**Implementation notes:** built as planned. `RootTabs.tsx` now has 4 tabs
(Home, Jobs, Messages, Profile); `RequestsScreen.tsx`/`BookingsScreen.tsx`
deleted outright rather than left as dead files. `JobsScreen.tsx` mirrors
the worker Jobs tab's structure (segmented control, colored-rail cards,
THIS WEEK/EARLIER grouping) with the PRD's adaptations: cards show
`job.worker`'s avatar/name once assigned, or a neutral "🔍 Finding a
worker…" placeholder row before that (`requested`/`searching` have no
worker yet); no monthly-total stat on the Completed tab (worker-earnings
concept, doesn't apply). `JobDetailScreen.tsx` mirrors the worker
version's honest price labeling ("FINAL PRICE" / "Confirmed {date}", no
"PAID" language) and adds a `Badge` "✓ Verified" row (matching
`MatchedScreen`'s existing pattern) plus a rating section framed as
"Your rating" — if `job.status === "completed"` and `job.rating` is
still null, shows a "Rate this job" button routing to `RatingScreen`
rather than a blank state (the edge case the PRD flagged: reaching
Completed via the Jobs tab bypasses the normal
`PriceAgreement`→`Rating` auto-chain). Checked the cross-entry-point
concern from the PRD (screens working when reached directly from the
Jobs tab, not only mid-flow) — `Searching`/`JobStatus`/`PriceAgreement`/
`Rating` were all already purely `route.params.jobId`-driven (fetch via
`getJob` in a `useEffect`, no reliance on prior-screen state), so no fix
was needed here, unlike the worker app's T7 which did need one for
`ActiveJobScreen`. Typecheck clean; no new tests (screen-wiring only, per
the ticket's Tests note); bundle verified live.

**Depends on:** T1.
**Touches:** `apps/customer/src/navigation/RootTabs.tsx`,
`apps/customer/src/navigation/types.ts`, new
`apps/customer/src/screens/JobsScreen.tsx`, new
`apps/customer/src/screens/JobDetailScreen.tsx`; delete
`apps/customer/src/screens/RequestsScreen.tsx` and
`BookingsScreen.tsx`; wire `JobDetailScreen` into whichever navigator
currently hosts `RootTabs` (likely `RequestNavigator.tsx`, same stack
`JobStatus`/`PriceAgreement` already live in, so a Jobs-tab card tap can
reach it).

- `RootTabs.tsx`: drop the `Requests` and `Bookings` tab entries, add a
  single `Jobs` tab pointing at the new `JobsScreen`. Update
  `RootTabParamList` accordingly (`types.ts`).
- `JobsScreen.tsx`: Active/Completed segmented control (reuse the
  worker Jobs tab's segmented-control styling/structure verbatim — it's
  presentational, not role-specific). Active tab uses `isActiveJobStatus`
  to filter, Completed tab uses `groupByRecency` for THIS WEEK/EARLIER
  sections. Header: "Jobs" title + "N active" count on the Active tab
  only (no stat on Completed — see PRD non-goals).
- Card component: colored status-tone rail (reuse `getStatusTone`),
  worker's avatar + `full_name` from `job.worker` (once matched — before
  a worker is assigned, i.e. `requested`/`searching`, render a neutral
  "Finding a worker…" placeholder row instead of `Avatar`), category +
  description, status pill, price (estimate range pre-agreement, agreed
  price once set), date via `formatJobCardDate`.
- Tap a card → `navigation.navigate(getJobsTabRoute(job.status), {
  jobId: job.id })`. Verify each target screen
  (`Searching`/`Matched`/`JobStatus`/`PriceAgreement`/`JobDetail`)
  correctly initializes itself from just a `jobId` route param when
  entered this way (not only when pushed mid-flow from
  `RequestSubmissionScreen`) — this is the same cross-entry-point
  concern T7 hit on the worker side (`ActiveJobScreen` needed to work
  whether reached from an accepted offer or from the Jobs tab).
- `JobDetailScreen.tsx` (new, read-only, no action buttons — same
  design rule as the worker version, this is history/tracking-recovery,
  not a live-action screen): worker identity (avatar, name, verified/
  certified badges if present), category, address, `formatFullDateTime`/
  `computeJobDuration` completion rows, description, final price card
  (reuse the worker `JobDetailScreen`'s "FINAL PRICE" / "Confirmed
  {date}" honest-labeling pattern — no "PAID" language here either, same
  reasoning: no payment integration exists yet), and a rating section
  showing what **the customer gave** (`job.rating`) — if `job.status ===
  "completed"` and `job.rating` is null (shouldn't normally happen, see
  PRD §5a), show a "Rate this job" prompt routing to `RatingScreen`
  instead of a blank state.
- Empty states: Active tab gets the richer empty state (icon + heading +
  description + a button navigating to Home), matching the worker
  pattern; Completed tab gets a simple `Card`-based empty state.

**Acceptance criteria**
- Submitting a request and having it matched/accepted shows up under
  Jobs → Active, and tapping it routes into live tracking — this is the
  PRD's core "can't get back into an active job" fix; verify by leaving
  `JobStatus` via the back button (already shipped) and confirming the
  job is reachable again from the Jobs tab.
- A completed job appears under Jobs → Completed, correctly dated, and
  its detail screen shows the worker's identity, final price, and the
  rating given.
- List renders correctly for 0, 1, and many jobs in both tabs.
- No screen reachable from a Jobs-tab tap crashes or shows undefined/NaN
  when entered directly with just a `jobId` (as opposed to being pushed
  mid-flow with additional context already in memory).

**Tests**
- None beyond T1's (this ticket is screen wiring/presentation, consistent
  with this project's testing philosophy of not writing full-screen
  render tests — see CLAUDE.md).

---

### T3 — Profile editing (both apps) ✅ Done

**Implementation notes:** `updateProfile` already existed in
`packages/api/src/auth.ts` with exactly the branching needed (name-only
`PATCH` vs multipart with `photoUri`) — no new API work at all, as the
PRD anticipated. Extracted a shared `ProfileHeader` component into
`packages/ui` (avatar + inline name editing: tap "Edit" → `TextField` +
Save/Cancel) rather than duplicating it across both apps — this wasn't
the same "don't share across two call sites" call as T1's jobsTab logic,
since here the two usages are pixel-identical (no role-specific
behavior in the header itself; worker's extra ID-verification `Badge`
row lives below it, untouched, in the app's own screen). The component
takes `onPickPhoto`/`onSaveName` callbacks rather than owning
`expo-image-picker` or the API call itself, so `packages/ui` stays
free of a device-API dependency — each app's `ProfileScreen.tsx` still
owns its own ~10-line `pickPhoto` (matching the existing onboarding
pattern in `packages/auth-flow`) and calls `updateProfile` +
`setProfile` (the existing `useAuth()` local-state setter, so edits
show immediately rather than only after a relaunch). Photo upload
happens immediately on picking (per the PRD), name editing has its own
explicit Save step. Typecheck clean, both apps' existing test suites
still pass unchanged (42 worker / 20 customer) — no new tests, since
`updateProfile` is pre-existing pass-through logic and `ProfileHeader`
is interactive UI, consistent with this project's "test logic, not
screens" philosophy. Bundles verified live on both apps.

**Depends on:** none (independent of T1/T2; can be done in parallel).
**Touches:** `apps/customer/src/screens/ProfileScreen.tsx`,
`apps/worker/src/screens/ProfileScreen.tsx`; possibly a new shared
component in `packages/ui` if the two implementations end up identical
(likely, given both screens are already near-identical in shape).

- Add an `Avatar` at the top of both Profile screens (currently absent
  entirely), sized/styled consistently with its onboarding usage.
  Tapping it opens the same image-picker flow already used during
  onboarding (reuse that picker logic rather than re-implementing it —
  check `@prizm/auth-flow`'s profile-photo onboarding step for the
  existing pattern).
- On picking a new photo, `PATCH` it immediately via the existing
  `updateProfile`-equivalent call against `/api/auth/profile/` (add a
  thin `updateProfile(token, {photo?, full_name?})` function to
  `packages/api/src/auth.ts` if one doesn't already exist under a
  different name — check first).
- Full name becomes editable. Implementation picks either inline editing
  or a small "Edit profile" form — pick one, note the reasoning briefly
  in the ticket's implementation notes once done, since the PRD
  deliberately left this as an implementation-time call.
- Worker's Profile screen keeps its existing ID-verification `Badge` row
  unchanged — just gains the avatar + name-edit above it, same as the
  customer screen otherwise.
- Both `PATCH` calls need to actually persist (verify by editing, then
  force-quitting and relaunching the app — not just checking optimistic
  local state).

**Acceptance criteria**
- Both apps' Profile screens show an avatar (placeholder state if no
  photo set yet, consistent with `Avatar`'s existing `uri={null}`
  behavior elsewhere in the codebase).
- Changing the photo or name persists across an app relaunch (proves the
  `PATCH` actually landed, not just local state).
- Worker's ID-verification badge still renders correctly, unaffected by
  the new elements added above it.

**Tests**
- If `updateProfile` is added as a new `packages/api` function with any
  non-trivial logic (e.g. conditionally building the multipart body based
  on which fields changed), unit test that logic. If it ends up being a
  thin pass-through to the existing `apiRequest`/`toUploadFile` pattern
  with no branching, no test is needed — consistent with this project's
  "test logic, not wiring" philosophy.

---

## Suggested implementation order

T1 → T2 (T2 needs T1's helpers). T3 has no dependency on either and can
be done first, last, or in parallel with T1/T2 if that's more convenient.
