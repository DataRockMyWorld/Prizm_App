# Tickets: App Store Readiness — Verification Redesign, Account Deletion, Compliance Tracking

See `docs/prds/app-store-readiness.md` for full context, goals/non-goals, and
reasoning behind the technical decisions referenced here. Hi-fi reference:
`docs/design/prism-auth-flow-hifi.html`, screens 5a/5b, 7–10.

Two open copy/content questions block T2 and T4 from being copy-final — see
each ticket's note. Implement the structure regardless; swap in final copy
once answered.

---

### T1 — Basic Profile: role-conditional name field ✅ Done

**Implementation notes:** built as planned, with two additions beyond the
original ticket text: (1) `packages/auth-flow` had no test infrastructure
at all before this (no `jest.config.js`/`babel.config.js`/test script) —
added the same minimal Node-environment setup `packages/api` already uses,
since `getNameFieldCopy` has zero RN/expo dependencies and needs none of
`packages/api`'s `expo-constants` mocking. (2) The wireframe's worker label
is visually two-tone ("Full name" bold, "(as it appears on your ID)"
muted) — shipped as a single uniformly-bold `ThemedText` instead, since the
ticket's own function signature returns one `label: string`, not
structured parts; a two-tone treatment would need that contract changed
first. Flagged, not silently deviated from — revisit if the visual
distinction matters enough to warrant it.

**Depends on:** none. **Touches:** `packages/auth-flow/src/screens/
ProfileScreen.tsx`.

- Read `role` from `useAuth().profile?.role` (already populated by this
  point in the flow — see PRD §2, no prop-threading through
  `PostAuthNavigator` needed).
- Extract a small pure function (e.g. `getNameFieldCopy(role: Role):
  {label: string | null; placeholder: string}`) rather than branching
  inline in JSX — this is the one piece of new logic in this ticket and
  should be unit-tested directly.
  - `customer` → `{label: null, placeholder: "Full name"}` (unchanged from
    today).
  - `worker` → `{label: "Full name (as it appears on your ID)",
    placeholder: "e.g. Jane M. Nghidinwa"}`.
