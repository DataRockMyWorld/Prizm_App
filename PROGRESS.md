# Prism — Progress & Resume Notes

Last updated: 2026-09-08. See `CLAUDE.md` for full project context, brand,
and business rules — this file just tracks build status and how to pick
the work back up.

## Where things stand vs. the CLAUDE.md build order

| # | Step | Status |
|---|------|--------|
| 1 | Django project + core models + PostGIS | ✅ Done |
| 2 | Auth endpoints (phone/OTP/PIN, JWT) | ✅ Done |
| 3 | Django admin review queue (ID + certification) | ✅ Done |
| 4 | Job lifecycle API + matching logic | ✅ Done |
| 5 | Expo monorepo scaffold | ✅ Done |
| 6 | Auth screens → wire to API | ✅ Done, both apps — confirmed live on a physical iPhone |
| 7 | Customer request flow → wire to API | ✅ Done, click-tested end-to-end on a physical iPhone (submission → matched → tracking → price agreement → rating), worker side simulated via Django shell |
| 8 | Worker active-job flow → wire to API | ✅ Rebuilt to v2 (2026-09-08/10) — price agreed on-site before work, `declined` exit, no post-work price step. `docs/prds/active-job-flow-v2.md` + `docs/tickets/active-job-flow-v2.md` T1–T10 done on branch `active-job-flow-v2` (not merged). One v2.1 follow-up open (customer completion confirmation). |
| 9 | Chat (polling) | ✅ Done, core send/receive confirmed live on a physical phone (2026-08-24) — see `docs/prds/chat.md` / `docs/tickets/chat.md`, all tickets T1–T5 complete |
| 10 | Mobile money payment | ⬜ Deliberately skipped for now — revisit later, see below |
| 11 | Push notifications | ⏸️ Backend + T4 done (T1–T4), paused on an Apple Developer Program blocker — see below |
| 12 | Device testing / pilot rollout | ✅ iPhone (native dev-client) + ✅ Android emulator (2026-08-30, see below) |

Beyond the original build order, two follow-up PRD/ticket rounds are done:
- `docs/prds/customer-jobs-tab-and-profile-editing.md` /
  `docs/tickets/customer-jobs-tab-and-profile-editing.md` — T1 (customer
  jobsTab logic), T2 (customer Jobs tab list + detail, replacing the old
  Requests/Bookings placeholders), and T3 (photo + name editing on both
  apps' Profile screens) are all done and committed.
- `docs/prds/profile-redesign.md` / `docs/tickets/profile-redesign.md` —
  the fuller hi-fi Profile redesign (gradient hero, badges, rating, stats,
  Services-offered editor, Certifications list, Saved addresses CRUD).
  All 7 tickets (T1–T7) done and committed.
- `docs/prds/chat-safety.md` / `docs/tickets/chat-safety.md` (2026-08-30)
  — report-message / report-user / block-user, closing out
  `app-store-readiness`'s previously-blocked T6 (Apple Guideline 1.2 chat
  safety requirement). New `Block` model (account-wide, checked in both
  directions by the matching engine) + 4 new chat-abuse `Report`
  categories + a nullable per-message FK on `Report`, `BlockCounterpartView`
  (terminal-job-only, target always server-derived from the job), and a
  `ReportChatScreen` + header overflow menu + per-message long-press in
  both apps. All 5 tickets (T1–T5) done and committed; backend 131/131,
  worker 58/58, customer 42/42 at the time.

This also completes build-order step 9 itself:
`docs/prds/chat.md` / `docs/tickets/chat.md` — per-job chat thread, both
apps' entry points (worker's `ActiveJobScreen` chat button, customer's
`JobStatusScreen` chat icon) now real instead of fake/broken, plus a real
inbox on the customer's Messages tab. All 5 tickets (T1–T5) done and
committed — see "What's actually built" below and "Immediate next steps"
for the still-outstanding live click-test (this round included; nothing
built across either of these two PRDs has been tapped through on a real
device/simulator yet).

## What's actually built

