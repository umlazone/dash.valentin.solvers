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

## Durable jobs

| Job | Schedule | Mode | Purpose |
|---|---:|---|---|
| `e3aef36d794f` · Solvers Grok/X research → factory | every 4h | Grok agent | X research, dedupe signals, propose max 2 grounded drafts |
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
cd /Users/kin/solvers-x-engine/apps/dash.valentin.solvers

# Export safe factory context for a research agent
npx tsx scripts/factory-bridge.ts context --output /tmp/solvers-factory-context.json

# Ingest a validated research payload
npx tsx scripts/factory-bridge.ts ingest --input /tmp/solvers-research-output.json --model grok-4.5

# Run publisher in configured mode (dry_run by default)
npx tsx scripts/factory-publisher.ts

# Verify code
npm test -- --run
npm run lint
npm run build
npm audit --audit-level=moderate
```

## Incident controls

- Pause research: `hermes cron pause e3aef36d794f`
- Pause publisher worker: `hermes cron pause 2ab7a70231ce`
- Immediate publication stop: set `kill_switch` ON in Systems.
- X credentials are never read or printed; only `xurl auth status` and `xurl whoami` are permitted checks.
- Supabase service role and Telegram bot tokens remain server/local only.
