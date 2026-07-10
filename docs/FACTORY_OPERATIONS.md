# Solvers Agency OS — Factory Operations

## Operating loop

```text
Real Solvers capture + recurring Grok/X research
→ Inbox / Signals
→ Draft Studio
→ Human review (approve / changes / reject)
→ Schedule with immutable content snapshot
→ 3 dry-runs
→ Ready queue
→ xurl publisher (only when live gate is explicitly enabled)
→ X post ID + metrics + audit events
```

## Live components

- Dashboard: `https://dashvalentinsolvers.vercel.app`
- Supabase project: `violetaAI`
- X account: `@valentinflrz`
- Official X CLI profile: `solvers` (`xurl whoami` must resolve to `valentinflrz`)
- Research model: `grok-4.5` through Hermes provider `xai-oauth`

## Isolation model (hardened)

```text
every 4h  no-agent runner
          ├─ deterministic context export (service role local only)
          ├─ spawn hermes with toolset x_search ONLY
          │    cwd=/tmp, stripped env, ignore-rules, max 4 turns
          ├─ require BEGIN/END_SOLVERS_JSON envelope
          ├─ validate allowlist + canonical X URLs
          └─ deterministic ingest into Supabase (service role after validation)
```

- Grok never sees `SUPABASE_*` credentials.
- Grok has no terminal, file tools, browser, messaging, or xurl.
- Publisher remains a separate job and OFF by default.
- Worker re-checks approval, dry-runs, snapshot hash, kill switch, mode, daily limit, and `@valentinflrz` identity.
- SQL migration `20260710_06_publisher_claim_gates.sql` duplicates those gates inside `mc_claim_publications`.

## Durable jobs

| Job | Schedule | Mode | Purpose |
|---|---:|---|---|
| `3b7dd0c7f294` · Solvers isolated Grok/X research | every 4h | script-only | Isolated Grok OAuth research + validated Supabase ingest |
| `2ab7a70231ce` · Solvers publisher validator | every 15m | script-only | Advance queued publications through dry-run gates; publish only if live gates are enabled |

Research outputs are saved to Supabase. Cron delivery is local to avoid Telegram spam.

## Dashboard flows

### Production

1. Add a capture with a real situation, numbers, friction, or outcome.
2. Convert a capture to a draft, or shortlist a Grok/X signal.
3. Convert a shortlisted signal to Draft Studio.

### Review

1. Edit title and X text.
2. Save to create a versioned revision.
3. Send to review.
4. Approve, request a concrete change, or reject.
5. Approved drafts can be scheduled.

### Calendar / Publisher

1. Scheduling writes an immutable content snapshot and idempotency key.
2. Run three validations (manual button or 15-minute worker).
3. A clean `3/3` publication becomes `ready`.
4. `ready` is not the same as published.

## X live publishing gates

All must be true:

- Draft has explicit human approval.
- Scheduled snapshot still matches the approved body.
- Publication has passed three dry-runs.
- `publisher_mode = live`.
- `publisher_enabled = true`.
- `kill_switch = false`.
- Daily publish limit has not been reached.
- `xurl whoami` returns `valentinflrz`.

Default production state remains:

```text
publisher_mode = dry_run
publisher_enabled = false
kill_switch = false
```

No cron or dashboard action enables live publishing implicitly.

## Local commands

```bash
# Isolated research + ingest (same path as cron)
npx tsx scripts/factory-research-runner.ts

# Context only / ingest only
npx tsx scripts/factory-bridge.ts context --output /tmp/solvers-factory-context.json
npx tsx scripts/factory-bridge.ts ingest --input /tmp/solvers-research-output.json --model grok-4.5

# Publisher validator
npx tsx scripts/factory-publisher.ts

# Full private API tracer (no real X post)
FACTORY_BASE_URL=https://dashvalentinsolvers.vercel.app npx tsx scripts/e2e-factory.ts
```

## Auth residual

- OTP Telegram + passkeys already enforced.
- Face ID validation on your physical device is still operator-side.
- Rotate any Telegram bot token that previously appeared in chat.
