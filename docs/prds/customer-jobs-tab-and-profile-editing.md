# PRD: Customer Jobs Tab + Profile Editing (Both Apps)

## 1. Summary

Two gaps surfaced while click-testing the customer request flow end-to-end
for the first time (physical-device session, 2026-08-23):

1. **No way back into an active job.** `JobStatusScreen` had zero exit —
   no header, no back button — so a customer with an in-progress job was
   stuck. A minimal fix (a `‹` back button) already shipped directly (not
   through this PRD — it was a one-line navigational bug, not a feature).
   But leaving that screen loses the job: the customer app's "Requests"
   and "Bookings" tabs are stale, unbuilt placeholders (one literally
   references the SCHEDULED concept already dropped from the worker Jobs
   tab), so there's currently no way back to a job once you leave its
   live tracking screen. This PRD replaces both placeholder tabs with one
   real "Jobs" tab, mirroring what `worker-active-job-flow` T7 built for
   the worker app.
2. **No profile editing anywhere.** Both apps' Profile tabs show only a
   name and phone number as plain text — no avatar, no way to change
   anything after onboarding. The backend already supports this
   (`ProfileView` is a `RetrieveUpdateAPIView` whose docstring says
   "general profile edits"), so this is almost entirely a frontend gap.

## 2. Current state (as of 2026-08-23)

- **Worker Jobs tab** (`apps/worker/src/screens/JobsScreen.tsx` +
  `apps/worker/src/jobsTab/*`, built in `worker-active-job-flow` T7):
  Active/Completed segmented control, colored status-tone rail per card,
  THIS WEEK/EARLIER date grouping for Completed, tap-through to either
  the live `ActiveJob`/`WaitingForConfirmation` screen (still-active jobs)
  or a read-only `JobDetailScreen` (closed jobs). This is the pattern to
  mirror, not copy verbatim — the customer's card identity is the
  *worker* (photo/name), not itself, and there's no "agreed this month"
  earnings-style header stat on the customer side (that's a
  worker-specific business concept).
- **Customer app tabs** (`apps/customer/src/navigation/RootTabs.tsx`):
  five tabs — Home, Requests, Bookings, Messages, Profile. Requests and
  Bookings are both static placeholder `Card`s with no data (see
  `RequestsScreen.tsx` / `BookingsScreen.tsx`). Messages is also a
  placeholder (out of scope here — chat is CLAUDE.md build-order step 9,
  not started).
- **`listMyJobs`/`getJob`** (`packages/api/src/jobs.ts`) are already
  role-agnostic on the backend (`JobRequestListCreateView.get` branches
  on `request.user.role` server-side) — no new API work needed for the
  list. `JobRequestSerializer` already exposes both `customer` and
  `worker` public sub-objects on every job, so the customer app already
  receives the worker's name/photo/verified/rating_average on `job.worker`.
