# Tickets: Profile Redesign (Worker + Customer)

See `docs/prds/profile-redesign.md` for full context, goals/non-goals, and
reasoning behind the technical decisions referenced here.

---

### T1 — Backend: `Address` model + CRUD API ✅ Done

**Implementation notes:** built as planned, with one correction to the
ticket draft: the `accounts` app is actually mounted at `/api/auth/` in
`config/urls.py` (matching `/api/auth/certifications/`,
`/api/auth/worker-profile/`), not `/api/accounts/` — endpoints landed at
`/api/auth/addresses/` and `/api/auth/addresses/<id>/` to match that
existing convention. `AddressSerializer` follows `JobRequestSerializer`'s
lat/lng-as-flat-floats convention but as a single read/write
`ModelSerializer` (`JobRequestSerializer` only reads; a separate
`JobRequestCreateSerializer` handles writes) — `latitude`/`longitude` are
declared `write_only` `FloatField`s, popped in `create`/`update` to build
a `Point(lng, lat, srid=4326)`, and re-added into the response manually in
`to_representation` (since `write_only` fields are otherwise excluded from
output). `PATCH` supports partial updates (label-only edits don't require
resending coordinates, even though T6's mobile UI is expected to always
resend them per the PRD's resolved GPS-on-every-edit decision — the
backend itself doesn't enforce that). No admin registration added — unlike
`Certification`/`WorkerProfile`, addresses need no manual review queue, so
skipped rather than building an unused admin page. 7 new tests in
`accounts/tests/test_addresses.py`, all passing; full backend suite (15
tests across `accounts`/`jobs`/`services`) passes with no regressions.

**Depends on:** none.
**Touches:** `backend/accounts/models.py`, `backend/accounts/serializers.py`,
`backend/accounts/views.py`, `backend/accounts/urls.py`, new migration,
`backend/accounts/factories.py` (or wherever existing factories live),
`backend/accounts/tests/`.

- `Address` model in `backend/accounts/models.py`: `user (FK → User,
  related_name="addresses")`, `label (CharField)`, `address_text
  (CharField/TextField)`, `location (PointField)`, `created_at`,
  `updated_at`. FK'd to `User` directly, not `CustomerProfile` (per PRD
  §6 — matches this codebase's existing pattern, keeps the door open for
  non-customer use later without forcing it now).
- `AddressSerializer`: exposes `id, label, address_text, latitude,
  longitude, created_at, updated_at` — convert `location` (`Point`) to/from
  flat `latitude`/`longitude` floats at the serializer boundary so the
  mobile side never touches PostGIS geometry directly (same convention
  `JobRequestSerializer` already uses for `location`, check that file for
  the exact `to_representation`/`create` pattern to mirror).
- `AddressListCreateView` (`ListCreateAPIView`): queryset filtered to
  `request.user.addresses.all()`; `perform_create` sets `user=self.request.user`.
- `AddressDetailView` (`RetrieveUpdateDestroyAPIView`): same ownership
  filter on `get_queryset` — a request for another user's address ID must
  404, not 403 (don't leak existence).
- URLs: `GET/POST /api/accounts/addresses/`,
  `GET/PATCH/DELETE /api/accounts/addresses/<id>/`.

**Acceptance criteria**
- A user can create, list, update, and delete their own addresses via the
  API.
- Requesting, updating, or deleting another user's address ID returns 404.
- `label` and `address_text` are required on create; `latitude`/`longitude`
  are required and must produce a valid `Point`.

**Tests**
- Factory-driven (`factory_boy`) `pytest-django` tests: list returns only
  the requesting user's addresses (create addresses for two users, assert
  isolation); create sets `user` from the authenticated request, not from
  any client-supplied field; update/delete on another user's address ID
  returns 404; update/delete on your own address succeeds and persists;
  missing required fields returns 400.

---

### T2 — Backend: worker/customer profile stats as computed fields ✅ Done

