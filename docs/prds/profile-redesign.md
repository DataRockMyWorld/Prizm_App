# PRD: Profile Redesign (Worker + Customer)

## 1. Summary

T3 (`customer-jobs-tab-and-profile-editing`, shipped) gave both apps' Profile
tabs a plain avatar + editable name — a functional floor, not a finished
screen. The user has since shared a fuller hi-fi mockup (source:
`Prism Auth Flow - HiFi.dc-3.html`, screens **W8** worker profile and **C8**
customer profile) that adds real credibility and utility content: a gradient
hero header, Verified/Certified badges + star rating + jobs-completed count
(worker), a 2-stat card, a "Services offered" tag editor, a Certifications
list with an add flow, and — customer side — a 2-stat card plus full CRUD
**Saved addresses**, wired into the request-submission flow. This PRD scopes
that redesign for both apps.

## 2. Current state (as of 2026-08-23)

- **`apps/worker/src/screens/ProfileScreen.tsx`** (93 lines): `Screen` →
  title → `ProfileHeader` (avatar + inline-editable name, shared component)
  → a `Card` with phone number + an ID-verification `Badge` → "Log out"
  `Button`. No gradient hero, no stats, no services list, no certifications
  list.
- **`apps/customer/src/screens/ProfileScreen.tsx`** (64 lines): same shape,
  minus the ID badge (customers have no ID-verification concept).
- **`packages/ui/src/components/ProfileHeader.tsx`** (154 lines, T3's
  deliverable): avatar tap → `onPickPhoto`; name row tap "Edit" → `TextField`
  + Save/Cancel, `onSaveName` throws → inline error. Both screens just wire
  this to `updateProfile()` from `@prizm/api`. **This inline-edit UX is kept
  as-is per this PRD's decision below** — no separate edit screen.
- **Backend models** (`backend/accounts/models.py`,
  `backend/jobs/models.py`, `backend/services/models.py`):
  - `User`: `phone_number, role, full_name, photo, liability_acknowledged_at,
    biometric_enabled, is_active, is_staff, date_joined` — `date_joined` is
    already usable as-is for "member since."
  - `WorkerProfile`: `user (1:1), categories (M2M → ServiceCategory —
    "services offered" already exists as a field), id_document, id_status,
    id_reviewed_at/by, id_rejection_reason, is_online, last_location,
    last_location_updated_at, subscription_status, created_at, updated_at`.
    No rating or jobs-completed field — must be computed.
  - `CustomerProfile`: just `user, created_at, updated_at`. No stats fields.
  - `Certification`: `worker (FK), category (FK), document, status,
    reviewed_at/by, rejection_reason, created_at, updated_at`.
    `unique_together = (worker, category)` — one cert per category, so
    "add another certificate" naturally means a different category.
  - `JobRequest`: has `status`, `worker`, `customer`, `agreed_price`, etc.
  - `Rating`: `job (1:1 → JobRequest), stars (1-5), comment, created_at`. No
    aggregate/average computed anywhere yet.
  - **No `Address` model exists anywhere** — Saved addresses is fully
    greenfield.
- **Existing, reusable-as-is backend endpoints**:
  - `GET /api/services/categories/` (`ServiceCategoryListView`) — full
    category list, used for the "+ Add" service-tag picker.
  - `GET/POST /api/auth/certifications/` (`CertificationListCreateView`,
    scoped to `request.user.worker_profile`) — used for the Certifications
    list and its add flow (the existing onboarding upload screen, already
    built, gets a second entry point from here — see §5a).
  - `PATCH /api/auth/worker-profile/` (`WorkerProfileView` +
    `WorkerProfileSerializer`) — already supports patching `categories`
    (M2M), used for the Services-offered editor.
  - `PATCH /api/auth/profile/` — already used by T3 for photo/name, unchanged
    by this PRD.
  - **No stats/aggregate endpoint exists** — confirmed no `Count`/`Avg`
    usage relevant to worker/customer stats anywhere in `jobs/views.py`.
    Fully greenfield (see §6).
- **`apps/customer/src/screens/request/RequestSubmissionScreen.tsx`**:
  `address` is a plain `useState<string>` (free text) fully separate from
  `coords: {latitude, longitude} | null` (from `expo-location`);
  `handleSubmit` sends both independently. A saved-address picker can set
  both from a selection without touching the rest of the screen.
- **`@prizm/api`**: one file per resource (`auth.ts`, `worker.ts`,
  `catalog.ts`, `jobs.ts`, `client.ts`), re-exported via `index.ts`. Typed
  interface + one function per endpoint, `apiRequest<T>(path, {method,
  token, body})`. New `address.ts` follows this convention.
- **`packages/ui/src/components/`**: `Avatar, Badge, BrandHeader, Button,
  Card, Checkbox, GradientBackground (brand-gradient LinearGradient
  wrapper), OtpInput, PinDots, ProfileHeader, ProgressBar, Screen,
  SplashView, TextField, ThemedText, UploadTile`. `GradientBackground`
  already exists — the hero's gradient background needs no new primitive,
  just a new composed component. **No `StatCard`/stat-tile component
  exists yet** — new for this PRD.