- **Profile screens**: `apps/customer/src/screens/ProfileScreen.tsx` and
  `apps/worker/src/screens/ProfileScreen.tsx` — both just a `Card` with
  name + phone (worker's also shows an ID-verification `Badge`) and a
  "Log out" button. No avatar rendered anywhere. `ProfileView`
  (`backend/accounts/views.py`) + `ProfileSerializer`
  (`backend/accounts/serializers.py`) already support `PATCH` for
  `full_name` and `photo` (also `biometric_enabled`, out of scope per
  this session's scoping decision — no UI for it yet, stays that way).
  `phone_number` and `role` are correctly read-only on that serializer.
- **Onboarding already has the exact upload UI needed**: the profile-photo
  step during onboarding (in `@prizm/auth-flow`) already drives
  `updateProfile`-style calls with an image picker. Editing reuses that
  pattern rather than inventing a new one.
- **Recently fixed, relevant context**: uploads
  (`packages/api/src/*.ts` → `toUploadFile`) previously used a hardcoded
  generic filename per upload type (e.g. every profile photo literally
  named `photo.jpg`), which combined with S3's overwrite-by-default
  behavior meant every user's photo silently overwrote every other
  user's. Fixed today (`backend/config/storage_backends.py`
  `unique_upload_path`) — mentioned here only because it means re-editing
  a profile photo now is safe to test without repeating that bug.

## 3. Goals

- Replace the customer app's "Requests" and "Bookings" tabs with a single
  "Jobs" tab: Active/Completed segmented control, tap-through to either
  the live tracking screen (`JobStatus`/`PriceAgreement`) for still-open
  jobs or a new read-only `JobDetailScreen` for closed ones — restoring
  the ability to navigate back into an active job after leaving it, and
  giving customers a real history view for the first time.
- Add profile editing (photo + full name) to **both** apps' Profile tabs,
  reusing the onboarding upload pattern and the already-existing backend
  `PATCH /api/auth/profile/` endpoint.

## 4. Non-goals (explicitly out of scope for this PRD)

- Biometric-toggle UI, even though the backend field exists (scoped out
  this round — no user-facing entry point for it yet).
- Phone-number change (would need its own OTP-reverification flow —
  real feature, not bundled here).
- Chat/Messages tab (separate, not-yet-started CLAUDE.md build-order
  step).
- Any backend changes to `ProfileView`/`ProfileSerializer` — already
  sufficient as-is.
- Worker-side category/certification editing from the Profile tab (stays
  a future ask if it comes up — today's ask was specifically photo +
  name).
- A dedicated customer-side "cancel this job" action from the Jobs tab —
  per CLAUDE.md, job cancellation is a worker-initiated action; customers
  only have Report a problem, unchanged by this PRD.

## 5. User flow

### 5a. Customer Jobs tab (replaces Requests + Bookings)

- Tab bar: **Home, Jobs, Messages, Profile** (four tabs instead of five —
  Requests and Bookings collapse into one).
- Header: "Jobs" title, right-aligned count ("N active") on the Active
  tab. No "agreed this month" equivalent stat on Completed — that's a
  worker earnings concept, doesn't apply to a customer paying for
  services. Completed tab just shows the date-grouped list, no header
  stat.
- Active tab: cards for `requested`/`searching`/`matched`/`accepted`/
  `on_my_way`/`arrived`/`in_progress`/`awaiting_price_confirmation` —
  i.e. anything not yet `completed`/`cancelled`/`disputed`. Card shows
  the **worker's** avatar + name (once matched — before that, show a
  neutral "Finding a worker…" placeholder state) instead of a customer
  photo, category + description, status-tone rail + pill (reusing
  `getStatusTone`/`formatJobStatusLabel`-equivalent logic), and the
  price (estimate range pre-agreement, agreed price once proposed).
  Empty state: rich empty state matching the worker Jobs tab's pattern
  ("No active jobs" + a button routing to Home to request a service).
- Tap an active-tab card → route into whichever live screen matches
  the job's current status (`Searching`/`Matched`/`JobStatus`/
  `PriceAgreement` — an equivalent of the worker app's
  `getJobsTabRoute` helper, adapted to the customer stack's screen
  names).
- Completed tab: THIS WEEK/EARLIER date grouping (same
  `groupByRecency`-style logic as the worker app), tap → new
  `JobDetailScreen` (read-only): worker identity, category, address,
  completion date/duration, final price, and — since the customer is the
  one who *gives* the rating, not receives it — either "You rated this
  worker ★★★★★" with their own comment if `job.rating` is present, or a
  "Rate this job" empty-state prompt if the job somehow reached
  `completed` without a rating yet (shouldn't normally happen given
  `PriceAgreementScreen` routes into `RatingScreen`, but the Jobs tab is
  a separate re-entry point, so handle it rather than assume).
- Cancelled/disputed jobs: included in the Completed tab (they're
  terminal states), tone-coded distinctly (reuse the worker app's
  `danger`/`neutral` tone convention).

### 5b. Profile editing (both apps)

- Profile screen gets an `Avatar` at the top (currently absent
  entirely), tappable to open the same photo-picker flow used during
  onboarding, uploading immediately via `PATCH /api/auth/profile/`
  (matches the existing onboarding UX — no separate "save" step for the
  photo, consistent with how `UploadTile`/`Avatar`'s `onPress` already
  behaves elsewhere in this codebase).
- Full name becomes an editable field (tap to edit inline, or a
  standard "Edit profile" affordance opening a small form — final call
  is an implementation-time UI decision, not a product one, since both
  are equally valid; ticket should pick one and note why).
- Worker's Profile screen keeps its existing ID-verification `Badge` row
  unchanged, just gains the avatar + name-edit above it.

