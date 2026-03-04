# AI Pipeline — Complete Improved Architecture Plan
> Email → Action Items · 10 Phases · Production-Grade

---

## Executive Summary

This document presents a complete, production-grade improvement over the original AI email pipeline design. Each section identifies what was weak in the original approach, explains why it fails at scale, and replaces it with a hardened alternative. The result is a system that is cheaper to run, more observable, more resilient to failures, and more useful to end users.

> **Core philosophy:** the AI is a cheap first-pass classifier. Humans stay in control. Every action item is a proposal until explicitly accepted. The pipeline costs pennies per thousand emails when built correctly.

---

## What Changes at a Glance

| Area | Original | Improved |
|---|---|---|
| JSON output | Regex parse + repair retry | Structured outputs (schema-enforced) |
| Candidate filter | Binary keyword match | Scored pre-filter (0–1 confidence) |
| Lock recovery | Mentioned, not designed | Dedicated recovery cron + staleness TTL |
| Budget enforcement | After claiming jobs | Before claiming jobs (gate pattern) |
| Body cleaning | Strip HTML only | Thread dedup + quote removal + truncation |
| Action deduplication | Unique index only | Hash-based semantic dedup across reruns |
| Cold start | Not addressed | Phased backfill with rate shaping |
| Observability | Not mentioned | Structured logs, metrics, alerting |
| Prompt design | Single flat prompt | Versioned, few-shot, schema-anchored |
| Model strategy | Single model (env var) | Primary + fallback + cost routing |
| UI volume problem | Not addressed | Priority scoring + inbox-zero surface |
| Feedback loop | Loose mention | Explicit vendor rules + retraining signal |

---

## Phase 01 — Database Schema: Additions & Fixes
*Everything the original missed*

### 1.1 Add `pre_filter_score` to messages

The original stores `ai_status` but loses the signal that decided whether to enqueue. Add a `pre_filter_score` (0.0–1.0) column. This lets you tune the threshold over time without re-running the full filter.

```sql
ALTER TABLE messages ADD COLUMN pre_filter_score numeric;
ALTER TABLE messages ADD COLUMN ai_status text;
ALTER TABLE messages ADD COLUMN ai_version text;
ALTER TABLE messages ADD COLUMN ai_hash text;
ALTER TABLE messages ADD COLUMN ai_processed_at timestamptz;
ALTER TABLE messages ADD COLUMN ai_error text;
```

### 1.2 `ai_queue` — add priority and stale-lock columns

The original queue has no priority column, so a newly arrived urgent bill competes equally with a 3-year-old newsletter. Add `priority` (lower = process first) and a `locked_until` column that makes stale-lock recovery trivial.

```sql
CREATE TABLE ai_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id      uuid NOT NULL,
  message_id      uuid NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'queued',
  priority        int NOT NULL DEFAULT 50,        -- 0=urgent, 50=normal, 100=backfill
  attempts        int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until    timestamptz,                    -- replaces locked_at; recovery = WHERE locked_until < now()
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON ai_queue (status, priority, next_attempt_at);
CREATE INDEX ON ai_queue (mailbox_id, status, next_attempt_at);
```

### 1.3 `ai_usage_daily` — make budget a hard gate

The original mentions this table briefly. It needs a `reserved_tokens` column so you can atomically reserve tokens before sending a request, then reconcile actual usage afterward. Without reservation, two concurrent workers can both pass the budget check and both overspend.

```sql
CREATE TABLE ai_usage_daily (
  mailbox_id       uuid NOT NULL,
  day              date NOT NULL,
  tokens_reserved  int NOT NULL DEFAULT 0,   -- reserved but not yet reconciled
  tokens_in        int NOT NULL DEFAULT 0,
  tokens_out       int NOT NULL DEFAULT 0,
  cost_usd         numeric(10,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (mailbox_id, day)
);
```

### 1.4 `action_items` — add `dedup_hash` and `surface_priority`

The original uses a unique index on `(message_id, type, title)` for deduplication, but titles vary slightly between model runs. A content hash is more stable. `surface_priority` controls what the UI shows first.

```sql
ALTER TABLE action_items
  ADD COLUMN dedup_hash text,       -- sha256(message_id || type || normalized_title)
  ADD COLUMN surface_priority int DEFAULT 50,
  ADD COLUMN snoozed_until timestamptz;

CREATE UNIQUE INDEX ON action_items (dedup_hash) WHERE dedup_hash IS NOT NULL;
```

> **Rule:** always compute `dedup_hash` before inserting. On conflict, do nothing. This prevents the same bill from appearing twice if the email is reprocessed under a new prompt version.