**Implementation notes:** built as planned. Confirmed no
`CustomerProfileView` existed yet (per the PRD's flagged open question) —
added a new minimal one (`CustomerProfileView`, read-only
`RetrieveAPIView`, mirrors `WorkerProfileView`'s `get_object` pattern via
`request.user.customer_profile`) at `GET /api/auth/customer-profile/`,
gated by a new `IsCustomerRole` permission (mirrors the existing
`IsWorkerRole`). `date_joined` added to the shared `ProfileSerializer`
(read-only) rather than duplicated per-role, since it's a plain `User`
field both apps already fetch from the same endpoint. `jobs_completed`/
`rating_average` added to `WorkerProfileSerializer` as
`SerializerMethodField`s, both filtered to `job__status="completed"` —
deliberately stricter than the existing `WorkerPublicSerializer.
get_rating_average` (`jobs/serializers.py`, used for job cards elsewhere)
which doesn't filter by job status; left that one untouched since it's
out of this ticket's scope and changing it could affect already-shipped
card rendering. `requests_completed` added via a new
`CustomerProfileSerializer`. No migration needed (serializer/view-only
change, no model fields added). 6 new tests in
`accounts/tests/test_profile_stats.py` (zero/null baseline,
completed-only counting for both roles, rating average excluding a
non-completed job's rating, role-gating on the new customer endpoint,
`date_joined` presence), all passing; full backend suite (21 tests) green.

**Depends on:** none (independent of T1).
**Touches:** `backend/accounts/serializers.py` (`WorkerProfileSerializer`
and whichever serializer backs the customer profile fetch — see note
below), `backend/accounts/tests/`.

- `WorkerProfileSerializer` gains two `SerializerMethodField`s:
  - `jobs_completed`: `JobRequest.objects.filter(worker=obj,
    status="completed").count()`.
  - `rating_average`: `Rating.objects.filter(job__worker=obj,
    job__status="completed").aggregate(Avg("stars"))`, rounded to 1
    decimal, `None` (not `0`) when there are no ratings yet — the mobile
    side needs to distinguish "no ratings" from "rated zero."
- Customer side: **first check whether a dedicated
  `CustomerProfileView`/`CustomerProfileSerializer` already exists** (it
  may not — `CustomerProfile` currently has no dedicated fetch endpoint
  beyond whatever `ProfileView` returns for `full_name`/`photo`). If one
  doesn't exist, add a minimal `CustomerProfileView` mirroring
  `WorkerProfileView`'s shape, or extend whatever endpoint the customer
  Profile screen already calls — implementer's call, note which was
  chosen and why in the implementation notes. Either way, add
  `requests_completed`: `JobRequest.objects.filter(customer=obj,
  status="completed").count()`.
- `date_joined` ("member since" for both roles): confirm it's already
  exposed on whichever serializer the Profile screens fetch from (likely
  `ProfileSerializer`, used by both apps since T3). If not already
  present, add it there once, shared by both roles — not duplicated into
  the worker/customer-specific serializers.

**Acceptance criteria**
- Worker profile fetch includes `jobs_completed` and `rating_average`
  (null when no ratings).
- Customer profile fetch (via whichever endpoint) includes
  `requests_completed`.
- Both roles' profile fetch includes `date_joined` somewhere in the
  response.
- Only `completed` jobs count toward either stat — `cancelled`/`disputed`/
  in-progress jobs must not inflate the numbers.

**Tests**
- Factory-driven: worker with 0 completed jobs → `jobs_completed == 0`,
  `rating_average is None`; worker with N completed jobs and a mix of
  rated/unrated ones → correct count and correct average over only the
  rated ones; a `cancelled` job with a `Rating` somehow attached (shouldn't
  happen, but assert it's excluded anyway) doesn't count. Same shape for
  `requests_completed` on the customer side.

---

### T3 — Shared UI primitives: `StatCard` + `ProfileHero` ✅ Done

**Implementation notes:** built as planned, with one small addition beyond
the ticket's listed touches: `ProfileHeader.tsx` gained a new optional
`inverse?: boolean` prop (name/Edit-link/Cancel-link flip to light colors)
rather than being left untouched — composing it inside `ProfileHero`'s
gradient worker variant without this would have made the name/edit text
unreadable (dark text on the brand gradient), and duplicating
`ProfileHeader`'s edit-interaction logic instead would have violated the
PRD's explicit "compose, don't duplicate" instruction. The inline
`TextField` used while editing keeps its own light input-box background
either way, so it needed no change. `ProfileHero` takes `badges?:
ReactNode` (already-built `<Badge/>` elements) rather than a typed array,
and `subtitle`/`ratingLine` as plain caller-composed strings, per the
PRD's "composed by the caller, not by this component" decision — keeps
`ProfileHero` itself free of any formatting logic. Customer variant's
"soft gradient ring" is approximated as a single low-opacity (0.16) brand-
gradient circle centered behind the avatar via absolute positioning, not
a true blurred ring (React Native has no built-in blur without an extra
native dependency, out of scope to add for this) — flagged in the PRD's
open risks as needing a visual gut-check, unchanged here. `StatCard`
takes an `items: {value, label}[]` array (not hardcoded to 2) so a future
3rd stat wouldn't require touching it again. Both apps' `tsc --noEmit`
and `packages/ui`'s own typecheck are clean; both apps' existing Jest
suites still pass unchanged (42 worker / 20 customer — these new
components aren't wired into any screen yet, so nothing new to test
against). No rendering tests added for either component, consistent with
project policy for presentational UI.

**Depends on:** none.
**Touches:** new `packages/ui/src/components/StatCard.tsx`, new
`packages/ui/src/components/ProfileHero.tsx`, `packages/ui/src/index.ts`
(exports).

- `StatCard`: takes an array of `{ value: string, label: string }` (2
  items for this PRD, but don't hardcode to exactly 2 — a 3rd stat
  shouldn't require touching this component again later), renders as a
  row of cells inside a `Card`, matching the mockup's rounded stat-card
  look.
- `ProfileHero`: `variant: "worker" | "customer"` (or equivalent
  composition — implementer's call on the exact prop shape). Built on the
  existing `GradientBackground` (worker: full gradient background;
  customer: calm/plain background with a soft gradient ring around the
  avatar only — implementer's call on how to achieve the ring, e.g. a
  `LinearGradient` circle behind/around the existing `Avatar`). Wraps the
  existing `ProfileHeader`'s avatar-tap and inline-name-edit behavior
  rather than reimplementing it (compose, don't duplicate — `ProfileHero`
  should own layout/background/badges/stats-row, `ProfileHeader` still
  owns the actual edit interaction). Accepts a subtitle line (plain
  string — worker's "location · categories" or customer's "Member since
  ..." is composed by the caller, not by this component), an optional
  badges slot (worker: `Verified`/`Certified` `Badge`s), and an optional
  rating/jobs-completed line (worker only).
- Export both from `packages/ui`.

**Acceptance criteria**
- Both variants render with mock/placeholder props (no live data
  dependency for this ticket — that's T5/T6).
- Avatar tap and name-edit interactions still work identically to today's
  `ProfileHeader` usage (no regression in T3-shipped editing UX).

**Tests**
- None expected — presentational component, consistent with this
  project's "test logic, not screens" policy. If any non-trivial branching
  logic ends up extracted (e.g. a pure function choosing which badges to
  show), unit test that specifically.

---

### T4 — `@prizm/api`: `address.ts` resource ✅ Done

**Implementation notes:** built as planned, thin pass-through wiring —
`Address`/`AddressInput` interfaces plus `listAddresses`, `createAddress`,
`updateAddress` (`Partial<AddressInput>`, since T1's backend supports
partial `PATCH`), `deleteAddress`, all via the existing `apiRequest<T>`
convention. `packages/api`'s standalone `tsc --noEmit` has 47 pre-existing
errors unrelated to this change (missing DOM/jest/node type libs — this
package is only ever typechecked in the context of a consuming app, which
supplies those globals via its own `tsconfig`/RN types); confirmed via
`git stash` that the count is identical on `main` before this ticket, so
`address.ts` itself introduces zero new errors. Since nothing wires this
into a screen yet (that's T6/T7), verified the real round trip manually
against the local Docker backend instead: created a throwaway user +
JWT via `manage.py shell`, then `curl`'d list (empty) → create → list (1
item) → PATCH label-only → delete → list (empty again) directly against
`/api/auth/addresses/`, confirming the response shape matches the
`Address` interface exactly field-for-field. Test user cleaned up
afterward.

**Depends on:** T1 (needs the real endpoints to exist to be meaningfully
verified against a running backend, though the file itself can be written
in parallel).
**Touches:** new `packages/api/src/address.ts`, `packages/api/src/index.ts`
(exports).

- `Address` interface: `{ id, label, address_text, latitude, longitude,
  created_at, updated_at }`.
- `listAddresses(token)`, `createAddress(token, { label, address_text,
  latitude, longitude })`, `updateAddress(token, id, Partial<...>)`,
  `deleteAddress(token, id)` — following the existing `apiRequest<T>(path,
  { method, token, body })` convention used by every other resource file
  in this package.

**Acceptance criteria**
- All four functions typecheck and successfully round-trip against the
  T1 backend endpoints (manual check against the local Docker backend is
  sufficient — this is thin wiring).

**Tests**
- None expected unless any function ends up with real branching logic
  beyond a direct `apiRequest` pass-through — if it's thin wiring, skip,
  consistent with this project's testing philosophy.

---

### T5 — Worker Profile screen redesign ✅ Done

**Implementation notes:** built as planned, with several real findings and
deviations worth flagging:

- **Found and fixed a latent category-overwrite bug** in the existing
  onboarding `CertificationsScreen.tsx`: its `handleSubmit` called
  `updateWorkerCategories(token, [selectedCategoryId])` — replacing, not
  adding to, the worker's categories. Harmless during onboarding (starts
  from empty), but this ticket's "+ Add another certificate" reuses that
  same screen from the Profile tab, where a worker can already have
  several categories set via the new Services-offered editor — reusing
  the screen unfixed would have silently wiped them down to one on every
  cert add. Fixed by fetching the current profile and merging (add if not
  already present) instead of overwriting; this is strictly safer for the
  onboarding path too (identical behavior when starting from empty).
  Added a `returnTo?: "profile"` route param (`WorkerOnboardingStackParamList`
  in `navigation/types.ts`) so the screen returns to the Profile screen via
  `goBack()` and hides the onboarding-only "Skip for now" link when reached
  from there, instead of always continuing to `UnderReview`. The screen was
  already registered on the main `WorkerRootStackParamList` stack
  (`RootNavigator.tsx`), reachable from anywhere — no navigator changes
  needed, contrary to the ticket's flagged possibility.
- **Dropped the hero's "location" text.** No worker-facing city/address
  text exists anywhere in the data model (`WorkerProfile.last_location` is
  a raw `PointField`, no reverse-geocoded text) — showing a hardcoded
  "Windhoek" would be fabricated data, which this codebase has
  consistently avoided elsewhere (dropped "PAID" language, dropped
  on-time %). The hero subtitle is the categories list only (e.g.
  "Cleaning · Electrical").
- **Dropped the standalone phone-number card.** The PRD's Account section
  is explicitly "Log out only" and the mockup doesn't show a phone number
  in the redesign; the old screen's phone-in-a-Card block was removed
  rather than kept as an orphaned leftover.
- **Full-bleed hero achieved via layout restructuring, not a negative
  margin on `ProfileHero` itself**: `Screen`'s `content` View applies
  `paddingHorizontal` uniformly to all children, so a per-component
  negative-margin hack would have coupled `ProfileHero` to `Screen`'s
  specific padding value. Instead, `ProfileScreen` overrides `Screen`'s
  padding to 0 and wraps everything *except* the hero in its own padded
  `View`, with a negative `marginTop` on that wrapper so the `StatCard`
  overlaps the hero's rounded bottom edge, matching the mockup.
- **Services-offered editor** extracted `canRemoveCategory` (T5's
  specified pure function) to `apps/worker/src/profile/categoryGuard.ts`;
  add/remove both call the existing `updateWorkerCategories` directly (no
  new backend work needed, as anticipated).
- **Certifications status badges** reuse the existing `verified`/`neutral`
  `Badge` tone convention from the old screen's ID-status badge (approved
  → `verified`, pending/rejected → `neutral`) rather than inventing a
  third tone — matches how this codebase already collapses
  pending/rejected into one visual treatment for ID status.
- **`formatMemberSince`** extracted to `apps/worker/src/profile/` as its
  own tested pure function ("Mar '25" format, matching the mockup).
- `@prizm/api`: `WorkerProfile` gained `jobs_completed`/`rating_average`
  fields (T2's backend additions), `Profile` gained `date_joined` — both
  needed by this screen. `packages/api/src/address.ts`'s `AddressInput`
  was changed from an `interface` to a `type` alias (T4's file, touched
  here because building this screen's typecheck surfaced it): TypeScript
  requires an explicit index signature to assign a named `interface` to
  `Record<string, unknown>` (the `apiRequest` body type) but not a
  type-literal `type` alias — this was latent in T4, just not exercised
  until something in this session's full build actually typechecked
  `packages/api` in the context of a consuming app.
- Typecheck clean on both apps; worker Jest suite now 49/49 (7 new:
  `categoryGuard` ×4, `formatMemberSince` ×3). Verified live, but with a
  real gap: the app was already running on a booted "Prizm Test" iOS
  Simulator with an authenticated worker session (2 real completed jobs
  visible on the Jobs tab — good test data for the new stat card).
  Confirmed Metro's actual bundler compiles the full app with all of this
  ticket's changes with zero resolution/syntax errors (fetched
  `index.bundle` directly, grepped for new-code strings to rule out a
  stale cache) and confirmed the app is running live without crashing.
  **Could not tap through to the Profile tab itself** — no UI automation
  tool is available in this sandboxed session (no `idb`/`cliclick`, and
  AppleScript/System-Events window control needs an Accessibility
  permission grant that can't be given non-interactively here). So the
  actual rendered layout (hero contrast, chip wrapping, stat-card overlap
  visual) is unverified beyond code review and the PRD's own already-noted
  "needs a visual gut-check" open risk — worth a quick manual tap-through
  next time someone's at the keyboard.

**Depends on:** T2, T3.
**Touches:** `apps/worker/src/screens/ProfileScreen.tsx`, new
`apps/worker/src/profile/` directory for extracted logic (e.g. the
min-1-category guard), possibly `apps/worker/src/navigation/*.tsx` (see
certifications note below).

- Replace the current screen body with: `ProfileHero` (variant `worker`)
  fed from the worker-profile fetch (photo, name, `location · categories`
  subtitle, `Verified`/`Certified` badges from `id_status`/approved
  `Certification`s, `rating_average`/`jobs_completed` from T2) → `StatCard`
  (Jobs = `jobs_completed`, Member since = formatted `date_joined`) →
  Services-offered section → Certifications section → Account section
  (Log out only — no "Edit profile" row, per PRD §4).
- **Services offered**: chip list from the worker's current `categories`,
  each removable; a "+ Add" chip opens a picker of all `ServiceCategory`
  (existing `catalog.ts` fetch) not already selected. Both actions
  `PATCH` via the existing `WorkerProfileView`/`categories` update
  (already used elsewhere — check `worker.ts` for the existing function
  name rather than adding a new one). Extract the "can't remove the last
  category" rule as a pure function (e.g. `canRemoveCategory(current:
  string[]): boolean`) in `apps/worker/src/profile/categoryGuard.ts` —
  unit-testable, and the UI shows an inline message when blocked ("You
  need at least one service to stay matchable").
- **Certifications**: list from the existing certifications fetch
  (`worker.ts`/`auth.ts` — check existing name), each row showing category,
  document info, and a status indicator (approved = checkmark; pending/
  rejected = existing `Badge` tones, reused not reinvented). "+ Add
  another certificate" navigates to the **existing** certification-upload
  screen built during onboarding. **Check whether that screen is
  currently only reachable from the onboarding stack** — if so, this
  ticket needs to make it reachable from the main worker navigator too
  (e.g. push it as a modal/stack screen from `ProfileScreen`, passing
  whatever param it needs to return here afterward rather than
  continuing the onboarding sequence).

**Acceptance criteria**
- Worker Profile shows live gradient hero with correct name/photo/badges/
  rating/jobs-completed, a 2-stat card, an editable services list (add and
  remove both persist and survive a relaunch), and a certifications list
  that reflects a newly-added certification after returning from the add
  flow.
- Attempting to remove the worker's last remaining category is blocked
  with a visible message, not silently rejected or crashing.
- ID-verification/Certified badges reflect real `id_status`/approved
  `Certification` state, not placeholder data.

**Tests**
- `categoryGuard.ts`: `canRemoveCategory` returns `false` for a
  single-element array, `true` for 2+, doesn't mutate input.
- No rendering tests for the screen itself, per project policy.

---

### T6 — Customer Profile screen redesign (incl. Saved addresses CRUD) ✅ Done

**Implementation notes:** built as planned, with these calls made:

- **New `@prizm/api` `customer.ts`**: T2 built the `GET
  /api/auth/customer-profile/` backend endpoint but no frontend function
  for it existed yet (out of T2's/T4's scope) — added `getCustomerProfileStats`
  here for symmetry with `worker.ts`, rather than folding it into `auth.ts`.
- **One screen for add and edit**: `AddressFormScreen.tsx` takes an
  optional `route.params.address` — same fields either way, only the
  submit call (`createAddress` vs `updateAddress`) differs. Avoided a
  second near-duplicate screen.
- **GPS re-capture confirmed on both add and edit**, per the PRD's
  resolved decision and its own flagged open risk: the location-capture
  `useEffect` always runs on mount regardless of whether `editingAddress`
  is set, so editing just the label does silently refresh the stored
  coordinates to the phone's current position — reverse-geocode prefill
  of the address *text* field only happens for a brand-new address though
  (editing keeps the existing typed address text as the initial value;
  only the coordinates silently refresh, not the text the customer wrote).
- **`AddressForm` registered on `RequestNavigator`'s stack** (not
  `RootTabs`), `presentation: "modal"`, matching `RequestSubmissionScreen`'s
  existing convention — `ProfileScreen` is already nested under that same
  navigator via `Tabs`, so `navigation.navigate("AddressForm", ...)` just
  works with no additional wiring.
- **Delete confirmation** uses React Native's built-in `Alert.alert` — the
  ticket's "reuse whatever existing confirm-dialog convention this app
  already has" turned out to have no existing convention to reuse (grepped
  both apps for `Alert.alert`: zero hits; the worker's cancel-job flow is a
  full reason-picker screen, not a simple confirm dialog) — `Alert.alert`
  is the standard RN idiom for this and needed no new dependency.
- Customer hero's stat card intentionally repeats "Member since" (also
  shown as the hero's own subtitle line) — this looked like a mistake at
  first glance but matches the C8 mockup exactly (both the hero subtitle
  and the stat card show it).
- `formatMemberSince` duplicated into `apps/customer/src/profile/`
  (own test file) rather than shared with the worker app's copy from T5 —
  same "don't force an abstraction across the one place it's used twice"
  call as T1's jobsTab helpers.
- Both apps typecheck clean; customer Jest suite now 23/23 (3 new:
  `formatMemberSince`); worker suite re-checked, still 49/49 (shared
  `packages/api` changed). Verified the two new/changed backend-facing
  paths live against the local Docker backend directly (not just T4's
  generic address CRUD, but this ticket's exact usage): created a
  throwaway customer with one completed + one cancelled job, confirmed
  `GET /api/auth/customer-profile/` returns `{"requests_completed": 1}`
  (cancelled job correctly excluded), confirmed `date_joined` present on
  `/api/auth/profile/`, and re-ran the address create/delete round trip.
  Test user cleaned up afterward.
  **Same click-through gap as T5**: no customer dev-client build exists
  on the available iOS Simulator (only the worker app's is installed, and
  building a fresh one is a multi-minute native build, not attempted here
  since even then the same tap-injection blocker from T5 would apply) —
  the actual rendered screen is unverified beyond code review; worth a
  manual pass alongside T5's.

**Depends on:** T2, T3, T4.
**Touches:** `apps/customer/src/screens/ProfileScreen.tsx`, new address
add/edit UI (a modal/sheet or a pushed screen — implementer's call, note
which and why), `apps/customer/src/navigation/*.tsx` if a new screen route
is added rather than a modal.

- Replace the current screen body with: `ProfileHero` (variant `customer`)
  fed from the customer-profile fetch (photo, name, "Member since ..."
  subtitle — no badges, no rating) → `StatCard` (Requests completed,
  Member since) → Saved addresses section → Account section (Log out
  only).
- **Saved addresses**: list from `listAddresses` (T4), each row = label +
  address text + pin icon, tap → edit form (same fields as add). "+ Add
  address" opens a form: label (freeform text), address text (freeform),
  location captured from the device's current GPS at save-time via the
  same `expo-location` call already used in `RequestSubmissionScreen` (no
  new permission-prompt UX — reuse the existing pattern verbatim). Delete
  via a confirm-before-destructive-action pattern (reuse whatever existing
  confirm-dialog convention this app already has, e.g. the cancel-job
  flow) — call `deleteAddress` (T4) on confirm.
- No "type" differentiation (Home/Work aren't special-cased) — every row
  uses the same generic pin icon, per PRD non-goals.

**Acceptance criteria**
- Customer Profile shows live hero (photo/name/member-since), a 2-stat
  card with real numbers, and a Saved-addresses list supporting add, edit,
  and delete, each persisting and surviving a relaunch.
- Deleting an address requires confirmation first.
- Adding/editing an address correctly re-captures GPS at save-time (per
  PRD's resolved decision — not stale/cached coordinates from an earlier
  screen visit).

**Tests**
- None expected for the screen/form UI itself, per project policy — if
  any pure logic gets extracted (e.g. address-list sorting/formatting),
  unit test that specifically.

---

### T7 — Saved-address picker in `RequestSubmissionScreen` ✅ Done

**Implementation notes:** built as planned. Extracted the selection logic
as `apps/customer/src/request/applySavedAddress.ts` (`Address →
{address, coords}`) with one test — genuinely trivial, but cheap to
extract and keeps the pattern consistent with T5/T6's other pure-function
extractions. Fetches `listAddresses` in its own plain `useEffect` on
mount (this screen is presented fresh each time as a modal, not
focus-tracked, so it follows the same mount-time-fetch pattern the
screen's existing `listCategories`/location effects already use — no
`useFocusEffect` needed here unlike T5/T6's persistent tab screens). The
picker row (horizontal scroll of label chips) renders only when
`savedAddresses.length > 0`, placed directly under the "Location" caption
and above the GPS-derived address display, per the PRD. Selecting a chip
sets `isEditingAddress` back to `false` too (not just `address`/`coords`)
so a customer who had tapped "Edit" on the free-text field first doesn't
end up with a stale inline text editor still open over the newly-selected
value. Typecheck clean; customer Jest suite now 24/24 (1 new). Verified
Metro's actual bundler compiles the customer app with this ticket's
changes with zero errors (same real-bundle-fetch-and-grep check as T5,
against the customer app's own dev server on port 8082) — same live
click-through gap as T5/T6 applies here too (no customer dev-client
build available to tap through in this session).

This closes out the `profile-redesign` PRD — all 7 tickets done.

**Depends on:** T4.
**Touches:** `apps/customer/src/screens/request/RequestSubmissionScreen.tsx`,
new `apps/customer/src/request/` helper if selection logic is non-trivial
enough to extract.

- On screen mount/focus, fetch the customer's addresses via `listAddresses`
  (T4). If the list is non-empty, show a compact "Use a saved address"
  control above the existing free-text address field; if empty, the
  control doesn't render at all (no empty-state clutter on a screen this
  frequently used).
- Selecting a saved address sets `setAddress(saved.address_text)` and
  `setCoords({ latitude: saved.latitude, longitude: saved.longitude })` —
  both remain the same plain editable state as today afterward (per PRD
  §5c, a customer can pick "Home" and then hand-edit the text without any
  special-casing elsewhere in the screen).

**Acceptance criteria**
- A customer with ≥1 saved address sees the picker; a customer with none
  doesn't.
- Selecting an address fills both the address text and the coordinates
  used on submit, and either remains editable afterward.
- Submitting a request after picking a saved address behaves identically
  to submitting one with manually-entered address/coords (no special-cased
  submit path).

**Tests**
- If the selection-handling logic is extracted as a pure function (e.g.
  `applySavedAddress(saved: Address) -> { address: string, coords:
  Coords }`), unit test it. If it's inlined as a one-line `onPress`, no
  test needed — trivial wiring.

---

## Suggested implementation order

T1 and T2 (both backend, independent of each other) → T3 (independent,
can happen in parallel with T1/T2) → T4 (needs T1's endpoints to be
meaningful) → T5 (needs T2 + T3; independent of the customer-side work) →
T6 (needs T2 + T3 + T4) → T7 (needs T4; natural follow-on to T6 but not
strictly dependent on it — could be done right after T4 if convenient).