**Backend** (`backend/`, Django + DRF, runs via `docker compose up -d` from
repo root): full data model, phone/OTP/PIN auth with JWT, a Django admin
review queue for worker ID + certification approval, and the full job
lifecycle API (create → sequential single-offer matching with
Verified/Certified priority → accept/decline offer → status stepper →
price confirm/dispute → rate). MinIO (S3-compatible) for file storage,
CORS enabled for local dev. `ProfileView`/`ProfileSerializer` already
supports `PATCH` for `full_name`/`photo`/`biometric_enabled`.
`WorkerProfileSerializer` supports `PATCH` for `categories` (used by the
worker Profile tab's Services-offered editor) and now also exposes
computed `jobs_completed`/`rating_average`; a new `CustomerProfileView`
(`/api/auth/customer-profile/`) exposes `requests_completed`; a new
`Address` model + CRUD API (`/api/auth/addresses/`) backs Saved
addresses — all added in `profile-redesign` T1/T2. The `Message` model
(job, sender, text — pre-seeded in the original data model but unwired
until now) has a real scoped list/create API at
`/api/jobs/<id>/messages/` (`chat` T1), gated on a worker being assigned
and the job not yet being terminal; `JobRequestSerializer` gained
`last_message` to power the customer inbox without a second endpoint.
`ServiceCategoryListView` (`/api/services/categories/`) exists for
category pickers. Four seeded categories now (was three): Cleaning,
Plumbing, Electrical, and **Gardening** (added 2026-08-26, N$150–350
estimate — `backend/services/migrations/0003_seed_gardening.py`).

**Shared packages** (`packages/`):
- `@prizm/ui` — design tokens (brand gradient, Manrope type, spacing) and
  primitives (Button, Card, TextField, OtpInput, PinDots, Avatar,
  UploadTile, BrandHeader, SplashView, Badge, **ProfileHeader** — avatar +
  inline name editing, shared by both apps' Profile screens, plus an
  `inverse` prop (added in `profile-redesign` T3) for use atop a dark/
  gradient background — **StatCard** and **ProfileHero** (also T3, the
  worker/customer Profile heroes) — etc.), including the real Prism logo.
  `pageBackground` color token is `Screen`'s default background — a shade
  darker than white so `Card`s (still pure white) have visible contrast.
- `@prizm/api` — fetch client, `SecureStore`-backed auth session, typed
  functions for every backend endpoint. `getApiUrl()` (`client.ts`) now
  treats a `localhost`/`127.0.0.1` Metro dev-server host as untrustworthy
  (happens when a device connects via `expo run:ios --device` over USB)
  and falls back to `EXPO_PUBLIC_API_URL` instead — see Environment
  gotchas below.
- `@prizm/auth-flow` — the shared phone → OTP → PIN → biometric → profile
  onboarding screens, used identically by both apps.

**apps/worker**: full onboarding, Home, **ID upload — now front + back**
(2026-08-26, live-tested — `WorkerProfile.id_document_back` added
alongside the existing `id_document`; both required to submit; each
tile offers a "Take Photo" / "Choose from Library" action sheet via
`expo-image-picker`'s `launchCameraAsync`/`launchImageLibraryAsync`,
this app's first real camera usage; a tips card above Submit gives
photo-quality guidance — matches a hi-fi mockup) → certifications →
under-review flow, full active-job flow (incoming offer → accept/decline
→ on-my-way/arrived/in-progress → mark complete → propose price → wait
for confirmation → done), a redesigned **Jobs tab** (Active/Completed,
colored status rails, date grouping, tap into either the live screen or
a read-only Job Record detail screen), and a redesigned **Profile**
(gradient hero with photo/name/categories/Verified+Certified
badges/rating+jobs-completed, 2-stat card, editable Services-offered
chips (Certified badges only show for categories still in Services
offered — a certification for a dropped service stays on file but isn't
badged in the hero), Certifications list with a working add flow
reachable from the Profile tab now too — not just onboarding), and an
**Account section** (Payout method / Notification preferences → shared
`ComingSoonScreen`, since no payment/push infra exists yet; Help &
support and Safety tips → real static-content screens; Terms & liability
→ reuses the onboarding liability text + `liability_acknowledged_at`).
`ActiveJobScreen`'s chat button now opens a real per-job chat screen
(poll-refreshed) instead of an "coming soon" alert. 5-tab bar (Home/Jobs/
Bookings/Earnings/Profile; Bookings/Earnings are still placeholders —
not real product concepts yet, see CLAUDE.md's dropped-scope notes).
**All of Profile (hero, stats, Services-offered editor, Certifications,
Account section) has now been live-tested and iterated on a physical
phone** through several rounds — see git log for the specific spacing/
padding/component fixes that came out of that (hero-to-stat-card overlap
covering text, StatCard font size, section labels moved outside their
cards to match the hi-fi mockup, Log out redesigned from a standalone
button to an Account list row, a `Card`-padding mixup that left the new
Account rows with no left/right inset).

**ID upload (front + back) is now fully confirmed live end-to-end**
(2026-08-27) — the crop/retake/scroll/tile-sizing bug-fix cycle described
in past versions of this file is resolved and verified on a physical
phone; a real OTP round-trip, ID submission, and `id_status` transition to
`pending` were all confirmed via the backend logs/DB during the session.
Off the back of that, the **Home and Jobs tab "awaiting verification"
states were redesigned to match hi-fi wireframes** the user shared mid-
session: `HomeScreen`'s "under review" banner is now a plain, non-tappable
card (was wrapped in a `Pressable` that reopened the ID-upload form even
while pending — a real bug); the "Jobs browsable now — accepting unlocks
once verified" hint is now a persistent footer below the nearby-jobs list
instead of only appearing when that list is empty; "Jobs near you" rows
are now tappable, opening a new **`JobPreviewScreen`** (read-only —
matches the "Job preview (unverified · read-only)" wireframe; no accept/
decline action, since CLAUDE.md's matching model is sequential single-
offer, not browse-and-choose, so this list is informational only
regardless of verification status). `JobsScreen`'s Active-tab empty state
now has the equivalent unverified branch (`UnverifiedActiveState`),
copy-matched to Home's banner so the two tabs never disagree. A real
stale-state bug also got fixed here: `HomeScreen` only fetched
`id_status`/categories on mount (`useEffect`), so returning from the
ID-upload/Certifications/UnderReview flow (pushed on the same nav stack as
the tabs, not a separate stack) never re-fetched — switched to
`useFocusEffect`, matching the pattern `JobsScreen`/`ProfileScreen`/
`MessagesScreen` already used.

Also fixed this round, both product-decision-driven: (1) the verified
Home greeting now uses just the worker's **first name** ("Hello, Jewel
👋"), not full name; (2) every "pending" status icon that had been a
spinning `ActivityIndicator` (Home's banner, Jobs tab's under-review card
and empty state, `JobPreviewScreen`'s verification hint) is now a static
⏳ — a live spinner implies active loading, which is misleading for a
fixed status that isn't going to resolve on its own.

**A systemic dead-styling bug was found and swept across both apps**
(2026-08-27): `ThemedText` (`packages/ui`) hardcodes a specific Manrope
font-family file per `variant` (e.g. `Manrope_700Bold` for `title`), and
React Native silently ignores `fontWeight` once a specific `fontFamily` is
already set — so any `style={{ fontWeight: "700" }}` passed into a
`ThemedText` (or into the shared `TextField`, which has the same
hardcoded-`fontFamily` pattern internally) never actually rendered bold.
First caught on the Jobs tab's "Browse jobs near you" link and both apps'
Profile section labels ("SERVICES OFFERED" etc.), then swept
comprehensively: **29 instances fixed across 18 files** (both apps' Job/
ActiveJob/IncomingOffer/HelpSupport/ProposePrice/RequestSubmission/
MatchedScreen/PriceAgreement screens, plus the shared
`packages/ui/ProfileHeader.tsx`) — every match turned out to be real, none
were false positives. Fix pattern: replace `fontWeight: "N"` with
`fontFamily: fontFamily.<token>` (`bold`/`semiBold`/`extraBold` per
weight) from `@prizm/ui`'s typography tokens. Both apps typecheck clean
and full test suites pass post-sweep (worker 58/58, customer 42/42) —
worth a fresh visual scan on a physical device next session since this
touched text weight broadly, not just the screens being actively worked
on.

**`expo-dev-client` is now installed in both apps** (2026-08-27) — see
"Physical iPhone builds" below; this replaces the previous "no
expo-dev-client" gotcha and its workarounds.

**apps/customer**: full onboarding, a redesigned **Home** screen (2026-08-26,
went through two design rounds live with the user — landed on a calmer
"catalogue" card style over the first full-bleed-photo attempt: first name
only in the greeting, a "BROWSE SERVICES / See all" section header below a
divider, then Cleaning/Plumbing/Electrical/Gardening as 2-column cards —
photo on top (4:3, custom-cropped per category to keep the worker's
face/hands in frame), category name on a plain white card body below
(font size reduced from a follow-up round of live feedback — was
reading too large), matching a hi-fi mockup closely; search bar still
decorative). Also fixed the same day: **"Request a Service" (generic,
no pre-picked category) now shows a "Choose a service" picker list**
instead of silently defaulting to Cleaning — `RequestSubmissionScreen`
no longer auto-selects `categories[0]` when it arrives with no
`categoryId`; the "Change" link (which used to just `navigation.
goBack()` to Home, discarding whatever the customer had already typed)
now resets to that same in-place picker instead. Tapping a specific
Home card still skips the picker and goes straight to the form, as
before. The full request flow (submission → searching/
matching → matched → job status tracking → report-a-problem → price
agreement → rating, with a back button on the tracking screen now, and a
"Use a saved address" picker on the submission screen), a **Jobs tab**
(replaces the old Requests/Bookings placeholders — same Active/Completed
pattern as the worker app, adapted: cards show the assigned worker's
identity, no earnings-style stat, rating framed as what the customer
gave), and a redesigned **Profile** (calm hero with photo/name/member-
since, 2-stat card, full CRUD **Saved addresses**, and the same **Account
section** pattern as the worker app — Payment method/Notification
preferences → `ComingSoonScreen`, Help & support/Safety tips → real
content, Terms & liability → real liability text + acceptance date).
`JobStatusScreen`'s chat icon (previously not even wired to a press
handler) now opens the same real chat screen the worker side uses; the
**Messages tab is a real inbox now** — every job with an assigned
worker, most-recently-active first, last-message preview, tap into the
thread. 4-tab bar (Home/Jobs/Messages/Profile). **Profile has been
live-tested and iterated on a physical phone through several rounds**,
same as the worker app's — see git log for specifics.

**Customer Home screen realigned with the approved hi-fi (2026-08-30)** —
live-tested on both a physical iPhone and the Android emulator. Browse
Services now sits in its own subtly-tinted rounded section (`colors.
surfaceMuted`), distinct from the greeting/search area above and
whatever's below; real spacing between the greeting/subtitle/search bar
(was fighting itself with a negative margin). The category grid is now
the approved 4-across compact circular thumbnail row instead of 2-column
rectangular image cards — the initial cut had a `Math.round` sizing bug
that wrapped the 4th tile to its own row, fixed via `Math.floor`. A
stray `ServiceCategory` row ("Category 0", id 6, not seeded by any
migration, zero real dependents) was leftover local-dev DB junk, not a
code bug — deleted directly. **Search bar is now real**: a live
client-side filter (`apps/customer/src/home/filterCategories.ts`, unit
tested) against category names — no backend endpoint, deliberately,
since the catalog is a handful of static categories; shows a "No
services match" empty state rather than going blank. Also fixed: the
search field had no way to blur/dismiss the keyboard on this
non-scrolling screen (confirmed live — cursor stayed put indefinitely)
— tapping anywhere outside the field, or the keyboard's return key, now
calls `Keyboard.dismiss()`. Bottom-nav mismatch (wireframe's 3 tabs vs.
the built 4) flagged by the user as a known, deliberately-untouched
open item for a future pass.

**Customer `RequestSubmissionScreen` Ticket 1 in progress, awaiting
live confirmation (2026-08-30)** — realigned with the approved hi-fi:
added the missing hatched map placeholder + centered orange pin
(a tiny tileable diagonal-stripe PNG generated locally + `Image
resizeMode="repeat"`, and a single-`View` CSS-style teardrop pin — no
new native dependency), bolded the "Request a service" heading, and
reworked the 5 form sections (category chip/description/location/
photo/price) into a `flex:1` + `justifyContent:"space-evenly"`
container so they distribute down the full screen instead of clustering
near the top with Submit Request stranded below a dead gap. Also added
a warm orange-tinted shadow/glow to `packages/ui`'s shared `Button`
primary variant (previously had zero shadow styling anywhere) — fixed
at the component level, not just this screen, so it's already consistent
for Ticket 2 (Searching/Matched screens, not yet started). One
investigation result worth remembering: **the gear/settings icon
visible top-right on every screen (including the pre-login phone-number
screen) is the Expo Dev Client menu-launcher overlay** (`expo-dev-
client` is a real dependency; zero gear/settings code anywhere in
either app; Android's accessibility tree labels it `content-desc=
"Tools"`) — it is not part of Prism's own UI, nothing to fix in code,
and it won't exist in a production/store build. Backend/mobile suites
all still green after these changes (backend 131/131, worker 58/58,
customer 48/48) and both bundles compile — **but the visual result
itself has not yet been confirmed via a live screenshot**, so treat
Ticket 1 as implemented-but-unverified, and don't start Ticket 2 (the
PRD explicitly gates it on Ticket 1 confirmation) until that happens.
**Ticket 1 was later confirmed live** (2026-09-03) — Ticket 2 (Searching
+ Matched screens vs. hi-fi) is still not started, see "Immediate next
steps" below.

**Global keyboard-dismiss fix (2026-09-03)** — the shared `Screen`
component (`packages/ui/src/components/Screen.tsx`) now wraps its
content in a `Pressable` that calls `Keyboard.dismiss()` on any tap not
already claimed by a nested touchable (RN's responder system resolves to
the innermost touchable first, so this only fires on genuinely "empty"
taps). Before this, tapping outside a focused text field did nothing on
*any* screen in either app — first found on the customer
`RequestSubmissionScreen`'s description field, but it was a systemic gap
in the shared component, not a per-screen bug, so the fix went in once at
that level instead of per-screen. `HomeScreen`'s prior one-off local
version of the same fix (a `Pressable` wrapper it had grown for its
search bar) was removed as redundant.

**A real end-to-end run through the entire app, registration to a closed
job, on both apps at once (2026-09-03/04)** — worker on the iOS
Simulator (iPhone 17 Pro), customer on the physical iPhone, with Claude
driving the worker side via direct REST calls (registered, ID-approved,
and put a test worker online via the API, then accepted/progressed/
completed jobs with `curl` — no XCUITest/Appium automation exists in this
environment, so this was the only way to keep pace with the 60-second
offer-response window from outside the UI). This surfaced and fixed
several real, previously-latent bugs:
- **PIN/OTP entry was effectively unusable on a full-size Simulator
  screen** — `PinEntry` (`packages/auth-flow/src/components/PinEntry.tsx`)
  and `OtpInput` (`packages/ui/src/components/OtpInput.tsx`) both drive a
  hidden 1×1/opacity-0 `TextInput` from a `Pressable` wrapping just the
  visible dots/boxes — a small target (~150×32px) on a screen with a lot
  of empty space around it, so a tap landing even slightly outside it
  silently did nothing (no error, no keyboard). Confirmed by direct
  `cliclick` automation (macOS Accessibility permission granted
  mid-session) that a precisely-aimed click worked fine — the code was
  never actually broken, the hit target just needed to be more forgiving.
  Fixed with a generous `hitSlop` on both (`{top:24, bottom:24, left:40,
  right:40}`). `PinEntry` also had `secureTextEntry` removed — harmless
  either way since the field is already invisible and `PinDots` is the
  only thing that ever renders the digits, but not the actual fix.
- **The customer Matched screen's "Confirm & Continue" button did
  nothing except navigate locally** — no server call, and if a customer
  never tapped it, they'd stay stuck on "You've been matched!" forever
  even as the job progressed in the background (the screen's own poll
  only ever redirected away for a job *disappearing* — searching/
  cancelled — never for one moving forward). Per user decision, this is
  now a transient beat: auto-advances to `JobStatus` after 3s
  (`AUTO_ADVANCE_MS`), no button, with a small "Taking you to your job…"
  spinner instead.
- **Rating stars were invisible** (`apps/customer/src/screens/request/
  RatingScreen.tsx`) — the unfilled-star color was `colors.border`
  (`#ECE7E2`) against `colors.pageBackground` (`#F1ECE7`), the same
  near-zero-contrast bug already fixed once for `PinDots` back on
  2026-08-26. Changed to `colors.textSecondary`, plus a bigger `hitSlop`
  on each star. This exact bug (an icon/border colored `colors.border`
  against `colors.pageBackground`) turned out to be **systemic** — also
  found and fixed the same way in the job-status timeline's pending-step
  dots, and in `StatCard`'s/`SettingsRow`'s/the Profile address-row's
  divider lines (see below). Worth grepping for `colors.border` used as a
  `borderColor`/`backgroundColor` directly on a screen if this pattern
  turns up again.
- **Stale/abandoned test jobs got resurrected mid-session** — setting a
  worker online + located (`WorkerStatusView`'s PATCH) triggers
  `rematch_nearby_jobs_for_worker`, which sweeps *all* still-`searching`/
  `matched` jobs in range, including weeks-old abandoned test jobs from
  earlier sessions. Not a bug — `try_match`/`refresh_job_matching` working
  exactly as designed — but worth knowing this can happen again in this
  same dev database; the fix each time was just cancelling the stale jobs
  and setting old leftover test-worker accounts offline.

Both a **dispute-path job** (customer disputed the worker's proposed
price via "Report a problem → Pricing disagreement" — confirmed it
correctly creates a `Report(category=pricing_disagreement)` and flips the
job to `disputed`, a real terminal state routed to manual admin review,
not an automated bot, matching CLAUDE.md) and a **full happy-path job**
(price confirmed → completed → 5-star rating) were run end-to-end and
confirmed working.

**Job status screen redesign, against a Claude Design hi-fi
(2026-09-04)** — `apps/customer/src/screens/request/JobStatusScreen.tsx`
rebuilt from a plain 4-step stepper into the approved design: a full
brand-gradient hero with a dynamic headline (`"<worker's first name> is
on the way"` etc., one string per status), a status pill, and an "N OF 6"
step-count circle; a worker card floating over the hero's rounded bottom
edge (photo, name, category, rating, jobs-completed count); an expanded
6-row vertical timeline (Requested/Accepted/On my way/Arrived/Job
started/Complete — previously on_my_way/arrived/in_progress collapsed
into one vague "In progress" row) where each reached step shows its own
timestamp and the most-recently-reached one gets a glowing accent ring;
and an Estimate + Address card. The hi-fi's "Cancel job" footer link was
deliberately dropped — customer-side cancellation is only ever valid
while a job is still `searching`/`matched` (`JobCancelView`,
`backend/jobs/views.py`), so on this screen (reached only once a job is
already accepted) it would 400 every time; "Report a problem" is the only
real action left there, matching what the app already did before this
redesign.

Needed one real backend change, not just a frontend reskin: `JobRequest`
gained `on_my_way_at`/`arrived_at`/`started_at` (`accepted_at` already
existed) so each timeline step can show *when* it happened, not just
that it happened — the three worker-transition views
(`_WorkerJobTransitionView` and its `OnMyWayView`/`ArrivedView`/
`StartJobView` subclasses in `backend/jobs/views.py`) now stamp the
matching field via a new `timestamp_field` class attribute. Also added
`jobs_completed` to `WorkerPublicSerializer` for the worker card's "· N
jobs" caption. Migration
`backend/jobs/migrations/0007_jobrequest_arrived_at_jobrequest_on_my_way_at_and_more.py`.
5 new backend tests (`jobs/tests/test_active_job_transitions.py`); new
`apps/customer/src/request/formatClockTime.ts` (+ test) for the
"2:08 PM"-style timestamps.

Live-testing this surfaced one more real bug, the same class as the
Matched-screen one: the step-highlighting logic originally lit up the
*next expected* step rather than the one that had actually happened (an
old holdover from the previous 4-step design, where that read fine for a
vague "In progress" bucket but is actively misleading for a literal
action label — "On my way" glowing while the worker was still just
sitting on `accepted`, before they'd moved at all). Fixed by rewriting
`reachedStepIndex` to mark the *most recently reached* step instead —
confirmed correct against all 6 states with a real device retest.

**Customer Messages tab now uses a middle ground, not "every job with a
worker" (2026-09-04)** — per user decision after noticing a message
"card" for every single job regardless of whether any conversation ever
happened: `apps/customer/src/screens/MessagesScreen.tsx` now always shows
active jobs (so there's a predictable way to reach a worker you're
currently mid-job with, even before either party has said anything) but
only shows a *completed* job's thread if it actually has message history
(`job.last_message !== null`), reusing the existing `isActiveJobStatus`
helper. Deliberately not "only jobs with real messages" outright — that
would make the tab undiscoverable for an active job with nothing said
yet.

**Jobs tab pagination, both apps (2026-09-04)** — prompted by a "how do
we control the Completed list as it grows" discussion (conclusion: no
delete button — a completed job is a transaction/audit record, matching
the same retention principle CLAUDE.md's account-deletion section
already establishes for financial records; This-week/Earlier grouping
already existed; the real gap was that `GET /api/jobs/` had **no
pagination at all**, ever returning a caller's entire job history in one
response). `JobRequestListCreateView.get()`
(`backend/jobs/views.py`) gained two opt-in, fully-backward-compatible
query params — a bare `GET /api/jobs/` with no params is byte-for-byte
unchanged, since several other call sites (the account-deletion
blocking-job check, the Messages tab above) need the complete
unfiltered history and must keep working exactly as before:
- `status_group=active|completed` — server-side filter reusing the
  existing `JobRequest.TERMINAL_STATUSES` constant.
- `page=<n>` (+ optional `page_size`) — switches to DRF's standard
  paginated response shape via a new `JobsPagination` class
  (`page_size=20, max=50`).

Both apps' `JobsScreen.tsx` rewritten: Active tab now fetches via the new
`listActiveJobs()` (still one unpaginated call — active jobs are always a
small working set in practice) rendered in a plain `ScrollView`;
Completed tab fetches via new `listCompletedJobsPage()` a page at a time
through a real `SectionList` with `onEndReached` infinite scroll,
re-grouped into This-week/Earlier as pages accumulate. **Drive-by fix**:
neither Jobs tab had a scroll container at all before this — jobs were
just `.map()`'d into plain `View`s directly inside `Screen`'s content, so
a list longer than one screen would have been silently clipped with no
way to reach the rest; not something the small amount of test data in
this project had ever surfaced before. The worker Jobs tab's "N$X agreed
this month" header stat deliberately still sources from a full
unpaginated `listMyJobs()` call, kept separate from the paginated
rendered list — that total needs the *whole* month's data to stay
correct, and would have silently undercounted once history exceeds one
page. 6 new backend tests
(`jobs/tests/test_job_list_pagination.py`). Not yet visually confirmed
with a long list (this project's test accounts only have 2–3 completed
jobs total, so infinite scroll never actually triggers) — the plumbing
is real and tested, but nobody has watched it fire live yet.

**Customer Profile screen — a second, more detailed hi-fi-matching pass
(2026-09-04)**, on top of the redesign described earlier in this file:
narrower cards/buttons (screen's own horizontal padding `spacing.md` →
`spacing.lg`, local to this screen only); a real bug in `StatCard`
(`packages/ui/src/components/StatCard.tsx`) where centering each stat
cell as a whole block meant a cell whose label wrapped to two lines
(`"Requests completed"`, at the new narrower width) came out taller, and
block-centering that taller cell pushed its value up relative to the
other cell's — fixed by anchoring both cells to `flex-start` instead, so
values always land at the same height regardless of label length; a
second `StatCard` bug where a wrapped label had no `textAlign: "center"`,
so React Native left-aligned each wrapped line individually even inside
a centered container; a bigger gap between the hero and the stats card
(`marginTop: spacing.sm` → `spacing.lg`); stronger card borders/shadows
(`definedCard`: width 1→1.5, a darker `#D9CEC0`, more shadow); and — the
same low-contrast-divider bug found earlier this session — three
separator lines (`StatCard`'s internal vertical divider, the saved-
address row dividers, `SettingsRow`'s account-row dividers) recolored
from `colors.border` to `colors.textSecondary`. `StatCard` and
`SettingsRow` are shared components, so the alignment/divider fixes also
reach the worker Profile screen's equivalent elements.

Test counts after all of the above: backend 142/142, worker 58/58,
customer 50/50 (later 54/54 once the android-bugfixes tickets below were
implemented). Both apps typecheck clean throughout.

## Physical iPhone builds — working

Both apps run as native dev-client builds on a physical iPhone (in
addition to the iOS Simulator, which is also still used for quick
checks). See "One-time setup" below (unchanged from before) for the
Xcode/CocoaPods/Ruby setup this required.

**`expo-dev-client` is installed in both apps as of 2026-08-27** (added
via `npx expo install expo-dev-client` + a full native rebuild — see
git log). Before this, neither app had it (confirmed absent multiple
times in earlier sessions), which meant a bare cold relaunch (force-quit
→ reopen from the home-screen icon, or `xcrun simctl launch` on
Simulator) had no way to rediscover Metro's URL and crashed with "No
script URL provided" — the app could *only* be launched through
`expo run:ios`/Xcode each time. With `expo-dev-client` now in place, a
cold relaunch instead shows a proper launcher screen (Bonjour
auto-discovery of dev servers, or "Enter URL manually") rather than
hard-crashing — much more resilient, though see the Wi-Fi gotcha below
for the one real failure mode hit so far.

**Two ways to connect the phone, and gotchas specific to each:**
- **LAN/Wi-Fi** (`npx expo start --dev-client -c`, phone on the same
  Wi-Fi network): `getApiUrl()` correctly derives the backend host from
  Metro's own LAN IP. No `.env` changes needed for API calls specifically,
  but the dev-client launcher's manual URL entry still needs the current
  LAN IP (`<mac-lan-ip>:8081`) if Bonjour auto-discovery doesn't find it.
  **Real gotcha hit 2026-08-27, easy to misdiagnose as ordinary IP
  drift**: the Mac was actually connected to a *different Wi-Fi network*
  than the phone (not just a stale IP on the same network) — symptom was
  "server rejected the connection" / connection-refused on manual dev-
  client URL entry, and even a plain Safari page load to the Mac's LAN IP
  from the phone failed, while the Mac could `curl` itself fine on that
  same IP. Confirmed macOS firewall was disabled (not the cause) before
  realizing it was a genuinely different network. **If Wi-Fi connectivity
  between phone and Mac ever fully fails (not just wrong-but-reachable
  IP), check both devices are on the literal same Wi-Fi network before
  assuming it's the usual DHCP-drift IP problem** — the fix there is
  reconnecting the Mac to the right network, not more `.env` edits.
- **USB via Xcode** (`npx expo run:ios --device`, or reopening an
  already-installed dev client that was last connected this way): Metro
  gets tunneled through USB and reports itself as `localhost` to the JS
  runtime — that tunnel only forwards Metro's own port, not the Django
  backend's, so **every API call silently points at the phone itself**
  unless `EXPO_PUBLIC_API_URL` is set. Fixed two ways together: (1)
  `getApiUrl()` now distrusts a `localhost`/`127.0.0.1` dev-server host
  and falls back to the env var, (2) both apps' `.env` have
  `EXPO_PUBLIC_API_URL=http://<this Mac's current LAN IP>:8000`
  uncommented — **keep that IP in sync with `ipconfig getifaddr en0`** if
  it ever changes (DHCP drift bit this project before, repeatedly — see
  "LAN IP drift" below, which got worse this session: it drifted three
  more times in a single afternoon). Also note: installing/launching over
  USB still needs the phone **unlocked**, or `expo run:ios`'s install
  step succeeds but the launch step fails with `CommandError: Cannot
  launch ... because the device is locked` (confirmed 2026-08-27) — just
  unlock and rerun the same command, no rebuild needed.

**To (re)install after a fresh clone or a native-code change:**
```
cd apps/worker && npx expo run:ios --device      # or apps/customer
```
**To just restart Metro for a build already installed on the phone:**
```
cd apps/worker && npx expo start --dev-client -c
```

## Android — emulator set up + full test pass (2026-08-30)

Dev environment built from scratch (Homebrew, OpenJDK 21, Android
command-line tools, Android Studio, `Prizm_Test_Emulator` AVD —
Pixel 7 / API 34 / arm64). Both apps build & install via
`npx expo run:android`. Full job lifecycle click-tested end-to-end on
the emulator (request → match → accept → status stepper → propose price
→ confirm → complete → 5★ rate), same coverage as the iOS pass.

**Setup gotchas worth knowing before redoing this:**
- `adb emu geo fix` / NMEA injection **does not work** on this
  `google_apis` system image — Fused Location Provider never sees it
  (confirmed via `dumpsys location`). No fix found; real GPS-dependent
  screens can't be exercised on this emulator. Don't burn time retrying
  this — go straight to seeding jobs via the API instead (see below).
- Free/cold Gradle downloads from Google's Maven were badly throttled
  this session (Android Studio DMG + SDK system image both crawled,
  10-70+ min each) — not a config problem, just budget real time.
- Two Metro servers running side-by-side (worker :8081, customer other
  port) means `expo run:android`/a relaunched dev-client can silently
  connect to the *wrong* app's bundle if it reuses whatever's on :8081 —
  always check the dev-menu banner's app name after a relaunch, don't
  assume it's serving the app whose icon you tapped.
- To drive the UI headlessly: `adb shell uiautomator dump` +
  grep for real element `bounds` — screenshots plus eyeballed
  coordinates are unreliable for anything but large buttons (verify
  every ~20% miss rate on smaller targets like checkboxes).
- To advance a job past a step without racing the 60s offer window or
  real GPS: call the real REST API directly (`/api/jobs/`, `/api/jobs/
  offers/<id>/accept/`, etc.) with a token from `POST /api/auth/login/`
  — exercises the real matching/accept logic without the UI dependency.

### Bugs found this session — need tickets

1. **Location has no working manual fallback** (`apps/customer/src/
   screens/request/RequestSubmissionScreen.tsx` and `AddressFormScreen.tsx`).
   Both require `coords` (real GPS) to enable Submit/Save — the "enter
   your address manually" UI shown on GPS failure never geocodes, so
   `coords` stays `null` forever and the button never enables. Not
   Android-specific (would hit iOS too under poor GPS/indoors), just
   surfaced here because the emulator has no working GPS. **Fix**: geocode
   the manually-typed address (`Location.geocodeAsync` or a backend
   geocoding call) before enabling submit.
2. **Customer `JobsScreen.tsx` swallows all fetch errors silently**
   (`catch { setJobs([]); }`) — an expired access token (30-min lifetime,
   already-known no-mid-session-refresh gap, see Environment gotchas)
   makes the Jobs tab show a misleading "No active jobs" instead of an
   error or a refresh attempt. Fully reproduced: confirmed 6 real jobs
   existed server-side while the tab showed 0; a plain app relaunch
   (fresh token) fixed it instantly. **Fix**: either add a 401→refresh→
   retry interceptor to `apiRequest` (packages/api/src/client.ts,
   would fix this app-wide) or at minimum show a real error state here
   instead of an empty one. Check other screens with the same silent-
   catch pattern (e.g. `ProfileScreen.tsx`) once this is scoped.

**Lower-priority / not reproduced twice, keep an eye out:**
- Worker's `DeleteAccountPinScreen` once showed 4 filled PIN dots with
  no corresponding typed input and no `login()` call reaching the
  backend (checked via logs). Only happened once, no functional impact
  observed (no bad submission went through). Possibly an Android
  autofill-session interaction (`AutofillInlineSuggestionsRequestSession`
  activity was visible in logcat around the same time), but
  `hasSuggestionToShow=false` each time — inconclusive, not a confirmed
  bug.

## Environment gotchas (read before resuming)

- **Development happens from Ghana, not Namibia** — the pilot's real
  target market is still Namibia only (per CLAUDE.md; this hasn't
  changed), but the developer is physically in Ghana. Anything that
  depends on real device GPS will naturally produce Ghana coordinates,
  not Namibia ones — this already caused one real bug (see the
  android-bugfixes ticket's T1 follow-up) where manual-address geocoding
  had no country-scoping and silently matched a wrong-country place. If
  a similar "assume Namibia" assumption ever breaks local testing again,
  check for this same mismatch before assuming it's a code bug.
- **Node isn't on the system PATH** — installed via `nvm`. Fresh terminal:
  `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"` if `node -v` fails.
- **Backend**: `docker compose up -d` from the repo root. Check
  `docker compose ps` — should show `backend`, `celery`, `db`, `redis`,
  `minio` all healthy/up.
- **Don't use `81 234 5678` for test registrations** — it's the phone
  field's on-screen placeholder text, easy to type by habit, and it
  collides with a real pre-existing seed/test account (confirmed
  2026-08-26, an old customer record). Registering with it doesn't
  create a new account — OTP verify finds the existing phone and logs
  into *that* account instead, with whatever role/data it already has,
  which looks exactly like a broken registration (wrong role, stale
  name, missing onboarding data) until you check `date_joined` and
  realize it's not actually new. Pick genuinely random digits instead.
- **LAN IP drift**: this Wi-Fi network reassigns DHCP addresses often —
  four times in one Simulator session on 2026-08-26, then **three more
  times in a single afternoon on 2026-08-27** while debugging physical-
  device connectivity, then **three separate times across the
  2026-09-03/04 session** (once overnight between sessions, twice more
  mid-session) — this is a near-certainty every time you resume work, not
  an occasional annoyance; always re-check `ipconfig getifaddr en0` first,
  don't assume you've caught the last drift even minutes after last fixing
  it. Separate places reference the Mac's LAN IP and all need to stay in
  sync:
  1. `EXPO_PUBLIC_API_URL` in both apps' `.env` (see USB gotcha above).
  2. The dev-client's manual "Enter URL manually" host, if Bonjour
     auto-discovery doesn't find Metro on its own (`<ip>:8081`) — now
     that `expo-dev-client` is installed, the old Simulator-only
     `RCT_jsLocation`/`simctl` workaround for this no longer applies.
  3. **`AWS_S3_PUBLIC_ENDPOINT_URL` in the root `.env`** — easy to miss
     since it's backend-side, not an Expo/Metro concern at all. A stale
     value here doesn't break uploads (those still reach MinIO fine via
     the Docker-internal `AWS_S3_ENDPOINT_URL`) — it silently breaks
     *displaying* anything already uploaded (profile photos, job photos,
     ID docs), since the signed URLs handed to the client embed this
     host. Symptom: an upload appears to succeed (200, no error) but the
     image never renders anywhere — confirmed live 2026-08-26 chasing a
     profile-photo-not-showing report. After changing it, the backend
     container needs `docker compose up -d --force-recreate backend`
     (env_file changes aren't picked up by a plain `restart`) — verified
     safe, `db` gets recreated alongside it too (compose treats file
     changes as affecting the whole `.env`-consuming service graph) but
     its named volume means no data loss.
  Also check `DJANGO_ALLOWED_HOSTS` in the root `.env` if that's ever set
  to something other than `*` (currently unset, defaults to `*` under
  `DEBUG=True`, so this rarely bites).
- **Uploads are now collision-safe.** Previously every upload (profile
  photo, job photo, ID document, certification) used a hardcoded generic
  client-side filename, and S3/MinIO overwrites same-named objects by
  default — so every user's profile photo silently overwrote every other
  user's. Fixed via `unique_upload_path()` in
  `backend/config/storage_backends.py`. If you're ever debugging "wrong
  photo showing up," this class of bug is already closed — look
  elsewhere first.
- **`EXPO_PUBLIC_USE_RN_FETCH=1`** is set in both apps' `.env` — required,
  don't remove. Confirmed 2026-08-26 this is a **real, built-in Expo SDK
  57 mechanism** (docs: "By default, `expo/fetch` replaces the global
  `fetch` implementation... set `EXPO_PUBLIC_USE_RN_FETCH=1` to restore
  React Native's classic `fetch`"), read internally by Expo's own
  bootstrap — not something this codebase implements or calls anywhere
  itself, which had briefly looked like dead config before checking the
  actual docs. Verified live that it's doing its job (a debug probe on
  `fetch` confirmed RN's classic implementation is active, and a real
  multipart photo upload round-tripped correctly end-to-end).
- **`.env` files are gitignored** — `.env.example` in each app documents
  what's needed.
- Two Expo dev servers run side by side: worker on port 8081, customer
  normally on port 8082 (`--port 8082` flag) — though the customer
  Simulator session as of 2026-08-26 is on **port 8095** instead (see
  below); either port is fine going forward, 8082 is just the
  established default.
- **JWT access tokens expire after 30 min with no auto-refresh mid-
  session** — a real, still-unfixed gap. If a long-idle app session starts
  throwing 401s, that's why; relaunching the app re-triggers the
  refresh-token flow on mount and clears it. Low priority unless it comes
  up again.
- **`expo-dev-client` is now installed in both apps (2026-08-27)** — see
  "Physical iPhone builds" above for the full story and its one known
  gotcha (Wi-Fi network mismatch). Before this fix, neither app had it,
  which caused both a physical-device "No script URL provided" crash on
  cold relaunch and a Simulator-specific port-fallback bug (a bare
  `simctl launch` had no way to discover the right Metro port and
  silently fell back to 8081, i.e. the worker app's port, even when
  launching the customer app). Not yet independently re-verified whether
  the Simulator port-fallback symptom is actually gone now that
  `expo-dev-client` is in — likely yes (that was the suspected fix in the
  original gotcha note) but worth confirming next time the Simulator
  (not just the physical device) is used for the customer app.
- **Local `require()`'d image assets can serve stale/wrong content on
  Simulator** (discovered + worked around 2026-08-26, customer Home
  screen's service-tile photos). Metro's local-asset HTTP serving in this
  monorepo registers each asset with a *directory-level*, not
  file-specific, `httpServerLocation` containing `unstable_path` — an
  explicitly experimental Metro feature. Confirmed via direct `curl` that
  Metro serves 100% correct bytes/hash for the exact asset URL, and that
  the JS bundle text itself references the correct filename — yet the
  native `Image` component kept rendering old/wrong photo content for
  that require() call site. Survived: Metro cache clears, full app
  uninstall+reinstall, brand-new never-before-used Metro ports, and a
  full Simulator reboot — ruling out every normal caching layer. **Fix**:
  don't `require()` local photos in `apps/customer` — inline them as
  base64 `data:` URIs instead (bypasses Metro's asset pipeline entirely).
  See `apps/customer/src/serviceImages.ts` for the working pattern and
  the regeneration script in its header comment. Not yet confirmed
  whether this also affects physical-device (non-Simulator) builds or is
  Simulator-specific — worth a real device check next time that app is
  touched. `expo-dev-client` is now installed (see above), which might
  incidentally resolve this too — worth checking before assuming the
  base64-inline workaround is still needed long-term.

## Active-job & pricing flow redesign (2026-09-08) — decided, not built

Came out of a full Simulator test pass on 2026-09-07/08 (registered a
customer and a worker from scratch through both apps, ran happy path +
low rating + price confirmation end-to-end; Claude drove the counterpart
role via REST). Conclusion: **the worker's accept→completion flow is too
heavy for informal-sector workers**, and pricing is in the wrong place.

**Agreed redesign** (full detail in CLAUDE.md's "Active-job & pricing
flow redesign (2026-09-08 design session)" section — that's the source
of truth):
- Price moves to an **on-site evaluate step before work starts**: worker
  arrives → assesses → **Accept** (enter quote) or **Decline** (reason →
  job closes, terminal `declined`, customer can re-request).
- Customer **confirms the quote in-app**; "Start work" is gated on that.
- **"On my way" dropped**; **no post-work pricing step** — "Complete" is
  the finish line.
- No re-quoting for scope creep — "Pricing disagreement" report stays as
  the escape hatch.
- New status chain: `matched → accepted → arrived → quote_pending →
  quote_accepted → in_progress → completed` + terminal `declined`
  (was `… → accepted → on_my_way → arrived → in_progress →
  awaiting_price_confirmation → completed`).

**PRD + tickets** (`docs/prds/active-job-flow-v2.md`,
`docs/tickets/active-job-flow-v2.md` — T1–T10). Hi-fi produced
(`docs/design/prism-hifi-v2.dc.html`).

**T1–T9 implemented** on branch `active-job-flow-v2` (not merged):
- T1–T3 backend: `JobRequest.Status` now `… → accepted → arrived →
  quote_pending → quote_accepted → in_progress → completed` + terminal
  `declined`; `quoted_at`/`quote_accepted_at` fields (dropped
  `on_my_way_at`); `CancellationLog.kind`; new `/quote/`, `/decline/`,
  `/confirm-quote/`, `/reject-quote/` endpoints; `/complete/` bodyless;
  `/dispute-price/` retargeted to `completed`; `decline_reason` on the
  job serializer; 5 push triggers; migration `0008` (remaps old in-flight
  rows). `OnMyWayView` removed.
- T4 `packages/api`: `submitQuote`/`declineJob`/`rejectQuote`/
  `confirmQuote` added, `markOnMyWay` gone, `completeJob` bodyless,
  `JobStatus` union + `JobRequest` type updated.
- T5–T6 apps/worker: `ActiveJobScreen` rebuilt (4 status-driven phases),
  new `EvaluateScreen` folded into it, `ProposePriceScreen` →
  `SendQuoteScreen`, new `DeclineJobScreen` + shared `ReasonPicker`,
  `WaitingForConfirmationScreen` repurposed to pre-work quote wait,
  `JobCompleteScreen` copy, Jobs-tab status labels.
- T7–T9 apps/customer: `JobStatusScreen` 6-step timeline + extracted
  `request/jobStatusSteps.ts`, `PriceAgreementScreen` →
  `ConfirmQuoteScreen` (Confirm/Reject), new `WorkerDeclinedScreen` +
  "Request again" prefill on `RequestSubmissionScreen`,
  `ReportProblemScreen` routes pricing_disagreement → `disputePrice`,
  Jobs-tab labels.

- **T10 (live two-app Simulator pass)** — done 2026-09-08/10. Verified on
  the "Prizm Test" simulator (Claude driving one side via REST):
  - full worker onboarding → OTP → PIN → profile → ID upload → admin
    approve → go online
  - incoming-offer screen with the customer photo + full details
  - worker happy path: accept → I've arrived → evaluate → send quote →
    (customer confirms) → start work → complete
  - customer happy path: request → 6-step timeline → ConfirmQuote →
    confirm → rating
  - reject path: customer rejects the quote → worker "Quote not accepted"
  - decline path: worker declines on site → job `declined` +
    `CancellationLog(kind=on_site_decline)` → customer's `WorkerDeclined`
    screen with the reason → "Request again" opens a pre-filled request

- Two **follow-ups raised during T10 and done on the same branch**:
  1. `IncomingOfferScreen` now renders the customer's photo + full
     details before Accept (the data was already in the offer payload).
  2. Navigation audit of the v2 flow — added a back affordance to
     `SendQuoteScreen`, "Back to Jobs" / "Decline" escapes on the worker
     wait screen, a `‹`→Jobs header on `ActiveJobScreen`, and made the
     evaluate "Decline this job" an outlined button. See the tickets doc.

- One follow-up **still open — customer completion confirmation** (the
  customer should also confirm the job is done). Needs its own mini-PRD +
  tickets (v2.1). See `docs/tickets/active-job-flow-v2.md` bottom.

Tests all green: **backend 176, worker 61, customer 63, api 30**; both
apps typecheck clean. Committed on branch `active-job-flow-v2` (not yet
merged to `main`).

**Scope of the build** (from the PRD):
- Backend: `JobRequest.Status` enum + migration; move `agreed_price` /
  `worker_note` writes from `CompleteJobView` to a new evaluate/quote
  endpoint; new customer quote-confirm + quote-reject endpoints; new
  `declined` terminal state with a reason (log it like `CancellationLog`);
  drop `on_my_way` + its `on_my_way_at` timestamp; update
  `_WorkerJobTransitionView` chain; `jobs/tests/*` rewrite.
- apps/worker: replace the on-my-way/arrived/start/complete/propose-price
  sequence with arrived → EvaluateScreen (quote + Accept/Decline) →
  wait-for-quote-confirm → Start work → Complete. Reuse ProposePrice UI
  for the quote entry. `WaitingForConfirmationScreen` repurposed to
  pre-work. Logic tests (`useJobStatusPolling` etc.) updated.
- apps/customer: `JobStatusScreen` timeline reworked (6 steps, no "on my
  way"); PriceAgreement screen moves to *before* work and becomes
  Confirm/Reject (no dispute button there — dispute is post-agreement
  only); Matched auto-advance unchanged.
- Supersedes `docs/prds/worker-active-job-flow.md` and the shipped
  customer price-agreement screen.

## Immediate next steps, in order

0. ✅ **Done (2026-08-27)** — the worker ID-upload bug-fix cycle (crop/
   retake/delete, scroll fix, tile-sizing fix) described in earlier
   versions of this file is now fully confirmed live end-to-end on a
   physical phone, plus the follow-on Home/Jobs verification-state
   redesign and font-weight sweep — see "What's actually built" above for
   the full rundown. This round is committed (see git log around
   2026-08-27).

1. ✅ **Done (2026-08-25)** — the remaining click-test pockets from the
   chat + profile-redesign PRDs (the 4 Account-row destination screens,
   chat's polish states, the saved-address picker on
   `RequestSubmissionScreen`) were all tapped through live on the phone
   and confirmed working. Minor visual polish noted as worth revisiting
   later, but nothing broken — no fixes needed this round.
2. **Step 10 (mobile money payment) is being deliberately skipped for
   now** per user decision on 2026-08-25 — provider still TBD (see
   CLAUDE.md), come back to it later.
3. **Step 11 (push notifications) is paused on an Apple Developer
   Program blocker (2026-08-26).** PRD (`docs/prds/push-notifications.md`)
   and tickets (`docs/tickets/push-notifications.md`, T0–T7) are written.
   **T1–T3 (backend) are done, tested, and merged** — new
   `backend/notifications` app (`PushToken` model, register/delete
   device endpoint), the `send_push_notification` Celery task (the
   project's first real Celery task, confirmed working end-to-end via a
   real smoke test through the actual worker, not just configured), and
   the task wired into the three trigger points (`jobs/matching.py`
   `try_match`, `jobs/views.py` `AcceptOfferView` +
   `MessageListCreateView`). 16 new backend tests pass, full suite
   47/47. This backend work is inert but harmless until a device
   actually registers a token — safe to have merged ahead of the
   frontend/T0 being unblocked.
   **T0 (Apple Developer/EAS credential setup) is blocked**: checked
   2026-08-26 — `jewelbansah@icloud.com`'s Apple ID is on a **Personal
   Team only, no paid Apple Developer Program membership** ($99/yr,
   required for the Push Notifications capability — a hard Apple
   platform requirement, not something to work around). Also surfaced
   along the way: the existing `ios/*.xcodeproj` project files reference
   signing team `LZDFN4R8G7`, which doesn't match the only valid
   codesigning identity currently in the keychain
   (`862V45CWK2`/personal team) — unresolved, likely stale from an
   earlier signing session; hasn't blocked existing device builds so
   left alone, but worth a look if iOS signing ever acts up.
   **T4 is also done now** — `packages/api/src/notifications.ts`
   (`registerDevice`, `unregisterDevice`, `getNotificationRoute`, the
   last a pure function with no RN/expo-notifications dependency so it
   didn't need T0 to write or test), 6 new tests pass
   (`packages/api/src/notifications.test.ts`), both apps typecheck
   clean. **User decision (2026-08-26): pause push notifications here**
   — T5–T7 (`expo-notifications` native config, the shared registration
   hook, the device click-test pass) all genuinely need T0 (real device
   push credentials) to build/verify, unlike T4. Come back to T0 once/if
   the Apple ID gets enrolled in the paid Program, then pick up T5–T7.
4. **In progress since 2026-08-30** — a live design-fidelity pass against
   a Claude Design hand-off, going screen by screen: customer Home (done)
   → customer `RequestSubmissionScreen` Ticket 1 (done, confirmed live) →
   **Ticket 2 (Searching + Matched screens vs. hi-fi) — still not
   started.** Note the Matched screen *did* get a real behavior change
   this session (the auto-advance/transient-toast fix, see "What's
   actually built") — that was a functional bug fix driven by live
   testing, not the Ticket 2 visual-fidelity pass itself; Ticket 2's own
   comparison against the hi-fi (spacing/heading-weight/button-gradient,
   matching Ticket 1's standard) hasn't been done yet.
5. ✅ **Done (2026-09-04)** — both `docs/tickets/android-bugfixes-2026-08-30.md`
   tickets: T1 (geocode a manually-typed address when GPS fails/is
   denied, new shared `apps/customer/src/request/geocodeAddress.ts`,
   wired into both `RequestSubmissionScreen`/`AddressFormScreen`) and T2
   (customer `JobsScreen` real error + Retry state instead of a silent
   false-empty one, adapted to the since-rewritten pagination version of
   that screen). Live-repro'd (stopped/restarted the backend, confirmed
   the error state and a working Retry) — that repro surfaced and fixed
   one more small gap, a Retry button with no loading feedback while
   still failing. See the ticket file's own implementation notes for
   detail.

   **Live-testing T1 surfaced a second, worse bug**: `Location.
   geocodeAsync` has no country-scoping, so a short/ambiguous address
   ("Ho Ahoe") silently resolved to a real place in Ghana instead of
   failing — the job would have sat in `searching` forever with zero
   eligible workers and no error at all. Fixed with a region name/
   bounding-box check in `geocodeAddress.ts` (`REGIONS` map, currently
   Namibia + Ghana, selected via `EXPO_PUBLIC_GEOCODE_REGION`, defaulting
   to Namibia) — added as an env var specifically because **this project
   is being built and tested from Ghana, not Namibia**, so a hardcoded
   Namibia-only bounds check would have broken the developer's own
   ability to test manual-address entry at all. Confirmed live both
   directions on a physical phone: Namibia-mode correctly rejects the
   Ghana address that broke things originally; Ghana-mode resolves a real
   Accra address to real coordinates and correctly matches a real nearby
   test worker (a pre-existing test account with a genuine Ghana GPS
   location — this project's dev/test data has apparently always been a
   mix of Namibia- and Ghana-based accounts). Customer suite 57/57.
6. **Not yet visually confirmed**: Jobs-tab pagination (both apps, see
   "What's actually built") works and is tested, but this project's test
   accounts only ever have 2–3 completed jobs, so infinite scroll has
   never actually fired live. Worth seeding a batch of dummy completed
   jobs and scrolling through it once, next time either app is open.
7. **Active-job & pricing flow redesign (2026-09-08)** — decided, PRD +
   tickets drafted (`docs/prds/active-job-flow-v2.md`,
   `docs/tickets/active-job-flow-v2.md`). This is the next real feature.
   Sequence: (a) run the Claude Design brief
   (`docs/design/active-job-flow-v2-brief.md`) to update the hi-fi,
   (b) review PRD + tickets against the hi-fi, confirm the §9 open
   questions (tickets currently assume the PRD defaults),
   (c) implement T1–T10 in order. T1–T4 (backend + `packages/api`) can
   start now — they don't depend on the hi-fi.

**Dev environment was fully stopped at the end of the 2026-09-05
session** (both Metro/Expo dev servers, the iOS Simulator, and the whole
`docker compose` stack via `docker compose down` — the named Postgres
and MinIO volumes were left intact, confirmed via `docker volume ls`, so
no data was lost). The physical iPhone still has both apps installed
from earlier, just disconnected from Metro. To resume: `docker compose
up -d` from the repo root, then `npx expo start --dev-client -c` in each
of `apps/worker`/`apps/customer` — see `docs/setup-guide.md` for the
full walkthrough if picking this up fresh. **Check the LAN IP first**
(`ipconfig getifaddr en0` — see "LAN IP drift" above, a near-certainty
by now) before assuming anything's broken.

## Known loose ends / things to revisit

- JWT 30-min expiry / no mid-session refresh — see Environment gotchas.
- **Fixed 2026-08-30**: Customer Home's search bar is now a real live
  client-side filter (see "What's actually built" above) — no longer
  decorative, this line is now stale/historical.
- A user reported onboarding's profile-photo step (`packages/auth-flow/
  src/screens/ProfileScreen.tsx`) not persisting a photo at all — traced
  the code and it's identical in structure to the Profile-tab photo-edit
  path (same `updateProfile` call, same FormData construction), which
  was independently verified working the same day (real upload,
  `photo.url` reachable, image rendered). The stale `AWS_S3_PUBLIC_
  ENDPOINT_URL` (see Environment gotchas) was live at the time of that
  report and is the far more likely explanation than a code-level
  onboarding-specific bug. Not independently re-verified in isolation
  though — worth a quick real check next time a fresh account goes
  through onboarding, just to be certain.
- **Fixed 2026-08-26**: `PinDots` (`packages/ui/src/components/PinDots.tsx`,
  shared by both apps' 4-digit PIN screens) had near-invisible empty-dot
  outlines — `colors.border` (`#ECE7E2`) against `colors.pageBackground`
  (`#F1ECE7`) is barely distinguishable. Now uses `colors.textSecondary`
  for the border plus a `colors.surfaceMuted` fill, matching the contrast
  pattern `OtpInput`'s empty boxes already used successfully.
- **Fixed 2026-08-26**: a real `AuthProvider` bug where, if a stored
  refresh token succeeded but the immediately-following profile fetch
  failed (e.g. the underlying account was deleted — the refresh token
  itself still validated), the app landed on `isAuthenticated=true` with
  `profile=null` permanently — both apps' `App.tsx` has no recovery path
  from that combination, so the app was stuck on the splash screen
  forever. Fixed by extracting the "establish a *new* session" logic
  (mount-effect restore, `setSession` right after login) into
  `packages/api/src/sessionEstablishment.ts`'s `restoreSession`/
  `establishSessionFromTokens` — both are now all-or-nothing: a profile
  fetch failure there means no partial session is ever produced
  (`restoreSession` returns `null` and the stored tokens are cleared;
  `establishSessionFromTokens` throws, already caught by both PIN
  screens' existing try/catch). Deliberately left `refreshProfile()`
  (pull-to-refresh on an *already-established, already-working* session)
  swallowing failures as before — a transient failure there shouldn't
  log out a user who was already in; only the two session-establishment
  call sites needed the stricter contract. Verified via 5 new unit tests
  (`packages/api/src/sessionEstablishment.test.ts`) covering exactly this
  refresh-succeeds-then-profile-fails case, plus a live repro on the
  Simulator (deleted the logged-in test account, relaunched, confirmed
  it drops to the phone-entry screen instead of freezing).
- No hi-fi mockup existed for the customer Jobs tab (T2) when it was
  built — it's a reasoned adaptation of the worker app's Jobs tab, not a
  pixel spec. Worth a visual gut-check with the user if/when a customer
  Jobs-tab mockup ever surfaces, same as happened for the worker one.
- Worker onboarding's "Add certifications" screen no longer has the
  one-cert-per-visit limitation — resolved as a side effect of
  `profile-redesign` T5's Certifications list (add-per-category is now
  inherently repeatable from the Profile tab). Onboarding itself still
  only shows the single-add UI in its own linear flow, which is fine
  (matches CLAUDE.md: certifications are optional/skippable there either
  way) — just noting the old caveat no longer applies.
- Customer Profile's "soft gradient ring" behind the avatar
  (`ProfileHero`'s customer variant, `packages/ui`) is a flat low-opacity
  circle, not a true blur — React Native has no built-in blur without an
  extra native dependency. Flagged in the PRD as needing a visual
  gut-check; not yet done (see "Immediate next steps").
- Chat is polling-only (no push notifications for new messages, no
  unread badges/read receipts/typing indicators) — all deliberate,
  matching CLAUDE.md's own "start with simple polling" framing for this
  build-order step. Revisit unread/push once step 11 (push notifications)
  is built.
- `ChatScreen` (both apps) fetches the job once on mount to know the
  terminal-status gate and the other party's identity — it does not
  re-check this on every message-poll tick, so a job transitioning to a
  terminal status *while* someone has the chat screen open won't disable
  sending until they leave and re-enter. Accepted edge case per the chat
  PRD, not fixed.
- **Both apps' Profile → Account section now has a fuller settings list**
  (`SettingsRow`, `packages/ui`), matching the hi-fi mockup's structure:
  Payout/Payment method and Notification preferences open a shared
  `ComingSoonScreen` (no payment provider or push infra exists yet — see
  build-order steps 10/11, both not started); Help & support and Safety
  tips are real static-content screens (`apps/worker/src/screens/` and
  `apps/customer/src/screens/`, both per-app, not shared); Terms &
  liability reuses the exact onboarding liability text
  (`packages/auth-flow/src/screens/ProfileScreen.tsx`'s `TERMS_TEXT`) and
  reads the existing `liability_acknowledged_at` field — no new backend
  work needed for that one. **`HelpSupportScreen`'s contact email
  (`support@prism.app`) and hours are placeholder values, explicitly
  marked in a code comment — swap for real contact info before any real
  pilot launch.** Safety tips copy is Claude-drafted generic guidance
  (verify Verified badge, keep coordination in-app, etc.), not
  user-supplied — worth a read-through/edit pass when convenient.
