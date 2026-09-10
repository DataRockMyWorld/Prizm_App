# Claude Design brief — Active-job & pricing flow v2 hi-fi

Paste everything below the line into Claude Design (run it from this repo so
it can open the base file). Produced 2026-09-08 from the design session
recorded in `CLAUDE.md` → "Active-job & pricing flow redesign".

---

**Task:** Update the Prism hi-fi wireframes for the redesigned active-job &
pricing flow. Only the artboards listed here change — leave everything else
exactly as it is.

**Study first, do not restyle:** `docs/design/prism-auth-flow-hifi.html` — a
single-page canvas of ~390 px iPhone artboards grouped into labelled sections
("Worker active-job flow" → W1–W6d; "Customer request flow" → C1–C7; plus
auth/onboarding and splash). Match its artboard frame, type scale, spacing,
button and segmented-control styling, and colour use **exactly**. Brand:
gradient `#FE3F2D → #FF6C22 → #FFB255`, wordmark gold `#FEBD59`, Manrope,
rounded cards, bottom tab nav, off-white page ground (`#F1ECE7`-ish), pure
white cards.

**Why it's changing (rationale, for your judgement on ambiguous bits):**
The price is now agreed **on site, before work starts**, not after. When the
worker arrives they run an **Evaluate** step: assess the job, then either
**Accept** (enter a quote) or **Decline** (pick a reason → the job closes for
the customer). The customer **confirms the quote in-app**; the worker cannot
start until they do. The "On my way" step is removed. There is **no pricing
step after the work** — "Complete" is the finish line. This is aimed at
keeping the flow usable for informal-sector tradespeople.

New status order:
`matched → accepted → arrived → quote_pending → quote_accepted → in_progress → completed`
plus a terminal `declined`.

## Worker artboards — replace / add

- **W2 — Active job (heading there).** Shown right after Accept. Worker/customer
  card (name, photo, rating), job address line, **Get Directions**, a chat
  icon in the header, **Cancel job** link at the bottom. One primary action:
  **"I've arrived"**. Remove the old `On my way / Arrived / In progress`
  segmented control entirely.
- **W2-eval-a — On-site evaluate (decision).** Reached by tapping "I've
  arrived". Heading: "Assess the job". Helper: "Look over the work, agree a
  price with the customer, then send your quote." Two buttons — primary
  **"Accept & send quote"**, ghost/secondary **"Decline this job"**.
- **W2-eval-b — Send quote.** From "Accept & send quote". Reuse the old W4
  layout: heading "Your quote", subtext "The customer confirms this before you
  start", large **Amount** field (N$ prefix, placeholder is an example not a
  real default), helper "Typical range: N$150–300", an optional
  "What's included (optional)" multiline note, primary **"Send quote"**.
- **W2-decline — Decline job.** From "Decline this job". Same shape as W3:
  reason list (reuse: Personal emergency / Vehicle or transport issue / Job
  details unclear / Other), optional note, primary **"Decline job"**
  (destructive styling). Small print: "This closes the job — the customer will
  be asked to request again."
- **W-quote-wait — Waiting for the customer** (this replaces W5). "Waiting for
  [Customer] to confirm your quote", the quoted amount shown as a chip,
  spinner, "We'll let you know as soon as they do." A **"Message [Customer]"**
  link. Note: this now happens *before* the work, not after.
- **W-ready — Quote accepted, ready to start.** Customer has confirmed. Worker/
  customer card + an "Agreed · N$220" chip. Primary action **"Start work"**.
- **W-inprogress — Work in progress.** "Job in progress", agreed amount shown,
  optional elapsed-since-start timer. Primary action **"Complete job"**. No
  free cancel here — replace the Cancel link with "Need to stop? Report a
  problem".
- **W-done — Job complete (worker).** Plain confirmation: check mark, "Job
  complete", "N$220 · [Customer] pays via Mobile Money", **"Back to Jobs"**.
  No price entry anywhere.
- **W6 / W6b / W6c — Jobs tab lists.** Update the status chips: drop "ON MY
  WAY"; add "HEADING OVER", "EVALUATING", "QUOTE SENT", keep "IN PROGRESS".
  Add a neutral-grey "DECLINED" chip variant for a worker-declined row (not
  the red/alarm treatment used for problems). Completed/Cancelled rows
  unchanged.

## Customer artboards — replace / add

- **C4 — Job status tracking.** New **6-step** timeline: **Requested ·
  Accepted · Arrived · Price agreed · In progress · Complete** (was 4 steps).
  Keep the gradient hero with the dynamic headline + step-count circle
  ("3 OF 6"), the worker card floating over the hero, the Estimate/Address
  card, and "Report a problem". Headline per step, e.g.:
  - accepted → "[Worker] is on the way"
  - arrived → "[Worker] is assessing the job"
  - quote_pending → "Confirm [Worker]'s price to get started" (links to C-quote)
  - quote_accepted → "[Worker] is about to start"
  - in_progress → "[Worker] is working"
  - completed → "Job complete"
- **C-quote — Confirm the worker's quote** (this replaces C5 and moves
  earlier). Shown while status = quote_pending. Heading "[Worker]'s quote",
  large **N$220**, the worker's "what's included" note if present, a reference
  line "Estimated range was N$150–300". Primary **"Confirm N$220"**,
  secondary **"Reject"**. Helper under Reject: "Rejecting closes this job — you
  can request again." Do **not** include the old "This isn't right → dispute"
  path here.
- **C-declined — Worker declined** (new terminal screen). "[Worker] couldn't
  take this job", the reason if it isn't "Other", one empathetic line, primary
  **"Request again"**, secondary "Back to home".
- **C5** is retired as a post-work screen. **C6 / C6b (payment)** and **C7
  (rating)** are unchanged and still come after "Complete".
- **C4c — Report a problem.** Unchanged; if convenient, note on the artboard
  that "Pricing disagreement" now only applies after the price was agreed.

## Deliverable

Either update the affected artboards in place inside
`prism-auth-flow-hifi.html` (keeping it the one canonical reference — rename
to `prism-hifi.html` if you like), **or** a focused
`prism-active-job-flow-v2-hifi.html` with just the changed/new artboards.
Keep it openable the same way (single self-contained HTML). Flag any screen
where this spec is ambiguous rather than guessing.