---

## Phase 02 — Candidate Scoring: Replace the Binary Filter
*A score is better than a yes/no*

The original filter is binary: enqueue or skip. Replace it with a cheap scorer that returns 0.0–1.0. This gives you a threshold you can tune without code changes, and captures borderline cases you can review later.

### 2.1 Scoring signal table

| Signal | Weight | Notes |
|---|---|---|
| Payment keyword in subject | +0.40 | invoice, payment, due, bill |
| Booking keyword in subject | +0.35 | reservation, confirmation, booking |
| Known biller domain | +0.30 | maintained vendor table |
| Currency symbol or amount in body | +0.25 | $, €, AED, etc. |
| Due date pattern in body | +0.20 | regex: `due (by\|on\|before)` |
| Unsubscribe header present | −0.25 | likely marketing bulk mail |
| Sender is self (drafts/sent) | −1.00 | never actionable |
| Previously dismissed same sender | −0.30 | from `feedback_rules` table |

### 2.2 Threshold tiers

- **Score ≥ 0.5** — enqueue normally (`priority = 50`)
- **Score 0.3–0.49** — enqueue as low priority (`priority = 80`), processed in off-peak window
- **Score < 0.3** — skip, store score for auditing

> **The low-priority tier is the key addition.** Borderline emails don't get lost; they just wait until the normal queue is drained. This costs nothing extra on slow days and self-throttles on busy ones.

---

## Phase 03 — Stale Lock Recovery: The Missing Safety Net
*Workers crash. Locks must not last forever.*

The original adds a `locked_at` column and says "update `locked_at=now()`" but never describes how stale locks get cleared. A worker that crashes mid-batch leaves rows stuck in `processing` forever. This is a silent data loss bug.

### 3.1 Recovery query (run every 2 minutes by a separate cron)

```sql
-- Reset jobs whose worker lock expired (TTL = 10 minutes)
UPDATE ai_queue
SET
  status          = 'queued',
  locked_until    = NULL,
  next_attempt_at = now() + (attempts * interval '2 minutes'),
  attempts        = attempts + 1
WHERE
  status       = 'processing'
  AND locked_until < now()
  AND attempts < 5;

-- After 5 attempts, mark as permanent error
UPDATE ai_queue SET status = 'error'
WHERE status = 'processing' AND locked_until < now() AND attempts >= 5;
```

### 3.2 Lock duration rule

- Lock TTL = `batch_size × avg_seconds_per_email × 3` (safety buffer)
- For a 20-email batch at ~2s/email: `locked_until = now() + interval '2 minutes'`
- Never use a fixed 10-minute lock for small batches — it hides failures too long

---

## Phase 04 — Budget Gate: Reserve Before Claiming
*The correct order of operations*

The original plan checks the budget after selecting jobs from the queue. This is wrong: the check and the claim must be atomic, or two concurrent workers both pass the budget check and both overspend. The fix is a reservation pattern.

### 4.1 Reservation pattern

```sql
-- Step 1: estimate tokens for planned batch
const estimatedTokens = Math.ceil(totalChars / 4) + PROMPT_OVERHEAD;

-- Step 2: attempt atomic reservation
INSERT INTO ai_usage_daily (mailbox_id, day, tokens_reserved)
VALUES ($mailboxId, current_date, $estimatedTokens)
ON CONFLICT (mailbox_id, day) DO UPDATE
  SET tokens_reserved = ai_usage_daily.tokens_reserved + EXCLUDED.tokens_reserved
  WHERE (ai_usage_daily.tokens_reserved + ai_usage_daily.tokens_in) + EXCLUDED.tokens_reserved
        <= $dailyLimit  -- only updates if under budget
RETURNING tokens_reserved;  -- NULL means budget exceeded, abort
```

### 4.2 Reconciliation after API call

- **On success:** set `tokens_in` = actual usage, `tokens_out` = actual usage, subtract the reservation from `tokens_reserved`
- **On failure:** subtract the full reservation from `tokens_reserved` (releases it for retry)
- **Cost estimate:** store `cost_usd = (tokens_in × input_price + tokens_out × output_price)` per model

---

## Phase 05 — Body Cleaning Pipeline: Smarter Input Prep
*Garbage in = garbage out*

The original says "strip HTML" and cap at 6k–12k chars. This is necessary but not sufficient. An email thread with 15 replies will still have enormous, repetitive context after HTML stripping. Clean the text in stages.

### 5.1 Cleaning stages (in order)