- Render the label above the `TextField` only when non-null (customer path
  keeps today's layout exactly).

**Acceptance criteria**
- Worker onboarding shows the new label + placeholder; customer onboarding
  is visually unchanged.
- Still a single `TextField`, no first/last split.

**Tests**
- `getNameFieldCopy("worker")` and `getNameFieldCopy("customer")` return
  the expected pairs (`packages/auth-flow` or wherever its test setup
  lives, matching `jest-expo` convention already used elsewhere).

---

### T2 — ID verification: instructions screen + upload screen split ✅ Done

**Implementation notes:** built as planned, with two deviations from the
ticket text: (1) **no new image asset needed** — the wireframe's "example"
card is itself built entirely from CSS shapes (a schematic ID-card mockup:
grey frame, white card, a photo-placeholder box, four text-line bars), not
a real image, so `IdVerificationInfoScreen` replicates that with plain
`View`s instead of shipping/sourcing a static asset. (2) **Skipped the
"Tap to zoom" affordance** shown in the wireframe on that same card — since
it's a schematic with no real detail to reveal, a zoom action would be a
no-op dressed up as a real feature; the card is fully static instead. Both
noted in-code as intentional adaptations, not oversights. The open
"Privacy policy" link question (PRD §6/§9) is still unresolved — shipped as
an `Alert.alert("Privacy policy", "Coming soon.")` placeholder rather than
silently pointing it at Terms & liability, with a code comment pointing
back to the PRD. `IdUpload` no longer has `presentation: "modal"` on its
own `Stack.Screen` — only the new `IdVerificationInfo` entry point does;
`IdUpload` is now a plain push within that same modal flow (standard
iOS modal-flow pattern: one presentation, further screens push inside it).

**Depends on:** none. **Touches:** `apps/worker/src/screens/onboarding/
IdUploadScreen.tsx`, new `apps/worker/src/screens/onboarding/
IdVerificationInfoScreen.tsx`, `apps/worker/src/navigation/RootNavigator.tsx`,
`apps/worker/src/navigation/types.ts`, a new static image asset.

**Open question, confirm before finalizing copy:** the wireframe's consent
line links "Privacy policy" — no such screen/URL exists yet anywhere in
either app (only "Terms & liability," a different document). Build the
link as a no-op or pointed at Terms & liability temporarily, flagged
clearly in code, until this is resolved (PRD §9) — don't block the rest of
the ticket on it.

- New `IdVerificationInfoScreen`: title "Unlock your earning potential" /
  subtitle "Verify your identity to start accepting paid jobs" (move
  verbatim from current `IdUploadScreen`), "STEP 1 OF 2" + 50%
  `ProgressBar` (move from current screen), a "BEFORE YOU START" tip card
  with the three numbered tips from wireframe screen 7, an example-image
  card (new static asset — a generic illustrative ID-card graphic, not a
  real document) with "Tap to zoom" affordance and caption, "Continue"
  button navigating to `IdUpload`.
- Trim `IdUploadScreen`: add a back arrow (new — no longer the entry
  point), keep "STEP 1 OF 2" + 50% `ProgressBar`, replace title/subtitle
  with "Upload your ID" / "Front and back, as shown in the example",
  replace the current "Tips for a clear photo" card with the new consent
  line (see open question above), keep front/back `UploadTile`s and
  "Submit for Review" unchanged.
- Register `IdVerificationInfo` as the new entry point in
  `WorkerRootStackParamList` (`types.ts`) and `RootNavigator.tsx`, modal
  presentation matching the existing `IdUpload`/`Certifications`/
  `UnderReview` pattern. Update every current `navigation.navigate
  ("IdUpload")` call site (Home's banner, Jobs tab's unverified-state
  cards) to navigate to `IdVerificationInfo` instead, so the instructions
  screen is always seen first.

**Acceptance criteria**
- Tapping "Upload your ID" anywhere in the app lands on the new
  instructions screen first, not directly on the upload form.
- "Continue" → upload screen; "Submit for Review" behavior is unchanged
  from today (front + back required, submits to the same endpoint).
- Back arrow on the upload screen returns to the instructions screen.

**Tests:** none new (pure UI + navigation, consistent with the existing
upload screen having no rendering tests).

---

### T3 — Certifications: instructions screen + upload screen split ✅ Done

**Implementation notes:** built as planned, resolving the open "Verified"
vs "Certified" wording question in favor of "Certified" — matches the
existing app/CLAUDE.md terminology, and the current screen's own subtitle
copy ("...to earn a Certified badge...") already used it correctly, so no
wording conflict once resolved. One deviation: the wireframe's upload
screen shows a "+ Add another certificate" affordance implying multiple
certificates could be added in one session before a single submit — the
actual data model/API (`submitCertification`) is one-category-at-a-time,
and building true multi-add batching is a real feature change, not a
screen-split concern, so it's not included here; flagging it as a
follow-up rather than a silent scope-narrowing. Also added: `Certifications`
now needs *conditional* modal presentation, since it's reached two
different ways (pushed from the new `CertificationsInfo` within the
onboarding flow — plain push, that screen already owns the modal; or
directly from Profile's "+ Add another certificate" with no modal screen
underneath it) — handled via `options={({ route }) => ...}` on its
`Stack.Screen` rather than a single static value. `CertificationsScreen`
also gained a `ScrollView` wrapper it didn't have before (was a plain
`View`), pre-empting the same "content taller than screen, submit button
unreachable" bug already hit and fixed on `IdUploadScreen` earlier this
project — this screen gained enough new content (back arrow, step
indicator, progress bar) to be at real risk of the same issue.

**Depends on:** none (independent of T2, same pattern). **Touches:**
`apps/worker/src/screens/onboarding/CertificationsScreen.tsx`, new
`apps/worker/src/screens/onboarding/CertificationsInfoScreen.tsx`,
`apps/worker/src/navigation/RootNavigator.tsx`,
`apps/worker/src/navigation/types.ts`, `apps/worker/src/screens/onboarding/
IdUploadScreen.tsx` (post-submit target updates to `CertificationsInfo`).

**Open question, confirm before finalizing copy:** the wireframe's subtitle
says certificates earn a "Verified badge," but the shipped app and
CLAUDE.md consistently call this the "Certified — [category]" badge,
reserving "Verified" for ID approval (PRD §6). Use "Certified" (matching
the rest of the app) unless told otherwise — flag this explicitly in the
PR/commit rather than silently shipping either wording unconfirmed.

