# PRD: App Store Readiness — Verification Redesign, Account Deletion, Compliance Tracking

## 1. Summary

From a 2026-08-28 design session, three related changes driven by App Store/
Play Store submission requirements, plus a running list of open compliance
questions that block later work. The unifying thread is "what does this app
need before it can actually ship to a store," not a single UI feature:

1. **Verification flow redesign** — the onboarding auth flow drops biometric
   login entirely (already shipped 2026-08-27), gains a role-conditional name
   field on the shared Basic Profile screen, and splits the ID-upload and
   certifications steps into a "how it works" instructions screen followed by
   the actual upload screen, each now carrying tips/example-image/consent
   copy modeled on (but explicitly not copying) Uber's ID-verification
   pattern.
2. **Account deletion** — a hard requirement for both stores, not yet built
   at all.
3. **Chat safety** — Apple Guideline 1.2 requires in-chat report/block for any
   app with user messaging; not yet designed, tracked here as a blocked
   placeholder rather than scoped prematurely.
4. **Compliance tracker** — three open questions (subscription/IAP gray area,
   minimum worker age, Privacy Nutrition Label/Data Safety disclosures) that
   need a decision or process step before/alongside related future work, with
   no code to write yet.

Source: `docs/design/prism-auth-flow-hifi.html` (supersedes any earlier
auth-flow wireframe), screens 1–12b — the numbering referenced throughout
this PRD matches that file's screen labels exactly.

## 2. Current state (as of 2026-08-28)