## 6. Technical decisions

- **Duplicate, don't share, the jobsTab logic package.** The worker app's
  `apps/worker/src/jobsTab/*` helpers (`formatJobStatus`,
  `jobsTabGrouping`, `jobsTabRouting`, `sortJobs`) are worker-shaped:
  `getPriceCaption`/`computeAgreedTotalThisMonth` are worker-earnings
  concepts, `getJobsTabRoute` returns worker screen names. Rather than
  force a shared abstraction across the one place it's used twice (with
  real per-app differences), build an equivalent
  `apps/customer/src/jobsTab/*` with customer-appropriate versions
  (`getJobsTabRoute` returning `Searching`/`Matched`/`JobStatus`/
  `PriceAgreement` instead; no `computeAgreedTotalThisMonth` equivalent;
  `getStatusTone`/`groupByRecency`/`sortJobsNewestFirst` are likely
  copyable near-verbatim since date/tone logic isn't role-specific). If
  a third consumer of this pattern shows up later, that's the trigger to
  actually extract a shared package — not before.
- **Reuse `listMyJobs`/`getJob` as-is** (`packages/api/src/jobs.ts`) —
  already role-agnostic, already exposes `job.worker` fully. No backend
  or `@prizm/api` changes needed for the Jobs tab.
- **No backend changes for profile editing** — `PATCH /api/auth/profile/`
  already does exactly what's needed. This ticket is purely
  `apps/worker/src/screens/ProfileScreen.tsx` +
  `apps/customer/src/screens/ProfileScreen.tsx` + whatever small shared
  edit-form UI is worth factoring into `@prizm/ui` if the two
  implementations end up identical (likely, since both screens are
  already near-identical in shape).
- **Tab count changes from 5 to 4 on the customer app** (`RootTabs.tsx`):
  delete `RequestsScreen.tsx`/`BookingsScreen.tsx` entirely rather than
  leaving dead files around, per this codebase's "don't leave
  half-finished/unused code" convention.

## 7. Testing strategy

Consistent with `worker-active-job-flow`'s established approach:
`jest-expo` + `@testing-library/react-native`, scoped to **logic**, not
full-screen rendering.

- `apps/customer/src/jobsTab/*`: same test shape as the worker
  equivalents — `sortJobsNewestFirst`, `groupByRecency`,
  `getJobsTabRoute` (all status → route mappings), `getStatusTone`,
  `formatJobCardDate`. Copy the worker test suites as a starting point
  where the underlying logic is identical; write fresh cases anywhere
  the customer-specific behavior (rating-given vs rating-received, no
  earnings stat) diverges.
- No new backend tests expected — `listMyJobs`/`getJob`/`PATCH profile`
  are all already covered by existing backend test suites and unchanged
  by this PRD. If the ticket breakdown turns up any actual backend gap
  during implementation, add a test for that specifically at that point.

## 8. Acceptance criteria (summary — full detail in tickets)

- Customer app has 4 tabs (Home, Jobs, Messages, Profile); Requests/
  Bookings placeholders are gone.
- From Home, submitting a request and having it matched/accepted is
  visible under the Jobs tab's Active section, and tapping it routes
  back into live tracking (closing the "can't get back into an active
  job" gap this PRD exists to fix).
- A completed job appears under Jobs → Completed, dated correctly, and
  its detail screen shows the worker's identity, the final price, and
  the rating the customer gave.
- Both apps' Profile screens show an avatar and support changing the
  photo and full name, persisted via the existing `PATCH` endpoint and
  visible on next app load (not just optimistic local state).

## 9. Open risks / follow-ups

- No hi-fi mockup exists yet for the customer Jobs tab or its detail
  screen (unlike the worker app, where two rounds of mockup review drove
  the design). This PRD's flow section is a reasoned adaptation of the
  worker pattern, not a pixel spec — worth a quick visual gut-check with
  the user once built, same as the worker Jobs tab got, before
  considering it final.
- "Finding a worker…" placeholder state for a `requested`/`searching`
  job card (before a worker photo exists to show) needs an actual
  visual — not specified beyond "neutral placeholder" here.
- The inline-edit vs. separate-edit-form UI choice for full name is
  deferred to implementation time (noted above) — flag it for a quick
  confirmation once a first pass exists, rather than guessing and
  rebuilding.