- New `CertificationsInfoScreen`: "STEP 2 OF 2" + 100% `ProgressBar`,
  "OPTIONAL" badge, title "Add certifications" / subtitle (per the open
  question above), a "TIPS" card (two tips: whole certificate in
  frame/legible; clearly shows the service category), a badge-preview card
  explaining what approval unlocks, "Continue" → `Certifications`.
- **Must preserve the existing `returnTo: "profile"` reuse case**
  (`CertificationsScreen`'s current entry point from the Profile tab's "+
  Add another certificate," `profile-redesign` T5): when reached with
  `returnTo: "profile"`, skip straight to the upload screen — the
  instructions screen is only shown on the first-time onboarding path, not
  every time someone adds a certificate from their Profile. Route param
  needs to carry `returnTo` through `CertificationsInfoScreen` if it's
  ever reached with that param (or, simpler: `CertificationsInfoScreen` is
  only ever navigated to from the onboarding flow itself, and the Profile
  tab's "+ Add another certificate" keeps navigating directly to
  `Certifications` with `returnTo: "profile"` as it does today, bypassing
  the info screen entirely — confirm this is acceptable, it seems like the
  right behavior and requires no new param-threading).
- Trim `CertificationsScreen`: add a back arrow, keep "STEP 2 OF 2" + 100%
  `ProgressBar` + "OPTIONAL" badge, replace title/subtitle with "Upload
  your certificate" / "One per service category you're certified in",
  remove the tips card (moved to the info screen), keep the category
  picker, `UploadTile` (labelled "Certificate — [category]" once a
  category is chosen, per wireframe), "+ Add another certificate," the
  existing orange info card, "Submit for Review," and "Skip for now"
  (only when `returnTo !== "profile"`, unchanged from today).
- Register `CertificationsInfo` in the same places as T2's
  `IdVerificationInfo`. Update the onboarding flow's post-ID-upload
  navigation (`IdUploadScreen`'s `handleSubmit` currently navigates to
  `"Certifications"`) to navigate to `CertificationsInfo` instead.

**Acceptance criteria**
- Onboarding flow (after ID submission) shows the certifications
  instructions screen before the upload form.
- Profile tab's "+ Add another certificate" still skips straight to the
  upload form, unchanged.
- "Skip for now" and "Submit for Review" behavior unchanged from today.

**Tests:** none new (pure UI + navigation).

---

### T4 — Backend: account deletion (anonymize, not hard-delete) ✅ Done

**Implementation notes:** built as planned, with the JWT open question
resolved in code rather than left open: confirmed directly from SimpleJWT's
source (`JWTAuthentication.get_user`) that it already checks `user.is_active`
live from the DB on *every* authenticated request, not just at token
issuance — so no custom `JWTAuthentication` subclass was needed. Setting
`is_active=False` during deletion is sufficient on its own to immediately
reject a pre-deletion access token on its very next use, confirmed both in
tests and live against the running server (same token: 200 before delete,
200 on the delete call, 401 on the very next request). One small refactor
beyond the ticket's own scope: extracted the terminal-status tuple
`(COMPLETED, CANCELLED, DISPUTED)` — previously inline only in
`MessageListCreateView` — into `JobRequest.TERMINAL_STATUSES`, and pointed
`MessageListCreateView` at the same constant, since the guard rail here
needed the identical concept and duplicating business-critical status logic
across two call sites felt like the wrong tradeoff. Chose the "idempotent
= second call returns 400 already-deleted" option from the two the ticket
left open, not a silent 200 no-op — easier to test precisely, and a client
calling delete twice deserves to know the second call did nothing new.

**Depends on:** none. **Touches:** `backend/accounts/models.py` (new
`deleted_at` field + migration), `backend/accounts/views.py`,
`backend/accounts/urls.py`, `backend/jobs/models.py` (new
`TERMINAL_STATUSES`), `backend/jobs/views.py` (refactored to use it), new
`backend/accounts/tests/test_delete_account.py`. No serializer changes
needed — the endpoint returns an empty 200/400 body, not a resource.

- New `User.deleted_at` (`DateTimeField(null=True, blank=True)`) — see PRD
  §6 for why this is a new explicit field rather than overloading
  `is_active`.
- New `DeleteAccountView` (`POST /api/auth/delete-account/` — a POST, not
  DELETE-on-profile, since this isn't a partial update and needs its own
  guard-rail logic distinct from `ProfileView`):
  - `IsAuthenticated`.
  - **Guard rail**: if `request.user` has any `JobRequest` (as customer or
    worker) in a non-terminal status (anything before `completed`/
    `cancelled`/`disputed` — reuse whatever status-set logic already
    exists for "active job" elsewhere, e.g. check `jobs/matching.py` or
    the cancellation-window logic for a reusable status list rather than
    redefining one), return 400 with an explanation instead of proceeding.
  - Otherwise: anonymize in place — `phone_number` → a non-reusable
    tombstone (e.g. `f"deleted-{user.id}-{uuid4().hex[:8]}"`, must still
    satisfy the existing `phone_number_validator` or be exempted from it),
    `full_name = ""`, delete `photo` from storage and clear the field, PIN
    replaced via `set_unusable_password()`, `is_active = False`,
    `deleted_at = timezone.now()`.
  - Blacklist all outstanding refresh tokens for this user (reuse the
    `token_blacklist` infrastructure already added for `LogoutView` — every
    device this user was logged into stops working, not just the one
    that requested deletion).
  - Do **not** touch `JobRequest`/`Message`/`Rating`/`Report`/
    `WorkerProfile`/`CustomerProfile` rows — they stay, now pointing at an
    anonymized `User` (this is the whole point, see PRD §6).
  - Idempotent: calling it again on an already-`deleted_at` user is a
    no-op 200 (or 400 "already deleted" — pick one, test it either way).
- `PinLoginView`/`JWTAuthentication` must reject a `deleted_at`-set user —
  confirm whether `set_unusable_password()` alone already blocks login
  (it does, for password-based auth) and whether JWT auth needs an
  explicit `deleted_at` check too (a still-valid, not-yet-expired access
  token issued *before* deletion would otherwise keep working until it
  naturally expires — decide whether that's acceptable for the 30-min
  access-token window or whether `JWTAuthentication` needs a custom
  subclass checking `deleted_at`; leaning toward yes, given deletion
  should be immediate, but confirm before building blocking on this
  ticket).

**Acceptance criteria**
- A user with no active jobs can delete their account; `phone_number`/
  `full_name`/`photo`/PIN are all scrubbed; `deleted_at` is set.
- A user with an active job cannot delete their account; gets a clear
  400 explaining why.
- The deleted user can no longer log in (PIN or otherwise).
- A `JobRequest`/`Message` involving the deleted user, where the *other*
  party is still active, is unaffected — the other party's job/chat
  history is intact (this is the regression this ticket exists to
  prevent — test it explicitly, don't just trust the design).
- Calling delete twice doesn't error or double-scrub.

**Tests**
- `pytest-django`, `factory_boy`: happy path scrubs all the right fields
  and sets `deleted_at`; guard rail blocks deletion for every non-terminal
  `JobRequest` status, both as customer and as worker; guard rail allows
  deletion once the job reaches a terminal status; a completed job
  involving a *second*, non-deleted user survives with all its `Message`/
  `Rating` rows intact after the first user deletes their account; a
  deleted user's login attempt fails; deleting twice doesn't error; a
  pre-existing access token (if the JWTAuthentication decision above lands
  on "must check `deleted_at`") is rejected post-deletion.

---

### T5 — Frontend: "Delete account" row + confirmation screen ⚠️ Superseded 2026-08-28

**The single-screen confirmation UI built here was replaced by T5b below**,
once an amended wireframe (`docs/design/prism-auth-flow-hifi.html`,
screens D1–D5) specified a real 5-screen flow (role-specific warning →
blocked state → PIN re-confirmation → final red-CTA confirmation →
success) instead. Kept here as historical record, not reverted — the
`Button` `"danger"` variant and the "Delete account" row placement (third
card below Log out) from this ticket both carried forward into T5b
unchanged; everything else in this ticket's `DeleteAccountScreen.tsx` (one
per app) was deleted and rebuilt.

### T5 — Frontend: "Delete account" row + confirmation screen ✅ Done

**Implementation notes:** built as planned, with one addition beyond the
original ticket text: neither app had *any* destructive-styled interactive
primitive before this (confirmed during T4/T5 research — `SettingsRow` has
no danger tone, `Button` had only primary/secondary/ghost) — added a
`"danger"` variant to the shared `packages/ui` `Button` (solid
`colors.danger` background, white label/spinner) rather than hand-rolling
one-off styling twice. `DeleteAccountScreen` shipped as two separate
per-app files (not shared), matching this codebase's established pattern
of duplicating small screens per-app rather than introducing new shared
components for them (see `ChatScreen`/`useMessagePolling`, already
duplicated per-app on purpose) — the only difference between the two is a
couple of words in the "what's kept" copy (customers' vs. workers' history
framing). `getDeleteAccountErrorMessage` extracted as its own tested pure
function in `packages/api` rather than inlined in each screen, so both
apps get identical, correct guard-rail-message handling for free.

**Depends on:** T4. **Touches:** `apps/worker/src/screens/ProfileScreen.tsx`
+ `RootNavigator.tsx` + `navigation/types.ts`, `apps/customer/src/screens/
ProfileScreen.tsx` + `RequestNavigator.tsx` + `navigation/types.ts`, new
`DeleteAccountScreen.tsx` per app, `packages/api/src/auth.ts` (new
`deleteAccount()` + `getDeleteAccountErrorMessage()`, plus new
`auth.test.ts`), `packages/ui/src/components/Button.tsx` (new `"danger"`
variant).

- `deleteAccount(token)` → `POST /api/auth/delete-account/`, typed to
  surface the guard-rail 400's message distinctly from other failures (the
  screen needs to show *why* it was blocked, not a generic error).