| # | Stage | What it removes |
|---|---|---|
| 1 | HTML stripping | Tags, scripts, styles. Use a real parser, not regex. |
| 2 | Thread deduplication | Quoted reply blocks (lines starting with `>` or `On [date] wrote:`) |
| 3 | Footer removal | Unsubscribe blocks, legal disclaimers, tracking pixel containers |
| 4 | Whitespace normalization | Collapse 3+ blank lines to 1, trim, normalize Unicode |
| 5 | Truncation | Cap at 8,000 chars from the top (newest content is first) |
| 6 | Hash | `sha256` of the cleaned text = `ai_hash` stored on the message |

> **Hash after cleaning (step 6), not before.** The goal is to detect when the actionable content changes, not when a tracking pixel URL changes.

---

## Phase 06 — Structured Outputs: Eliminate the Repair Retry
*Get guaranteed JSON or fail cleanly*

The original design parses JSON and does one repair retry if it fails. In practice, a repair retry almost never works because the model produced the wrong structure for a reason. Use `response_format` to get schema-enforced JSON from the start.

### 6.1 Request with `response_format`

```ts
const response = await openrouterChat({
  model: process.env.AI_MODEL,
  temperature: 0,
  response_format: { type: 'json_object' },  // enforced by model
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify({ emails: batchDocs }) }
  ]
});
```

### 6.2 Zod schema (validate once, hard fail)

```ts
const ActionSchema = z.object({
  type: z.enum(['bill','booking','follow_up','delivery','subscription','other']),
  title: z.string().max(200),
  due_at: z.string().datetime().nullable(),
  amount: z.number().nullable(),
  currency: z.string().length(3).nullable(),
  action_url: z.string().url().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(400)   // new: model explains itself
});

const ResultSchema = z.object({
  results: z.array(z.object({
    message_id: z.string().uuid(),
    actions: z.array(ActionSchema)
  }))
});
```

### 6.3 Failure handling (no repair)

- If `JSON.parse` fails or Zod throws: mark all emails in batch as `error`, increment `attempts`, schedule retry
- If a single result's `message_id` doesn't match any input: discard that result, log the mismatch
- If `actions` array is empty for a message: mark the message `processed` — "no actions" is a valid output, not an error

> **Add the `reasoning` field to your schema.** It costs ~20 tokens per action but gives you an audit trail for every proposal. When a user dismisses an action, you can inspect the reasoning to improve your prompt.

---

## Phase 07 — Prompt Engineering: Few-Shot, Versioned, Schema-Anchored
*The prompt is code. Treat it like code.*

### 7.1 System prompt structure

- **Section 1 — Identity:** "You are an email action-item extractor. You process batches of emails and return structured JSON only."
- **Section 2 — Output schema:** Paste the exact JSON schema inline. The model must see it in the system prompt, not just the user message.
- **Section 3 — Rules:** "Do not guess amounts or dates. Leave null if unclear. Never create duplicate actions. One action per distinct obligation."
- **Section 4 — Few-shot examples:** Include 2–3 example emails with their ideal output. This is the biggest single accuracy improvement available.

### 7.2 Few-shot example format

```json
{
  "email": {
    "subject": "Your invoice #1234 is due",
    "from": "billing@acme.com",
    "body": "Hi John, invoice #1234 for $129.00 is due on March 15."
  },
  "expected_output": {
    "actions": [{
      "type": "bill",
      "title": "Pay Acme invoice #1234",
      "due_at": "2024-03-15T00:00:00Z",
      "amount": 129.00,
      "currency": "USD",
      "confidence": 0.97,
      "reasoning": "Clear invoice with explicit due date and amount."
    }]
  }
}
```

### 7.3 Versioning rule

- Store `SYSTEM_PROMPT_V1`, `V2` etc. as constants in your codebase
- `ai_version` column = the version string used to produce each result
- Reprocess on upgrade: `UPDATE ai_queue SET status='queued' WHERE message_id IN (SELECT id FROM messages WHERE ai_version != 'v3')`

---

## Phase 08 — Model Strategy: Primary, Fallback, Cost Routing
*Don't bet on a single model*

### 8.1 Model tiers

| Tier | Model | Usage |
|---|---|---|
| Primary | `gpt-4o-mini` or `gemini-flash-1.5` | Cheap, fast, high context. Processes 95%+ of all emails. |
| Fallback | Any alternative cheap model | Used when primary returns 429/503. Slightly more expensive. |
| Audit | `gpt-4o` or `claude-sonnet` | Only for confidence < 0.5 items before surfacing. |