## 3. Goals

- **Worker Profile**: gradient hero (photo, name, location + categories
  line, Verified + Certified badges, star rating + jobs-completed count),
  2-stat card (Jobs / Member since), an editable "Services offered" tag
  list, a Certifications list (status-aware) with an add flow, Account
  section (Log out).
- **Customer Profile**: calm hero (photo with soft gradient ring, name,
  member since), 2-stat card (Requests completed / Member since), full CRUD
  **Saved addresses**, Account section (Log out).
- New `Address` model + CRUD API, and a saved-address picker wired into
  `RequestSubmissionScreen`.
- New computed stats surfaced via the existing profile endpoints (see §6 —
  no new endpoint needed).

## 4. Non-goals (explicitly out of scope for this PRD)

- **"On-time %" stat** — dropped entirely. No honest definition exists
  without a scheduling/appointment concept in the data model (same
  reasoning as earlier PAID/earnings-language fixes). Stat cards are 2-up,
  not 3-up.
- **Separate "Edit profile" screen** — the mockup's Account-section row is
  dropped; inline hero editing (T3's shipped pattern) is kept and extended
  into the new hero, per the resolved question above.
- **Certification deletion** — Certifications list is add-only in this PRD,
  per the resolved question above. No delete/revoke UI for approved or
  pending certifications.
- **Map-based address picker / autocomplete** — Saved-address creation uses
  device GPS only, matching `RequestSubmissionScreen`'s existing pattern.
  No new maps SDK integration.
- **Address "type" differentiation** (special Home/Work icons or behavior)
  — labels are freeform text; a generic pin icon is used for every entry,
  matching the mockup.
- Phone-number change (still needs its own OTP-reverification flow — not
  bundled here, consistent with the prior PRD's scoping).
- Biometric-toggle UI (still no user-facing entry point).
- Chat/Messages tab (unrelated, not-yet-started build-order step).
- Payments / push notifications (unrelated build-order steps).

## 5. User flow

### 5a. Worker Profile

- **Hero** (`GradientBackground`-based, full-bleed): avatar (tap → same
  `onPickPhoto` flow as today), name (tap → same inline edit as today,
  reusing `ProfileHeader`'s edit affordance inside the new hero rather than
  duplicating it), a location + categories subtitle line, `Verified` badge
  (from `id_status`, existing logic) and `Certified — <category>` badge(s)
  (from approved `Certification`s), star rating + "N jobs completed" line
  (new computed fields, see §6).
- **Stat card** (new `StatCard` primitive, 2-up): **Jobs** (completed count)
  · **Member since** (`date_joined`, formatted "Mon 'YY").
- **Services offered**: chips for each of the worker's current
  `categories`, each removable (×), plus a "+ Add" chip opening a picker
  sheet listing all `ServiceCategory` not already selected. Both actions
  `PATCH /api/auth/worker-profile/` with the updated `categories` list.
  **A worker cannot remove their last remaining category** — attempting to
  remove the only chip is blocked with an inline message ("You need at
  least one service to stay matchable"), since an empty category set would
  make the worker unmatchable by the matching engine.
- **Certifications**: list of the worker's `Certification`s, each row
  showing category, document name/date, and a status indicator (approved =
  checkmark, matching mockup; pending/rejected = existing `Badge` tone
  reused from the onboarding flow, not literally invented here). "+ Add
  another certificate" routes into the **existing** certification-upload
  screen (already built during onboarding, reused as-is per PROGRESS.md's
  note that this is a clean second entry point) and returns to this list on
  completion — this also incidentally resolves the previously-noted
  "one-cert-per-visit" onboarding limitation, since the list view is
  inherently repeat-friendly (backend already allows one cert per category
  via `unique_together`).
- **Account**: "Log out" only (no "Edit profile" row — see Non-goals).

### 5b. Customer Profile

- **Hero**: calm/white background, avatar with a soft gradient ring (photo
  editing unchanged from today), name (inline edit, same pattern), "Member
  since <Month 'YY>" subtitle. No badges, no rating — customers have no
  credibility content to show.
- **Stat card** (2-up): **Requests completed** · **Member since**.
- **Saved addresses**: list of the customer's `Address` rows (label +
  address text + pin icon, tap → edit form), plus "+ Add address" opening a
  form: label (freeform text, e.g. "Home"/"Work"/anything), address text
  (freeform, same field shape as `RequestSubmissionScreen`'s existing
  `address` state), and location captured from the device's current GPS at
  save-time (same `expo-location` call already used in the request flow —
  no new permission prompt UX to design). Edit form reuses the same
  fields (re-capturing GPS on save is acceptable — this isn't a
  precision-critical flow). Delete via a confirm-before-destructive-action
  pattern (existing convention elsewhere in the app, e.g. cancel-job flow).
- **Account**: "Log out" only.

### 5c. Saved-address picker in the request flow

- `RequestSubmissionScreen` gains a compact "Use a saved address" control
  above the existing free-text address field (only shown if the customer
  has ≥1 saved address). Selecting one sets `setAddress(saved.address_text)`
  and `setCoords({latitude: saved.lat, longitude: saved.lng})` — both
  remain plain editable state afterward, so a customer can pick "Home" and
  then tweak the text (e.g. add "gate code 1234") without any special-casing
  in the rest of the screen.

## 6. Technical decisions

- **Stats are computed fields on the existing profile serializers, not a
  new endpoint.** `WorkerProfileSerializer` gains `SerializerMethodField`s
  for `jobs_completed` (`JobRequest.objects.filter(worker=obj,
  status="completed").count()`) and `rating_average`
  (`Rating.objects.filter(job__worker=obj,
  job__status="completed").aggregate(Avg("stars"))`, null-safe if no
  ratings yet). `CustomerProfileSerializer` gains `requests_completed`
  similarly. `date_joined` already exists on `User` and is already exposed
  wherever the profile is serialized — no new field needed for "member
  since." This avoids a second network round-trip on Profile-tab load and
  keeps the stats trivially in sync with whatever profile data the screen
  already fetches.
- **New `Address` model**, FK'd to `User` (not `CustomerProfile`) —
  matches this codebase's existing pattern of FK'ing directly to `User`
  for anything that isn't strictly 1:1, and keeps the door open (not
  built, just not foreclosed) if a future non-customer use ever needs
  saved locations. Fields: `user (FK), label, address_text, location
  (PointField), created_at, updated_at`. Standard REST CRUD:
  `GET/POST /api/accounts/addresses/`,
  `GET/PATCH/DELETE /api/accounts/addresses/<id>/`, scoped to
  `request.user` (list/detail both filter on owner — a user must never see
  or edit another user's saved address).
- **New `packages/api/src/address.ts`** following the existing
  one-file-per-resource convention: typed `Address` interface + `listAddresses`,
  `createAddress`, `updateAddress`, `deleteAddress`.
- **New `StatCard` primitive** in `packages/ui/src/components/` — a simple
  2-up (or N-up) row of `{value, label}` cells inside a `Card`, used
  identically by both apps' Profile screens.
- **New `ProfileHero` primitive** in `packages/ui/src/components/`, with a
  `variant: "worker" | "customer"` prop (or equivalent composition) covering
  the gradient-vs-calm background difference and the optional
  badges/rating row — built on top of the existing `GradientBackground` and
  `ProfileHeader` rather than duplicating avatar/name-edit logic.
- **Certifications-list UI reuses the existing onboarding upload screen**
  as a pushed route rather than rebuilding an upload form — the only new
  work is the list view itself and the navigation entry point.

## 7. Testing strategy

Consistent with prior PRDs: backend uses `pytest-django` + `factory_boy`;
mobile uses `jest-expo` + `@testing-library/react-native`, scoped to logic,
not full-screen rendering.

- **Backend**: factory-driven tests for the new stats computed fields
  (correct counts/averages, zero-ratings edge case returns null not a
  crash, only `completed` jobs count) and for `Address` CRUD (ownership
  scoping — a user cannot list, view, edit, or delete another user's
  address; validation on required fields).
- **Mobile**: unit tests for the "can't remove last category" guard logic
  (extracted as a plain function, not inline in the component), and for
  the saved-address-picker → `address`/`coords` state-setting logic in
  `RequestSubmissionScreen` (extracted similarly). No rendering tests for
  the new `ProfileHero`/`StatCard` components themselves, per this
  project's standing policy on pre-pilot screen churn.

## 8. Acceptance criteria (summary — full detail in tickets)

- Worker Profile shows a gradient hero with photo/name/location+categories/
  Verified+Certified badges/rating+jobs-completed, a 2-stat card (Jobs,
  Member since), an editable Services-offered chip list (min-1 enforced),
  and a Certifications list with a working add flow that returns to an
  updated list.
- Customer Profile shows a calm hero with photo/name/member-since, a
  2-stat card (Requests completed, Member since), and a Saved-addresses
  list supporting add/edit/delete, each scoped to the logged-in user only.
- `RequestSubmissionScreen` offers a saved-address picker (when addresses
  exist) that pre-fills both the address text and coordinates, remaining
  fully editable afterward.
- Inline avatar/name editing (T3's existing UX) still works unchanged
  inside the new hero on both apps.
- All new backend endpoints reject cross-user access to another user's
  `Address` rows.

## 9. Open risks / follow-ups

- `ProfileHero`'s exact worker-vs-customer visual delta (gradient hero vs.
  calm hero with a "soft gradient ring" on the avatar) is described from a
  low-fidelity wireframe pass (per the mockup source file's own note:
  "Low-fidelity wireframes") — worth a quick visual gut-check with the user
  once a first pass exists, same as happened for the worker Jobs tab.
- Pending/rejected certification status-pill treatment in the new list
  reuses existing `Badge` tones by inference, since the mockup only shows
  the approved (checkmark) state — confirm the pending/rejected look reads
  fine once built, adjust if not.
- Re-capturing GPS on every saved-address *edit* (not just create) means
  editing just the label technically also refreshes the coordinates from
  wherever the phone currently is — acceptable per the resolved
  "device-GPS-only" decision, but flag if this surprises anyone in testing
  (e.g. editing a "Work" address's label while at home would silently move
  its pin).