- New third `Card` below the existing "Log out" card in both apps' Account
  section (see PRD §5d for placement reasoning) — a single "Delete
  account" row, styled with a clearly destructive tone (this is the first
  destructive action in either app's UI; `colors.danger` already exists as
  a token, used elsewhere for error text — reuse it here for the row
  itself).
- Tapping it opens a confirmation screen (not an `Alert` — explains what
  gets deleted, what's retained and why (the anonymized-record framing
  from PRD §6, in plain language, not implementation detail), requires an
  explicit confirm tap, not just "OK").
- On confirm: call `deleteAccount()`, then call the same `clearSession()`
  flow "Log out" already uses (it already blacklists tokens server-side
  too — though T4's endpoint blacklists everything itself, so this is
  belt-and-suspenders, harmless).
- On the guard-rail 400: show the returned explanation, don't attempt
  `clearSession()`.

**Acceptance criteria**
- "Delete account" is visually distinct from every other row (destructive
  tone), reachable from both apps' Profile → Account section.
- Confirmation screen requires an explicit confirm action; backing out
  changes nothing.
- Successful deletion returns the user to the phone-entry screen, same as
  logout.
- A blocked deletion (active job) shows the backend's explanation and
  leaves the session intact.

**Tests:** logic-level only, per the established convention — e.g. if any
branching logic beyond a direct API call + navigation emerges while
building this (there may not be much), extract and unit-test it; no
rendering tests expected for the confirmation screen itself.