### 8.2 Audit model pattern

Low-confidence actions (confidence < 0.5) from the primary model don't get surfaced directly. They get re-verified by a smarter model. This keeps the primary cheap while ensuring quality.

- Primary model processes all emails in batches
- Actions with `confidence ≥ 0.5`: insert as `proposed` immediately
- Actions with `confidence 0.3–0.49`: insert into a `secondary_review` queue
- Secondary review queue processed nightly by the audit model at low volume
- Actions with `confidence < 0.3`: discard

---

## Phase 09 — Cold Start: Backfilling Existing Emails Safely
*The first sync is a special problem*

The original design doesn't address what happens when a user first connects a mailbox with 50,000 emails. Naively enqueueing all of them immediately will exhaust the daily budget in minutes and flood the UI with proposals.

### 9.1 Backfill strategy

- **Phase A — immediate (first 7 days of email):** Enqueue only emails received in the last 7 days. Surfaces current obligations first. Volume stays tiny.
- **Phase B — background (weeks 1–4):** Expand window 30 days at a time, lowest priority (100). Budget cap = 20% of daily limit.
- **Phase C — historical (month 2+):** Only if user explicitly triggers "scan all mail". Still rate-limited.

### 9.2 Phased backfill jobs table

```sql
CREATE TABLE backfill_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id  uuid NOT NULL,
  phase       int NOT NULL DEFAULT 1,
  from_date   date NOT NULL,
  to_date     date NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  enqueued    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

---

## Phase 10 — Observability + UI: Making It Usable
*The pipeline means nothing if the surface is broken*

### 10.1 Structured logging (every ai-tick)

- **Per batch:** `batch_id`, `model`, `emails_in_batch`, `tokens_in`, `tokens_out`, `latency_ms`, `actions_created`, `actions_skipped`
- **Per action:** `message_id`, `action_type`, `confidence`, `due_at`, `amount`
- **Per error:** `error_code`, `message_id`, `attempts`, `next_retry`

### 10.2 Metrics to track

| Metric | What it tells you |
|---|---|
| `enqueue_rate` | Emails enqueued per hour — spikes = backfill or sync bug |
| `process_rate` | Queue depth over time — should trend to 0 during off-peak |
| `action_rate` | Actions created per 100 emails — baseline this early |
| `dismiss_rate` | User dismissals / total proposals — high = poor filter quality |
| `budget_utilization` | Daily tokens used / daily limit — alert at 80% |
| `p95_latency` | Batch latency — alert if > 30s (model degradation signal) |

### 10.3 UI — Inbox-zero surface, not a list

The original proposes "Proposed / Accepted" tabs. This breaks when a user has 200 proposals from a backfill. Design for the volume problem from day one.

- Show maximum 10 proposals at once, sorted by `surface_priority` (`due_at asc`, then `confidence desc`)
- Overdue items (`due_at < now`) always appear first with a red indicator
- Swipe/keyboard: approve, dismiss, snooze. One action = one keypress.
- After dismissing 3 items from the same sender: show "Ignore all from [sender]?" prompt
- Batch approve: "These 4 look like your recurring bills — approve all?"

### 10.4 Feedback loop — turn dismissals into rules

```sql
CREATE TABLE feedback_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id  uuid NOT NULL,
  rule_type   text NOT NULL,  -- 'skip_sender' | 'skip_domain' | 'skip_type'
  value       text NOT NULL,  -- 'billing@newsletter.com' or 'newsletter.com'
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Applied during candidate scoring (pre_filter_score -= 0.3 per matching rule)
```

> **Three dismissals from the same sender = auto-suggest a skip rule.** This is the most impactful UX feature in the whole pipeline. Users hate irrelevant notifications more than they love relevant ones.

---

## Implementation Order

Don't build all 10 phases at once. Here is the recommended sequence:

| Sprint | Phases | What you can demo |
|---|---|---|
| 1 | 01, 02, 05, 06 | Working pipeline: email in, action items out, deduplicated, no crashes |
| 2 | 03, 04 | Production-safe: stale lock recovery, budget gating, no overspend possible |
| 3 | 07, 08 | Better accuracy: few-shot prompts, fallback model, audit tier |
| 4 | 09 | Scale-safe: cold start backfill that doesn't blow the budget on day 1 |
| 5 | 10 | Usable product: inbox-zero UI, feedback rules, metrics dashboard |

> **Start with Sprint 1 only.** Ship it. Measure real `dismiss_rate` and `action_rate` before spending time on prompt tuning or model tiers. Real user data will tell you more than any upfront design decision.
