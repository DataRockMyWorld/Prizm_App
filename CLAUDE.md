# Prism — Project Context

Two-sided service marketplace (Namibia pilot): a Worker app and a Customer
app connecting verified informal-sector workers with households/businesses
needing services (cleaning, plumbing, electrical, etc).

## Stack
- Backend: Django + Django REST Framework, PostgreSQL + PostGIS, Redis
  (cache + Celery broker), Celery (async jobs)
- Mobile: React Native via Expo — two separate apps (`apps/worker`,
  `apps/customer`), sharing a component/design-token package
- Storage: S3-compatible object storage for ID docs, certifications,
  photos (signed URLs, never public)
- Auth: JWT (djangorestframework-simplejwt), phone number + SMS OTP + PIN
  (not passwords) — the only login method, no biometric unlock (removed
  2026-08-28, see "Auth & verification flow updates" below)
- Push: Expo push notifications (FCM/APNs)
- Payments: mobile money integration (provider TBD)

## Brand
Gradient #FE3F2D → #FF6C22 → #FFB255, wordmark gold #FEBD59, Manrope
typeface, rounded cards, bottom tab nav.

## Core business rules (do not deviate without asking)
- **No fixed prices.** Category listings show an estimate range only
  (e.g. "Est. N$150–300"). The actual price is proposed by the **worker**
  on site — after arriving and evaluating the job, *before* work starts
  (changed 2026-09-08, see "Active-job & pricing flow redesign" below;
  was previously proposed after the work was done). The **customer**
  confirms it in-app (or rejects it, which closes the job); work can
  only begin once the quote is confirmed. A later "Report a problem →
  Pricing disagreement" dispute remains the escape hatch if the agreed
  price is contested afterwards.
- **Matching**: sequential single-offer, not browse-and-choose. A job is
  offered to exactly one candidate at a time — the best-ranked eligible
  worker within `MATCHING_RADIUS_KM` (25km), ranked by Certified badge,
  then Verified badge (ID approved), then distance. If they miss the
  60-second response window or decline, the offer moves to the
  next-best candidate, and so on. (Not a true simultaneous broadcast to
  multiple workers at once — see "Matching: future considerations"
  below for a proposal along those lines, deliberately not adopted for
  the MVP pilot.)
- **Verification tiers**: ID upload is mandatory to go online as a worker
  (manual admin review). Certification upload is optional and skippable —
  it only adds a "Certified — [category]" badge once approved; it never
  blocks going online.
- **Liability**: both roles accept a liability acknowledgment during
  onboarding — Prism is a platform connecting independent parties, not an
  employer, not a party to the service agreement.
- **Worker cancellation**: free within 10 minutes of accepting a job, with
  a required reason (Personal emergency / Vehicle or transport issue /
  Job details unclear / Other). After that window, cancellation goes
  through the dispute flow instead — *except* the on-site evaluate step
  (below), where declining is an explicit sanctioned exit.
- **On-site decline**: after arriving and evaluating the job, the worker
  chooses **Accept** (submit a quote) or **Decline**. Declining requires
  a reason and closes the job (terminal `declined`); the customer is
  notified and can submit a fresh request — no automatic rematch. Valid
  even outside the 10-minute cancel window.
- **Job-request response window**: 60 seconds to accept/decline an
  incoming request before it expires.
- **Disputes**: an in-app per-job chat thread for coordination, plus a
  separate categorized "Report a problem" flow (No-show / Safety concern /
  Quality of work / Pricing disagreement), routed to manual admin review —
  no automated dispute bot.
- **Monetization**: still exploratory — leaning toward a worker-side
  subscription/freemium model (free leads up to a cap, then subscribe),
  customers stay free. Do not hard-code a commission/escrow-split payment
  model.

## Data model (initial)
`User` (phone, PIN hash, role) · `WorkerProfile` (categories, verified
bool, certifications[], subscription status) · `CustomerProfile` ·
`ServiceCategory` · `JobRequest` (category, description, geo location,
photo, status, price_range, agreed_price) · `Certification` (worker,
category, doc, status) · `Message` (job, sender, text) · `Report` (job,
reporter, category, details, status) · `Rating` (job, stars, comment) ·
`CancellationLog` (job, worker, reason)