---

### T5b — Account deletion UI, revised: 5-screen flow matching amended wireframe D1–D5 ✅ Done

**Implementation notes:** built as planned, five screens per app
(`DeleteAccountWarningScreen`, `DeleteAccountBlockedScreen`,
`DeleteAccountPinScreen`, `DeleteAccountConfirmScreen`,
`AccountDeletedScreen`), duplicated per app per this codebase's
established small-screen pattern (same reasoning as T5's `ChatScreen`) —
the only differences between the two apps' copy are the erased/retained
bullet lists (customer: saved addresses/payment method vs. worker: ID
document/certificates/payout method, "workers you've hired" vs. plain job
history) and the Blocked screen's "job in progress"/worker-card vs.
"unpaid job"/worker-name-card framing, per the two copy-conflict
resolutions in PRD §5d. Added a `"dark"` `Button` variant (solid
`colors.textPrimary`) to match the wireframe's near-black non-destructive
CTAs (D2/D2b's "Go to the job") — `"danger"` stayed reserved for the one
truly destructive action (D4's "Delete my account"). `PinEntry`/
`PIN_LENGTH` exported from `@prizm/auth-flow`'s index for reuse in D3
outside the auth-flow navigator stack. The Profile row's pre-check
(`listMyJobs()` + `isActiveJobStatus`) and the D4 guard-rail-race fallback
(re-fetch + route to Blocked on a 400) both matched the ticket's spec
exactly with no extraction needed — both are already short, single-purpose
async handlers inline in their screens, not complex enough to warrant
unit-testing as separate pure functions per the project's stated testing
convention (logic worth extracting is branching/transition logic, not a
fetch-then-navigate one-liner). No new tests added for this reason; both
apps' full existing suites (58 worker, 42 customer) plus `packages/api`
(26) and `packages/auth-flow` (2) all still pass, and both apps'
`npx tsc --noEmit` runs clean.

**Live device verification (2026-08-29):** ran the full 5-screen flow on a
physical iPhone for both apps, each with a disposable throwaway account
(new phone number, not the reusable demo accounts), and cross-checked the
backend directly after each deletion (`phone_number` tombstoned,
`is_active=False`, `has_usable_password=False`, `deleted_at` set, and
every `OutstandingToken` for the user found in `BlacklistedToken`) rather
than trusting the UI alone. Caught and fixed one real bug this surfaced:
`DeleteAccountWarningScreen`'s "Continue" and `AccountDeletedScreen`'s
"Return to sign in", in **both** apps, were missing `variant="dark"` and
were rendering in the default primary gradient instead of the wireframe's
`#1c1917` neutral-dark styling (confirmed against
`docs/design/prism-auth-flow-hifi.html`'s D1/D5 markup) — the
`DeleteAccountBlockedScreen`/`DeleteAccountConfirmScreen` buttons already
had explicit `variant` props and were unaffected. Fixed in all four files;
verified live via Metro fast refresh mid-flow, no rebuild needed.

Also hit and resolved two environment issues unrelated to app code, worth
noting for future device-testing sessions: (1) both apps' native iOS
builds had gone untrusted on-device (`"...profile has not been explicitly
trusted by the user"` on launch) after ~7 days without a fresh Xcode
install — fixed by rebuilding via `npx expo run:ios --device` and trusting
the developer profile under Settings → General → VPN & Device Management;
(2) the customer app's native project alone had
`ENABLE_USER_SCRIPT_SANDBOXING = YES` where the worker app's had `NO`,
which broke its "Bundle React Native code and images" build phase under
Xcode's script sandbox — fixed by aligning both `project.pbxproj` files.

**Depends on:** T4 (unchanged). **Supersedes:** T5's `DeleteAccountScreen.tsx`
(deleted, replaced by the five screens below). **Touches:** both apps'
`ProfileScreen.tsx` (row now pre-checks before navigating), both apps'
navigation types/navigator files, five new screens per app, `packages/
auth-flow/src/index.ts` (newly exports `PinEntry`/`PIN_LENGTH` for reuse
outside the auth-flow stack).

- **`DeleteAccountWarningScreen`** (D1/D1b): role-read from
  `useAuth().profile?.role` (same pattern as T1), "What is erased" /
  "What is retained" bullet lists per role — **erased list must say
  "anonymized and retained," not "erased,"** for job history/ratings/
  messages, per the PRD §5d copy-conflict resolution. "Continue" (neutral
  dark, not `danger` — not the destructive step yet) → PIN screen; "Keep
  my account" → `navigation.goBack()`.
- **`DeleteAccountBlockedScreen`**: takes the blocking `JobRequest` as a
  route param (passed from the Profile row's pre-check, see below).
  Role-specific title/body copy ("You have a job in progress" / "We
  cannot delete your account while a job is open..." for workers; "You
  have an unpaid job" / "...while a payment is outstanding..." for
  customers — cosmetic only, both roles use the identical backend guard
  rail). A tappable card showing that job's real category/other-party
  name/date, routed via the existing `getJobsTabRoute` helper (don't
  invent new routing logic for this one card). "Back to profile" →
  `navigation.navigate("Tabs", { screen: "Profile" })` (or equivalent).
- **`DeleteAccountPinScreen`** (D3): "STEP 1 OF 2", `PinEntry` from
  `@prizm/auth-flow` (now exported), calls `login(profile.phone_number,
  pin)` on 4 digits entered — success advances to the final confirmation
  screen (discard the returned tokens, see PRD §6); failure shows
  "Incorrect PIN — try again," clears the entry, same UX as
  `LoginPinScreen`'s existing error handling. Inherits `PinLoginThrottle`'s
  lockout protection automatically, since it's the same endpoint.
- **`DeleteAccountConfirmScreen`** (D4): "STEP 2 OF 2", "This cannot be
  undone" body copy, an account-summary card (name, phone, member-since —
  reuse whatever's already on the Profile hero rather than re-fetching),
  **`variant="danger"` "Delete my account"** (this is the actual
  destructive action — calls `deleteAccount()`), "Cancel". On the guard
  rail's 400 here (the race-condition case — job went active *during* this
  flow), navigate to `DeleteAccountBlockedScreen` instead of just showing
  an inline error, so the experience stays consistent regardless of when
  the block is discovered.
- **`AccountDeletedScreen`** (D5): checkmark, confirmation copy per PRD
  §5d, "Return to sign in" → `clearSession()` (same effect as T5's
  original confirm action, just moved to the end of the new flow).
- **Profile row pre-check**: tapping "Delete account" calls `listMyJobs()`
  (already used by the Jobs tab) and filters with the app's own existing
  `isActiveJobStatus` — any match routes straight to
  `DeleteAccountBlockedScreen` with that job; otherwise routes to
  `DeleteAccountWarningScreen`. This is a UX shortcut only; the backend
  guard rail (T4) remains the real enforcement either way.

**Acceptance criteria**
- A user with no active job sees Warning → PIN → Final confirmation →
  Success, in that order, and ends up logged out at phone-entry.
- A user with an active job tapping "Delete account" goes straight to the
  Blocked screen, never seeing the Warning screen.
- An incorrect PIN on the confirmation step is rejected with a clear error
  and does not proceed.
- If a job becomes active between the pre-check and the final confirm tap,
  the final `deleteAccount()` call's 400 routes to the Blocked screen
  rather than a bare inline error.
- Both apps' Warning-screen copy correctly says retained records are
  anonymized, not erased.

**Tests:** logic-level only, matching this project's standing convention.
If the pre-check (job-list → route decision) or the PIN-verify success/
failure branching end up as more than trivial inline calls once built,
extract them as plain functions and unit-test those — no rendering tests
for any of the five screens themselves.

---

### T6 — Chat safety: report-message / block-user — blocked, design pass needed

**Status:** ⏸️ Blocked — no design exists yet for this. **Depends on:** a
design pass (out of scope for this ticket set — see PRD §4/§9). **Touches:**
nothing yet.

This exists as a tracked placeholder, not a scoped ticket — mirrors how
`push-notifications` T0 tracks a blocker without pretending T5–T7 can be
scoped ahead of it. Do not start building against the current-state notes
below; they exist so the eventual design pass doesn't have to rediscover
them.

**What's already known** (from PRD §2/§6, confirmed in this session):
- Neither app has a per-message component (`ChatScreen.tsx`, both apps,
  renders message bubbles inline) — adding a long-press/report affordance
  means either extracting one or wrapping the existing inline `View` in a
  `Pressable`.
- `Report` (`backend/jobs/models.py`) is job-scoped with a fixed category
  enum (no_show/safety_concern/quality_of_work/pricing_disagreement) — a
  message-scoped report needs either a nullable `message` FK + its own
  category enum (spam/harassment/etc.), or a separate model.
- No `Block` model exists anywhere — fully greenfield.
- Apple Guideline 1.2 (Safety — User-Generated Content) is the actual
  driver: both report-content and block-user are named requirements for
  any app with user-to-user communication, distinct from this app's
  existing job-outcome "Report a problem" flow.

**Acceptance criteria:** N/A — re-scope into real tickets once the design
pass happens.

---

## Suggested implementation order

T1, T2, and T3 are independent of each other and of T4/T5 — any order,
though T2/T3 share enough pattern that doing them back-to-back likely
saves time. T4 blocks T5 (needs the endpoint to exist). T6 stays blocked
until its own design pass produces something scopable — don't wait on it
to start T1–T5.
