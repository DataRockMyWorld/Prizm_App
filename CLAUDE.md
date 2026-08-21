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
  (not passwords), optional biometric unlock client-side
- Push: Expo push notifications (FCM/APNs)
- Payments: mobile money integration (provider TBD)

## Brand
Gradient #FE3F2D → #FF6C22 → #FFB255, wordmark gold #FEBD59, Manrope
typeface, rounded cards, bottom tab nav.

## Core business rules (do not deviate without asking)
- **No fixed prices.** Category listings show an estimate range only
  (e.g. "Est. N$150–300"). The actual price is proposed by the **worker**
  after marking a job complete; the **customer** confirms or disputes it
  via "Report a problem → Pricing disagreement".
- **Matching**: broadcast-and-first-to-accept, not browse-and-choose.
  Priority goes to workers with a Verified badge (ID approved) and/or
  Certified badge (per-category certification approved) over other
  available workers.
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
  through the dispute flow instead.
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
`requested → searching → matched → accepted → on_my_way → arrived →
in_progress → awaiting_price_confirmation → completed` (or `cancelled` /
`disputed` at various points)

## Auth flow (both apps, same sequence)
Phone number → SMS OTP → set PIN → confirm PIN → optional biometric
enable → name + photo + liability checkbox → role split:
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
report-a-problem) → price agreement (confirm or dispute worker's
proposed price) → mobile money payment → payment confirmed → 1–5 star
rating

## Worker flow
Verified home (online toggle, nearby jobs with estimate ranges) →
incoming request (60s timer, accept/decline) → active job (get
directions, status stepper On my way/Arrived/In progress, chat,
cancel-job link, Mark Complete action once in progress) → cancel job
(10-min window + reason) → propose price (amount + optional note, shows
typical range) → waiting for customer confirmation

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
  