## Job lifecycle (status field on JobRequest)
`requested → searching → matched → accepted → arrived → quote_pending →
quote_accepted → in_progress → completed` (or `cancelled` / `declined` /
`disputed` at various points). Redesigned 2026-09-08 — see "Active-job &
pricing flow redesign" below; the old chain had `on_my_way` and
`awaiting_price_confirmation` and set the price after the work.
- `accepted → arrived`: worker taps "I've arrived" (no separate "on my
  way" step). This opens the on-site evaluate screen.
- `arrived → quote_pending`: worker submits a quote (amount + optional
  note) via **Accept**. **Decline** instead → `declined` (terminal,
  reason required).
- `quote_pending → quote_accepted`: customer confirms the quote in-app.
  Customer rejects → job closes (`cancelled`).
- `quote_accepted → in_progress`: worker taps "Start work".
- `in_progress → completed`: worker taps "Complete". No post-work pricing
  step — the price was locked at `quote_accepted`.
- Cancellation before work: customer any time before `quote_accepted`;
  worker within the 10-min window or via on-site Decline. After
  `in_progress`, disputes only.

## Auth flow (both apps, same sequence)
Phone number → SMS OTP → set PIN → confirm PIN → name + photo +
liability checkbox → role split:
- Customer → home (request a service)
- Worker → category/job browse (ID upload banner, non-blocking) → ID
  upload (required to go online) → optional certification upload
  (skippable) → under-review state → verified home (online/offline
  toggle)

## Customer flow
Request submission (category, description, GPS + address, optional
photo, estimate range shown) → searching/matching (auto-match, cancel
option) → matched confirmation (worker card: photo, rating, distance,
Verified/Certified badges) → job status tracking (stepper + chat +
report-a-problem): worker arrives → **review & confirm the worker's
on-site quote** (single Confirm tap, or Reject → job closes) → work
happens → job complete → mobile money payment (at the already-agreed
price) → payment confirmed → 1–5 star rating. A post-agreement "Pricing
disagreement" report is still available if the final charge is
contested.

## Worker flow
Verified home (online toggle, nearby jobs with estimate ranges) →
incoming request (60s timer, accept/decline) → active job (get
directions, chat, cancel-job link) → "I've arrived" → **on-site evaluate
screen**: assess the job, then **Accept** → enter a quote (amount +
optional note, shows typical range) or **Decline** → reason → job closes
→ wait for the customer to confirm the quote → "Start work" → "Complete".
No pricing step after the work. Cancel job = 10-min window + reason;
after that, on-site Decline is the only free exit until work starts.

## Development workflow (PRD → tickets → implement)

For any non-trivial feature (not tiny fixes/tweaks), work goes through
three stages before code is written:

1. **PRD** (`docs/prds/<feature-slug>.md`) — written collaboratively:
   Claude interviews the user (current codebase/backend state first,
   then open product questions the code can't answer) before drafting.
   Covers summary, current state, goals/non-goals, screen-by-screen or
   step-by-step flow, technical decisions, acceptance criteria, and open
   risks.
2. **Tickets** (`docs/tickets/<feature-slug>.md`) — the PRD broken into
   ordered, independently-committable tickets, each with its own
   dependencies, touched files, acceptance criteria, and **a "Tests"
   subsection** (see below).
3. **Implementation** — tickets are implemented one at a time, in
   dependency order, with a review point between each rather than one
   large unreviewed diff.

Both docs are checked into the repo as durable history, not scratch
files — future work (and future Claude sessions) should be able to read
back why a feature was scoped the way it was. See
`docs/prds/worker-active-job-flow.md` +
`docs/tickets/worker-active-job-flow.md` for the reference example.

**Testing is integral, not an afterthought.** Every PRD includes a
"Testing strategy" section (framework choices, what's in/out of scope),
and every ticket that adds logic (not pure UI wiring) includes a "Tests"
subsection — the ticket isn't done until those tests exist and pass.
Current stack choices (set up as of the worker-active-job-flow PRD, keep
using unless there's a reason to change): backend uses `pytest-django` +
`factory_boy`; mobile apps use `jest-expo` + `@testing-library/
react-native`, scoped to **logic** (hooks, timers, validation, transition
guards — extracted as plain functions/hooks so they're unit-testable)
rather than full-screen rendering, since screens change shape often
pre-pilot and rendering tests there would mostly test churn. No CI yet —
tests run locally; wiring GitHub Actions is a deliberate later step, not
assumed to exist.

## Build order
1. Django project + core models + PostGIS
2. Auth endpoints (phone/OTP/PIN, JWT)
3. Django admin review queue (ID + certification approval)
4. Job lifecycle API + matching logic (priority ordering)
5. Expo monorepo scaffold (apps/worker, apps/customer, shared
   design-token/component package)
6. Auth screens → wire to API
7. Customer request flow → wire to API
8. Worker active-job flow → wire to API
9. Chat (start with simple polling; upgrade to Django
   Channels/websockets later if needed)
10. Mobile money payment integration
11. Push notifications
12. Device testing on real iOS/Android hardware, then pilot rollout
    (~100–300 users)

## Matching: future considerations (not adopted for MVP)
Proposed and deliberately deferred: **tiered radius broadcast** —
instead of one candidate at a time, open the job to all eligible
workers within an initial narrow radius/ETA (e.g. 3km) simultaneously;
if unclaimed after 60s, expand to a wider ring (e.g. 8km), then to the
full match radius. Reasoning for deferring: it's a real scope expansion
(falls under "smart/weighted matching," already out of scope below),
needs real pilot data on how often/how far offers currently cascade
before it's worth tuning radii against, and introduces genuine
concurrency risk (atomic accept-with-sibling-cancellation across
multiple simultaneous offers) that's worse to get wrong on a trades
platform than on e.g. food delivery — a race-condition bug here means
two tradespeople physically showing up to the same job. If revisited:
also needs a plan for preserving the Certified/Verified priority rule
within a tier (e.g. a short head-start) rather than letting it collapse
to pure first-tap-wins.

## Explicitly out of scope for MVP
Automated KYC/facial match, social security registration integration,
admin analytics dashboards, smart/weighted matching, multiple payment
methods, instant payouts, business-account features.


## Local development environment
- Fully Dockerized: Postgres (PostGIS), Redis, Django backend, Celery
  worker, and MinIO (local S3-compatible storage) all run via
  docker-compose. Postgres runs in Docker for now — may move to a
  managed instance later, per the architecture doc.
- OTPs are logged to console in local dev, not sent via a real SMS
  gateway. Payment gateway is stubbed until a specific provider is
  chosen.

## Auth & verification flow updates (2026-08-28 design session)

Decisions from a design session on 2026-08-28, covering the onboarding/
verification flow, two new App Store-driven requirements, and open
compliance questions. See `docs/prds/app-store-readiness.md` /
`docs/tickets/app-store-readiness.md` for the full PRD and tickets.
Hi-fi reference: `docs/design/prism-auth-flow-hifi.html` — supersedes
any earlier auth-flow wireframe.

**Auth flow changes:**
- Face ID / biometric login has been removed entirely (already shipped
  in code as of 2026-08-27) — PIN is the only login method, matching
  how comparable apps (Uber, Bolt) handle this: the app just opens on
  launch, no forced re-auth. See the "Auth flow" section above, already
  updated to match.
- The shared Basic Profile screen's name field is now role-conditional:
  Worker path labels it "Full name (as it appears on your ID)" with a
  placeholder example ("e.g. Jane M. Nghidinwa"); Customer path keeps
  plain "Full name". Still one field — no first/last name split.
- The ID verification step is now two screens instead of one: an
  instructions screen (numbered tips, a zoomable example image,
  "Continue") followed by the upload screen itself (front/back capture,
  a manual-review consent line, "Submit for Review"). The
  certifications step gets the same split. Screen numbering in the flow
  shifts accordingly — see the hi-fi reference and PRD for the full
  updated sequence.

**Verification guidance:** ID upload, profile photo, and certificate
upload screens now include tip lists, an example image, and consent
copy — modeled on Uber's ID-verification UX pattern, but explicitly
adapted: Prism uses manual human review, not automated facial
recognition/biometric matching, and consent copy must never claim
biometric verification.

**Account deletion (required, not yet built):** Apple and Google Play
both require in-app account deletion for any app with account
creation — a hard submission requirement, not optional. Real deletion
(not deactivation), placed in Profile → Account near Log out, blocked
while a job is active or a payment is unresolved, with a legal-
retention exception for anonymized financial/transaction records. See
the PRD's Technical decisions section for a real FK-cascade risk this
surfaced (hard-deleting a `User` row today would cascade-destroy the
*other* party's job/message history too) and the proposed fix.

**App Store compliance — open items, tracked but not yet resolved:**
- **Chat safety (Apple Guideline 1.2):** the existing "Report a
  problem" flow covers job-outcome disputes, not in-chat report-
  message/block-user actions — required for any app with user
  messaging. Needs its own design pass before it's buildable; tracked
  as a blocked placeholder ticket, not scoped yet.
- **Privacy Nutrition Label (Apple) / Data Safety form (Google Play):**
  mandatory data-collection disclosures at submission time, given
  Prism collects ID documents, location, photos, and payment info —
  not a code task, but budget real time for it before submission.
- **Worker subscription/lead-access model:** real job payments are
  exempt from Apple's in-app purchase system (person-to-person
  real-world services), but a paid subscription unlocking more
  leads/visibility inside the app is a gray area that may require
  Apple's IAP instead of direct billing. **Must resolve before
  implementing** the freemium/subscription model referenced under
  Monetization above.
- **Minimum worker age:** the original pitch deck describes workers
  aged 16–60, but the liability waiver assumes a binding contract,
  which minors generally can't enter without a guardian. Leaning
  toward raising the effective minimum to 18 for the MVP pending a
  firm decision — do not build age-gating either way until decided.

## Active-job & pricing flow redesign (2026-09-08 design session)

Decision from a design session on 2026-09-08 after live-testing the full
job flow on the Simulator: **move price agreement to an on-site step
before work starts**, and simplify the worker's active-job flow. The old
flow (mark complete → propose price → wait for confirmation, mirrored by
the customer's confirm/dispute screen) is heavy and backwards from how
informal-sector trades actually quote — look at the job, quote it,
agree, *then* work. The redesign is aimed squarely at keeping the app
usable for informal-sector workers.

**Changes:**
- **"On my way" step dropped.** After accepting, the worker's next action
  is "I've arrived", which opens the new evaluate screen.
- **New on-site evaluate step.** Two actions: **Accept** (submit a quote —
  amount + optional note, same UI as the old propose-price screen, moved
  earlier) or **Decline** (reason required → job closes, terminal
  `declined`; customer notified, can re-request; no auto-rematch). A
  sanctioned free exit even outside the 10-minute cancel window.
- **Customer confirms the quote in-app** before work can start (single
  Confirm tap; Reject closes the job → `cancelled`). "Start work" stays
  disabled until confirmed.
- **No post-work pricing step.** "Complete" is now a true finish line.
  The old `awaiting_price_confirmation` status, the worker's ProposePrice
  + WaitingForConfirmation screens (the wait is repurposed to the
  pre-work quote-confirm), and the customer's post-work PriceAgreement
  screen all move to before `in_progress`.
- **No re-quoting** if the job turns out bigger than quoted — the
  evaluate quote is final; the "Pricing disagreement" report → admin
  review stays as the escape hatch.
- **New status chain:** `matched → accepted → arrived → quote_pending →
  quote_accepted → in_progress → completed`, terminal `declined` added.
  See "Job lifecycle" above.

**Built and shipped** (2026-09-08 through 2026-09-11) — merged to `main`,
superseding the original worker-active-job flow
(`docs/prds/worker-active-job-flow.md` / build-order step 8) and the
customer price-agreement screen. PRD: `docs/prds/active-job-flow-v2.md`,
tickets (`docs/tickets/active-job-flow-v2.md`, T1–T10) all done and
live-tested on the Simulator. `PROGRESS.md` has the full detail.

**Follow-up in progress — v2.1, customer completion confirmation**
(scoped 2026-09-10, not yet built): the customer will also confirm a job
is actually done before it's `completed` — a new
`awaiting_completion_confirmation` status between `in_progress` and
`completed`, a "send it back to the worker" path if it isn't done, and a
24h lazy auto-confirm if the customer never responds. Until this lands,
"Complete" (above) remains the actual finish line. See
`docs/prds/active-job-flow-v2.1-completion-confirmation.md` +
`docs/tickets/active-job-flow-v2.1-completion-confirmation.md`.