- **Biometric login: already removed** (2026-08-27, same day as this design
  session but a separate piece of work) — `packages/auth-flow/src/screens/
  BiometricScreen.tsx` deleted, `PostAuthNavigator.tsx` now renders
  `ProfileScreen` directly instead of a two-screen stack,
  `biometric_enabled` dropped from the `User` model/serializer/admin and
  from `packages/api`'s `Profile`/`ProfileUpdate` types, `expo-local-
  authentication` removed from all three `package.json`s. Nothing left to
  do here — noted for completeness since CLAUDE.md's "Auth flow" line
  used to mention it.

- **Basic Profile screen** (`packages/auth-flow/src/screens/
  ProfileScreen.tsx`, 126 lines): one shared component, rendered
  identically by both apps via `PostAuthNavigator` (no role branching
  today). Single `TextField` with `placeholder="Full name"`, no
  role-conditional label. **Role is already known by this point** — the
  wireframe's 5a/5b split needs no new plumbing to detect it: `RegisterView`
  (`backend/accounts/views.py`) takes `role` as part of registration
  (before this screen is ever reached), `establishSessionFromTokens`
  (`packages/api/src/sessionEstablishment.ts`) fetches the full profile
  (including `role`) immediately after registration succeeds, and
  `useAuth().profile?.role` is therefore already populated by the time
  `ProfileScreen` renders. No prop-threading through `PostAuthNavigator`
  needed.

- **ID upload** (`apps/worker/src/screens/onboarding/IdUploadScreen.tsx`,
  167 lines): one screen combining a title/subtitle, front/back
  `UploadTile`s, a static "Tips for a clear photo" card, and "Submit for
  Review" — no separate instructions screen, no example image, no explicit
  consent/privacy-policy copy (current tips card is informational only, not
  framed as consent).

- **Certifications** (`apps/worker/src/screens/onboarding/
  CertificationsScreen.tsx`, 189 lines): one screen combining a category
  picker, a single `UploadTile`, an info card, "Submit for Review", and
  "Skip for now" — same shape issue: no separate instructions screen.
  Already supports `returnTo: "profile"` for reuse from the Profile tab's
  "+ Add another certificate" (`profile-redesign` T5) — any restructuring
  here must preserve that entry point's behavior (it currently skips the
  "Skip for now" link when reached this way; the new instructions screen
  should presumably do the same, TBD in ticket).

- **Worker onboarding navigation** (`apps/worker/src/navigation/
  RootNavigator.tsx` + `types.ts`): `WorkerOnboardingStackParamList` has
  `IdUpload`, `Certifications`, `UnderReview` — all registered as modal
  screens on the root stack (not a separate stack navigator), reachable
  from Home's "Upload your ID" banner and the Jobs tab's unverified state.
  New instructions screens need their own route names here.

- **Profile → Account section** (`apps/worker/src/screens/ProfileScreen.tsx`
  and `apps/customer/src/screens/ProfileScreen.tsx`, near-identical
  structure): one `Card` wrapping a list of `SettingsRow`s (worker: Payout
  method, Notification preferences, Help & support, Safety tips, Terms &
  liability; customer: same minus Payout→Payment method), then a
  **separate** `Card` directly below containing a single custom `Pressable`
  "Log out" row — not a `SettingsRow` instance, styled `colors.primary`
  (not a destructive/red tone), no chevron. `SettingsRow`
  (`packages/ui/src/components/SettingsRow.tsx`): props `{label, detail?,
  onPress, isFirst?}`, no destructive/danger tone variant exists.

- **Chat** (`apps/worker/src/screens/ChatScreen.tsx`, `apps/customer/src/
  screens/request/ChatScreen.tsx`): messages render inline as plain
  `View`s mapped directly from the polled list (`useMessagePolling`,
  duplicated per-app on purpose per its own doc comment) — no extracted
  per-message component to hang a long-press action off yet.
  `Message` (`backend/jobs/models.py`): `job (FK→JobRequest, CASCADE),
  sender (FK→User, CASCADE), text, created_at`. The existing "Report a
  problem" flow (`ReportProblemScreen.tsx` → `ReportJobView`) is
  **job-scoped**, not message-scoped: `Report.category` choices are
  no_show/safety_concern/quality_of_work/pricing_disagreement, with no
  message reference. **No `Block` model exists anywhere.**

- **Backend `User` deletion — no soft-delete exists today.** `User.
  is_active` (standard Django field) is present but not wired to any
  deletion/deactivation flow. FK behavior that matters for account
  deletion, confirmed in `backend/jobs/models.py`:
  - `JobRequest.customer` → **CASCADE** (deleting a customer `User`
    deletes their entire job history)
  - `JobRequest.worker` → `SET_NULL` (deleting a worker preserves the job
    row)
  - `Message.sender` → **CASCADE** (deleting *either* party deletes every
    message they sent, including in jobs where the *other*, non-deleted
    party still has an active record — their chat history gets holes)
  - `Rating` has no direct `User` FK (only `job`, `CASCADE` off `JobRequest`)
  - `Report.reporter` → CASCADE; `CancellationLog.worker` → CASCADE

  **This is a real landmine for "real deletion, not deactivation" if taken
  literally as a SQL `DELETE` on the `User` row** — see §6.

## 3. Goals

- Remove the last references to biometric login from CLAUDE.md (code
  already done) — ✅ handled directly in this same session, see CLAUDE.md's
  "Auth & verification flow updates" section.
- Match the new hi-fi wireframe for: Basic Profile (role-conditional name
  label), ID verification (instructions + upload split), Certifications
  (instructions + upload split).
- Design and ship real, working in-app account deletion, satisfying both
  Apple's and Google's store requirements, without corrupting the *other*
  party's job/message history.
- Give the three open compliance questions a durable, visible home so they
  don't get silently forgotten before submission — without inventing
  answers to questions that are explicitly not yet decided.
- Flag chat safety (report-message/block-user) as real, tracked, blocked
  work — without scoping an implementation ahead of its own design pass.

## 4. Non-goals (explicitly out of scope for this PRD)

- Implementing chat safety itself (report-message/block-user UI + backend)
  — needs its own design pass first; this PRD only creates the tracking
  placeholder.
- Deciding the worker subscription/IAP question, the minimum-age question,
  or producing the actual Privacy Nutrition Label/Data Safety content —
  these are tracked, not resolved, here (§9).
- Any change to the *verified* worker/customer home states (screens 6a–6d,
  12, 12b) — these already match the new wireframe from this session's
  earlier Home/Jobs verification-state work; nothing new needed there.
- Re-litigating the "Under review confirmation" screen (11) — unchanged
  from the current `UnderReviewScreen.tsx`, confirmed matching the new
  wireframe as-is.
- A first/last name field split — explicitly still one field, just
  relabeled per role.

## 5. User flow

### 5a. Basic Profile — role-conditional name field (wireframe 5a/5b)

Same screen, same single `TextField`, same avatar/photo picker, same
liability checkbox — only the label and placeholder change based on
`useAuth().profile?.role`:

- **Customer**: label omitted (as today), placeholder `"Full name"`.
- **Worker**: a small label above the field, `"Full name "` in bold
  followed by `"(as it appears on your ID)"` in a muted weight; placeholder
  `"e.g. Jane M. Nghidinwa"`.

### 5b. ID verification — instructions screen (wireframe 7) → upload screen (wireframe 8)

**Screen 7 (new) — "ID verification · how it works":**
- Step indicator "STEP 1 OF 2" + progress bar at 50% (matches current
  `IdUploadScreen`'s existing `ProgressBar` usage — moves here).
- Title "Unlock your earning potential" / subtitle "Verify your identity to
  start accepting paid jobs" (both already exist in `IdUploadScreen`, move
  here verbatim).
- "BEFORE YOU START" tip card, three numbered tips (front-then-back capture
  order; name/DOB/ID-number visibility; validity/no glare/blur/damage) —
  new copy, replacing the current single "Tips for a clear photo" card.
- An example-image card: a generic illustrative ID-card graphic (**not** a
  real document — needs a new static asset, see §6) with a "Tap to zoom"
  affordance and caption "Example — flat, fully in frame, all text
  legible."
- "Continue" → navigates to the upload screen.

**Screen 8 — "ID upload"** (the existing `IdUploadScreen`, trimmed):
- Back arrow (new — this screen is no longer the entry point).
- Same "STEP 1 OF 2" + progress bar (both screens share the step number —
  confirmed from the wireframe, this is one logical step split across two
  screens, not two steps).
- Title "Upload your ID" / subtitle "Front and back, as shown in the
  example" (replaces current title/subtitle).
- Front/back `UploadTile`s — unchanged from today.
- **New consent line**, replacing the tips card (which moved to screen 7):
  "By submitting, you're allowing Prism's team to manually review this
  document to verify your identity. **Privacy policy**" (linked text —
  needs a destination; see §6 open question).
- "Submit for Review" — unchanged behavior.

### 5c. Certifications — instructions screen (wireframe 9) → upload screen (wireframe 10)

Same split pattern as 5b:

**Screen 9 (new) — "Certifications · how it works":** "STEP 2 OF 2" +
100% progress bar, "OPTIONAL" badge, title "Add certifications" / subtitle
(current copy, minor wording — verify against wireframe's "earn a Verified
badge" phrasing, which conflicts with this codebase's established
"Certified badge" terminology; **flagged as a copy question, not silently
resolved — see §6**), a "TIPS" card (whole certificate in frame/legible;
clearly shows the service category), a badge-preview card explaining what
approval unlocks, "Continue."

**Screen 10 — "Certificate upload"** (existing `CertificationsScreen`,
trimmed): category picker + `UploadTile` (now labelled per-category, e.g.
"Certificate — Cleaning"), "+ Add another certificate," the existing
orange "not required to go online" info card, "Submit for Review," "Skip
for now" — all close to current behavior, mainly losing the tips card
(moved to screen 9) and gaining a back arrow.

### 5d. Account deletion (revised 2026-08-28 — matches amended wireframe D1–D5)

New row in Profile → Account, both apps — unchanged placement (**third
card**, below the existing settings `Card` and "Log out" `Card`). The
confirmation flow itself is now a five-screen sequence (was a single
explanation-plus-confirm screen; that version is superseded), matching
`docs/design/prism-auth-flow-hifi.html` screens D1–D5:

1. **Warning** (D1 worker / D1b customer) — role-specific "What is
   erased" / "What is retained" lists, neutral-dark "Continue" (not red —
   this isn't the destructive step yet) → PIN confirmation; "Keep my
   account" → back to Profile.
2. **Blocked** (D2 worker / D2b customer) — shown *instead of* the warning
   screen when a guard-rail pre-check finds an active job (see below):
   role-specific reason text, a tappable card linking to the specific
   blocking job, a CTA back into that job/payment flow, "Back to profile".
3. **PIN confirmation** (D3, shared shape, per-app screen) — "STEP 1 OF
   2", re-enter the 4-digit PIN to confirm identity before continuing.
4. **Final confirmation** (D4, shared shape, per-app screen) — "STEP 2 OF
   2", "This cannot be undone", an account summary card, **red** "Delete
   my account" CTA (this is the actual destructive action), "Cancel".
5. **Success** (D5) — checkmark, confirmation copy, "Return to sign in".

**Guard-rail pre-check, client-side**: tapping "Delete account" fetches
the user's own job list (`listMyJobs`, already used by the Jobs tab) and
checks it with each app's existing `isActiveJobStatus` helper (already
built for Jobs-tab grouping) — if any active job exists, go straight to
the Blocked screen with that job's real details, skipping the Warning
screen entirely (no point reading "here's what happens" just to be told
you can't yet). This is a UX pre-check only — the backend's own guard
rail (T4, unchanged) remains the actual enforcement, re-checked again by
the final `deleteAccount()` call itself, so a job that becomes active
*during* the flow (a real if narrow race) still gets caught correctly on
confirm, not silently allowed through.

**Two copy conflicts the amended wireframe introduced, resolved
2026-08-28 (user decision, not silently picked):**
- D1's "What is erased" list states job history/ratings/reviews are
  erased. The backend (T4) anonymizes the account and deliberately keeps
  `JobRequest`/`Message`/`Rating` rows intact — hard-deleting them would
  destroy the *other* party's history for any shared job. **Resolution:
  fix the copy, keep the behavior** — "What is erased" is reworded to say
  job history/ratings/messages are anonymized and retained, not erased
  outright, matching what the system actually and safely does.
- D2b blocks customer deletion specifically on an "unpaid job," distinct
  from D2's worker "job in progress" — but mobile money/payment
  processing isn't built yet (CLAUDE.md step 10, deliberately skipped), so
  there's no real paid/unpaid state to check. **Resolution: same guard
  rail, role-specific copy only** — both roles are blocked by the same
  "any non-terminal job" check (already built/tested in T4); the
  worker/customer copy difference ("job in progress" vs. "unpaid job") is
  cosmetic, not a claim of payment-status detection that doesn't exist.

## 6. Technical decisions

- **Account deletion must anonymize, not hard-`DELETE`, the `User` row.**
  A literal `DELETE` would cascade through `JobRequest.customer` and
  `Message.sender`, destroying the *other* party's job/message history for
  jobs they didn't ask to have erased — a customer deleting their account
  shouldn't blow a hole in a worker's completed-jobs history, and vice
  versa. Recommended approach, reconciling with "real deletion, not
  deactivation":
  - Scrub PII in place: `phone_number` → a non-reusable tombstone value
    (e.g. `deleted-<original-hash>`), `full_name` cleared, `photo` deleted
    from storage and cleared, PIN hash replaced with an unusable value,
    `is_active = False` **and** a new explicit `deleted_at` timestamp (not
    reusing `is_active` alone, since that field's current absence of any
    other meaning makes it ambiguous whether `False` means "deleted" or
    some future "suspended" state).
  - Login is permanently blocked once `deleted_at` is set — this is what
    makes it "real deletion" rather than deactivation (deactivation
    implies reversibility/reactivation by the user or an admin; this
    doesn't).
  - `JobRequest`/`Message`/`Rating`/`Report` rows are left in place
    (satisfies the "legal-retention exception for anonymized
    financial/transaction records" requirement from CLAUDE.md's new
    section, and incidentally also satisfies it for the *other* party's
    ordinary job history, not just financial records) — they just point
    at an anonymized `User`.
  - Needs a new backend endpoint (`DELETE /api/auth/profile/` or a
    dedicated `/api/auth/delete-account/` — naming TBD in ticket) rather
    than reusing the existing `ProfileView` `PATCH`.
- **PIN re-confirmation (D3) reuses the existing login endpoint rather than
  a new "verify PIN" one.** Calling `login(profile.phone_number, enteredPin)`
  a second time mid-session — already authenticated, not establishing a
  new one — returns a fresh token pair on success or fails (401/429) on a
  wrong/locked-out PIN, which is exactly the confirm/reject signal this
  step needs; the fresh tokens themselves are simply discarded, since the
  existing session's tokens remain valid and unrelated to this check. Gets
  the PIN-lockout throttle protection from T-critical (the security audit's
  `PinLoginThrottle`/lockout work) for free, rather than needing to
  reinvent rate-limiting for a second PIN-entry surface.
- **Example-image assets** (ID-verification and certification instructions
  screens) need a new static illustrative graphic — not a real ID
  document, not sourced from a real user. Treat as a small design/asset
  task alongside the ticket, not something to fabricate ad hoc in code.
- **"Privacy policy" link destination** (screen 8's consent line) — no
  privacy-policy screen/URL exists anywhere in either app today (only
  "Terms & liability," which is the liability-acknowledgment text, a
  different document). Needs either a real privacy-policy screen/URL
  before this ships, or the consent copy should point at "Terms &
  liability" instead until a real privacy policy exists — **open
  question, not resolved by this PRD.**
- **Certification badge terminology** — wireframe screen 9 says "Verified
  badge," but CLAUDE.md and the shipped app consistently use "Certified —
  [category]" for certification approval and reserve "Verified" for ID
  approval. Treating this as a wireframe copy inconsistency to confirm
  with the user before implementing, not silently picking one.
- **Chat safety data model** (for whenever its design pass happens, not
  this PRD): `Report` is job-scoped today; a message-scoped report likely
  needs either a nullable `message` FK added to `Report` with its own
  category enum (spam/harassment/etc., distinct from the job-outcome
  categories), or a separate model. No `Block` model exists — blocking a
  user is fully greenfield. Noted here only so the eventual design pass
  starts from accurate current-state, not rediscovered from scratch.

## 7. Testing strategy

- **Basic Profile role-conditional label**: a plain unit test on whatever
  small helper function decides the label/placeholder pair from a role
  string (extract it rather than testing JSX rendering directly, per
  CLAUDE.md's standing testing convention).
- **Account deletion backend**: `pytest-django` — anonymization actually
  clears PII fields and sets `deleted_at`; a deleted user's login attempt
  fails; the active-job guard rail blocks deletion with a non-terminal
  `JobRequest` and allows it once none exist; the *other* party's
  `JobRequest`/`Message` rows survive a deletion untouched (the specific
  regression this whole section exists to prevent); an already-deleted
  account can't be deleted again (idempotency).
- **Account deletion frontend**: logic-level tests only per the
  established convention (screens change shape too often pre-pilot to be
  worth rendering tests) — e.g. a pure function deciding whether the guard
  rail should block, given a list of job statuses.
- **ID/certification instructions screens**: no new logic to test (pure UI
  + navigation), consistent with how the existing upload screens have no
  rendering tests either.

## 8. Acceptance criteria (summary — full detail in tickets)

- Basic Profile shows the correct label/placeholder for each role, still a
  single field.
- ID verification and Certifications are each two screens matching the
  wireframe's copy and layout; existing upload/submit behavior is
  unchanged.
- A worker or customer can delete their account; doing so blocks future
  login for that phone number permanently; the other party's job/message
  history for any shared job survives intact; deletion is blocked while a
  job is active or payment is unresolved, with a clear explanation shown.
- CLAUDE.md, this PRD, and the tickets file are the durable record of all
  of the above — confirmed in this same session.

## 9. Open risks / follow-ups

- **Chat safety (Apple Guideline 1.2)** — tracked as a blocked placeholder
  ticket (T6) pending its own design pass. Do not build ahead of that.
- **Worker subscription/lead-access model vs. Apple IAP** — must be
  resolved before implementing the freemium/subscription model under
  CLAUDE.md's Monetization section. Real job payments themselves are
  exempt (person-to-person real-world services); a paid tier unlocking
  more leads/visibility inside the app is the part in question.
- **Minimum worker age** — leaning toward 18 for the MVP (liability waiver
  assumes a binding contract; the 16–60 range in the original pitch deck
  predates that constraint being noticed), pending a firm decision. No
  age-gating exists or should be built until decided.
- **Privacy Nutrition Label (Apple) / Data Safety form (Google Play)** —
  not a code task, but real submission-blocking work given Prism collects
  ID documents, location, photos, and payment info. Budget time for it
  before the first store submission; revisit once payment/location
  handling is finalized so the disclosure is accurate.
- **"Privacy policy" link target** (§6) — needs a decision before T3 (ID
  upload consent copy) ships with a working link rather than a dead one.
- **Certification badge wording** ("Verified" vs "Certified" in the new
  wireframe, §6) — needs a quick confirmation before T4 (certifications
  instructions screen) locks in copy.
