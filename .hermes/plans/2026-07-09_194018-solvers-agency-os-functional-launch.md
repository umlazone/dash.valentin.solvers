# Solvers Agency OS — Functional Launch Implementation Plan

> **For Hermes:** Use strict TDD and execute task-by-task. Do not enable autonomous publishing until the explicit launch gate in Task 15.

**Goal:** Turn Mission Control from a live visualization into an operational content system where Valentin can capture real Solvers events, receive drafts, approve/schedule them, publish through `xurl`, and learn from live metrics.

**Architecture:** Vercel/Next.js is the authenticated control plane. Supabase is the source of truth and audit log. Hermes on Valentin’s Mac is the execution plane: durable cron jobs read enabled switches and queues from Supabase, analyze X/Solvers inputs, generate drafts, sync metrics, and publish only items that passed the human gate.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase Auth/Postgres/RLS, Vitest + Testing Library, Playwright smoke tests, Hermes Cron, Python 3.11 stdlib, `xurl`.

---

## 1. Definition of “Play”

The system is ready to press **Play** when this real flow passes end-to-end:

```text
Valentin adds capture
  → capture appears in Production
  → Hermes converts it into a full draft
  → Valentin requests changes or approves
  → approved draft receives date/time
  → publisher job sees it but does not post in dry-run
  → Valentin enables Publisher
  → due item publishes via xurl
  → tweet ID/URL and metrics return to Supabase
```

### Safety invariants

1. The dashboard is private to the allowlisted operator.
2. The browser never receives `SUPABASE_SERVICE_ROLE_KEY`.
3. No public anonymous write policy exists.
4. Generation and publishing are separate gates.
5. A draft cannot publish without `body`, `approved_at`, `scheduled_for`, and `status='ready'`.
6. Publisher is disabled by default and can run in dry-run.
7. Each write/post creates an audit event.
8. A queue row is locked before posting so retries cannot duplicate tweets.

---

## 2. Current audit

### Already working

- Live Supabase reads through `GET /api/mc/live`.
- X account snapshot from `xurl whoami`.
- Draft status update through `PATCH /api/mc/drafts`.
- Mission Control UI and Agency OS 2.0 shell.
- Tables for drafts, schedule, signals, metrics, pipeline, calendar and automations.

### Critical gaps

- `src/app/api/mc/drafts/route.ts` accepts unauthenticated writes and uses `service_role`.
- `supabase/schema.sql` still contains demo anonymous update policies.
- Dashboard is publicly readable.
- “Nueva captura” does not create a capture.
- Approval does not require a publication body or create a schedule item.
- Calendar and automation switches are mostly read-only.
- No Hermes cron jobs exist (`hermes cron list` returned 0).
- Engagement/funnel values remain partly seeded.
- No automated test suite exists.

---

# Phase 0 — Secure the control plane

## Task 1: Add the test harness

**Objective:** Establish RED-GREEN-REFACTOR before behavior changes.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/lib/__tests__/health.test.ts`

**Steps:**
1. Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and `tsx` as dev dependencies.
2. Add scripts: `test`, `test:watch`, `test:coverage`.
3. Write `health.test.ts` importing a nonexistent `assertMissionControl` helper.
4. Run `npm test -- --run`; verify RED because the helper is missing.
5. Create minimal helper; verify GREEN.
6. Run `npm run lint && npm run build && npm test -- --run`.
7. Commit: `test: add Mission Control test harness`.

## Task 2: Define state machines and validators

**Objective:** Centralize legal transitions before changing APIs.

**Files:**
- Create: `src/lib/workflow.ts`
- Create: `src/lib/__tests__/workflow.test.ts`

**Required behavior:**

```ts
capture: inbox -> processing -> processed | error
draft: pending -> changes_requested | approved | rejected
schedule: planned -> ready -> publishing -> posted | failed
```

**Tests first:**
- Reject `pending -> posted`.
- Allow `pending -> approved`.
- Require nonempty `body` before approval.
- Require `approved_at` + `scheduled_for` before `ready`.
- Reject publishing when Publisher is disabled.
- Reject a second publish claim for the same row.

**Verification:** `npm test -- --run src/lib/__tests__/workflow.test.ts`.

## Task 3: Add Telegram OTP bootstrap + WebAuthn passkeys

**Objective:** Protect every page and mutation with a single-operator session, using Telegram OTP for enrolment/recovery and a passkey for normal biometric login.

**Confirmed platform behavior:**
- Telegram Bot API `sendMessage` can send a 1–4096 character message to a fixed `chat_id` and supports `protect_content`.
- WebAuthn is broadly available in secure HTTPS contexts and implements passkeys with public-key cryptography.
- On iPhone, a platform passkey is normally authorized with Face ID; on a Mac it may use Touch ID; other devices may use their platform biometric/PIN. The server never receives biometric data.

**Login flow:**

```text
First login / recovery
  → “Enviar código a Telegram”
  → server generates six-digit OTP
  → Bot API sends only to configured TELEGRAM_CHAT_ID
  → operator verifies within five minutes
  → secure HttpOnly session is created
  → operator enrolls a WebAuthn passkey

Later logins
  → “Entrar con Face ID / Passkey”
  → WebAuthn userVerification='required'
  → signed challenge verified server-side
  → secure HttpOnly session is created
  → Telegram OTP remains the fallback/recovery path
```

**Files:**
- Modify: `package.json` — add `@simplewebauthn/browser` and `@simplewebauthn/server`
- Create: `src/lib/auth/config.ts`
- Create: `src/lib/auth/otp.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/webauthn.ts`
- Create: `src/lib/auth/require-operator.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/components/passkey-enrolment.tsx`
- Create: `src/app/api/auth/telegram/request/route.ts`
- Create: `src/app/api/auth/telegram/verify/route.ts`
- Create: `src/app/api/auth/passkey/register/options/route.ts`
- Create: `src/app/api/auth/passkey/register/verify/route.ts`
- Create: `src/app/api/auth/passkey/login/options/route.ts`
- Create: `src/app/api/auth/passkey/login/verify/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/lib/auth/__tests__/otp.test.ts`
- Create: `src/lib/auth/__tests__/session.test.ts`
- Create: `src/lib/auth/__tests__/webauthn.test.ts`

**Database tables:**

`mc_auth_challenges`
- challenge ID, purpose (`telegram_otp`, `passkey_register`, `passkey_login`)
- OTP HMAC/hash only — never store plaintext
- expiry, attempts, consumed timestamp, request/IP hash

`mc_passkeys`
- credential ID, public key, counter, transports
- device type/backed-up flags, created/last-used timestamps

`mc_sessions`
- random token hash, expiry, last-seen, user-agent hash, revoked timestamp

**Security requirements:**
- Login page never accepts a chat ID; destination is fixed server-side.
- Six-digit OTP expires after five minutes and is single-use.
- Maximum five verify attempts per challenge.
- Request throttling by IP/device plus a global Telegram cooldown.
- Request endpoint always returns a neutral response to avoid enumeration.
- OTP is hashed/HMACed with `MC_AUTH_SECRET`; constant-time comparison.
- Session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, short idle window and revocable token.
- WebAuthn requires the production origin and `userVerification='required'`.
- Passkeys only register after a verified Telegram OTP session.
- Preview deployment domains cannot enroll passkeys; only the stable production RP ID is allowed.
- Telegram message uses `protect_content=true`; bot token is server-only.

**Tests first:**
- Request creates a challenge and sends to the configured chat only.
- Plain OTP never appears in the database/logs/API response.
- Expired, consumed, wrong and over-attempt OTPs fail.
- Correct OTP creates a session and consumes the challenge.
- Session cookie has all secure flags.
- Registration fails without an OTP-verified session.
- Registration/login reject wrong origin, RP ID, challenge or signature.
- Successful passkey verification updates counter and creates a session.
- Revoked/expired sessions fail `requireOperator()`.

**Vercel env:**
- `TELEGRAM_BOT_TOKEN` — server-only secret; reuse the existing Solvers/Hermes bot only after verifying the configured bot identity.
- `TELEGRAM_CHAT_ID` — fixed operator destination.
- `MC_AUTH_SECRET` — random 32+ byte secret.
- `WEBAUTHN_RP_ID=dashvalentinsolvers.vercel.app`
- `WEBAUTHN_ORIGIN=https://dashvalentinsolvers.vercel.app`
- `WEBAUTHN_RP_NAME=Solvers Agency OS`

**Domain note:** Passkeys are bound to the relying-party domain. If Mission Control later moves to a custom domain, register a new passkey there before retiring the Vercel alias.

**Acceptance:**
1. Incognito shows login.
2. Requesting access sends a protected OTP to Valentin’s fixed Telegram chat.
3. OTP grants one session and offers passkey enrollment.
4. A later iPhone login succeeds through the native Face ID passkey prompt.
5. Telegram OTP still recovers access if the passkey is unavailable.

## Task 4: Lock RLS and remove demo policies

**Objective:** Remove all anonymous Supabase access; authenticated application requests go through protected same-origin Next.js APIs, while Hermes workers use service role server-side.

**Files:**
- Create: `supabase/migrations/20260709_01_secure_operator.sql`
- Modify: `supabase/schema.sql`
- Create: `scripts/verify_rls.py`

**Migration:**
1. Drop `mc_drafts_update` and `mc_automations_update` demo policies.
2. Drop public `using (true)` read policies.
3. Add `mc_auth_challenges`, `mc_passkeys`, `mc_sessions`, and `mc_events`.
4. Enable RLS with no anon/authenticated browser policies on operator/auth tables.
5. Keep service-role access for protected Next.js APIs and Hermes workers.

**Tests:** `verify_rls.py` must prove:
- anon SELECT fails;
- anon UPDATE fails;
- anon cannot read auth challenges, passkeys or sessions;
- protected application API succeeds with a valid operator cookie;
- service role worker INSERT succeeds.

**Acceptance:** Direct anon Supabase REST calls return no operator data; all dashboard access requires the signed operator session.

---

# Phase 1 — Complete the human workflow

## Task 5: Add captures as first-class records

**Objective:** Make real Solvers events enter the system from the dashboard.

**Files:**
- Create: `supabase/migrations/20260709_02_captures.sql`
- Modify: `supabase/schema.sql`
- Create: `src/lib/capture.ts`
- Create: `src/lib/__tests__/capture.test.ts`

**Table:** `mc_captures`

```sql
id uuid primary key
source text check in ('dashboard','telegram_voice','telegram_text','x_activity','system')
raw_text text not null
context text
content_type_hint text
status text check in ('inbox','processing','processed','error')
claimed_at timestamptz
processed_at timestamptz
error text
created_at timestamptz
updated_at timestamptz
```

**Tests first:**
- Empty capture rejected.
- Maximum input length enforced.
- Source must be allowlisted.
- New capture defaults to `inbox`.

## Task 6: Make “Nueva captura” functional

**Objective:** Create captures without leaving Agency OS.

**Files:**
- Create: `src/app/api/mc/captures/route.ts`
- Create: `src/components/capture-drawer.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Create: `src/app/api/mc/captures/route.test.ts`

**UX:**
- Button opens an inline right-side drawer.
- Inputs: what happened, why it mattered, result/unknown, optional type hint.
- Submit creates `mc_captures(status='inbox')`.
- Production pipeline count refreshes immediately.

**Tests first:**
- Unauthenticated POST → 401.
- Empty payload → 400.
- Valid payload → 201 + capture ID.
- UI shows success and closes only after confirmed insert.

## Task 7: Return captures and full draft bodies in live bundle

**Objective:** Replace derived/demo pipeline counts with queue truth.

**Files:**
- Modify: `src/lib/live.ts`
- Modify: `src/lib/data.ts`
- Modify: `src/app/api/mc/live/route.ts`
- Create: `src/lib/__tests__/live.test.ts`

**Behavior:**
- Bundle includes latest captures and counts by status.
- Draft bundle includes `body`, `hook`, `cta`, `captureId`, `approvedAt`.
- Pipeline counts are computed from records, not manually seeded `mc_pipeline` counts.

## Task 8: Make approval and change requests semantic

**Objective:** Replace generic status PATCH with validated actions.

**Files:**
- Modify: `src/app/api/mc/drafts/route.ts`
- Create: `src/app/api/mc/drafts/route.test.ts`
- Modify: `src/app/page.tsx`

**API contract:**

```json
{ "id": "uuid", "action": "approve|request_changes|reject", "note": "optional" }
```

**Behavior:**
- Approve requires a full body and sets `approved_at`, `approved_by`.
- Request changes stores note and sets `changes_requested`.
- Reject records reason.
- All actions insert into `mc_events`.

**Tests first:** unauthorized, invalid action, missing body, legal approval, audit row.

## Task 9: Make scheduling functional

**Objective:** Let an approved draft receive a real date/time and enter the publisher queue.

**Files:**
- Create: `src/app/api/mc/schedule/route.ts`
- Create: `src/components/schedule-editor.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/api/mc/schedule/route.test.ts`

**Behavior:**
- Only approved drafts can schedule.
- Store UTC in `scheduled_for`; display `America/Bogota`.
- Scheduling sets queue state `ready` only after explicit confirmation.
- Calendar reads `scheduled_for`, not `when_label`.

**Tests first:** pending draft rejected; missing date rejected; timezone round-trip; approved draft schedules.

---

# Phase 2 — Hermes execution plane

## Task 10: Build the shared worker client

**Objective:** Give all local workers safe, consistent Supabase queue operations.

**Files:**
- Create: `~/solvers-x-engine/scripts/mc_client.py`
- Create: `~/solvers-x-engine/scripts/tests/test_mc_client.py`

**Functions:**
- load credential env without printing values;
- atomic claim with stale-claim recovery;
- append audit event;
- read automation switch;
- update capture/draft/schedule state;
- idempotency key support.

**Tests first:** use a local fake HTTP server; verify auth headers, conflict handling, and no secret output.

## Task 11: Build the capture processor

**Objective:** Convert pending captures into structured draft work.

**Files:**
- Create: `~/solvers-x-engine/scripts/claim_capture.py`
- Create: `~/solvers-x-engine/scripts/save_draft.py`
- Create: `~/solvers-x-engine/brand/DRAFT_CONTRACT.md`
- Create: tests under `~/solvers-x-engine/scripts/tests/`

**Draft contract:**

```json
{
  "title": "internal title",
  "hook": "first line",
  "body": "publish-ready X text",
  "cta": "optional",
  "area": "A1-A6",
  "language": "ES|EN",
  "score": 0,
  "source_capture_id": "uuid",
  "reasoning_summary": "why this angle"
}
```

**Hermes job:** every 5 minutes, but exits silently if Draft Factory switch is OFF or queue is empty.

**Prompt requirements:** use `brand/voice.md`, `content-system.md`, and proof bank; never invent results/numbers; one capture may produce up to three angles but one recommended draft.

## Task 12: Build publisher in dry-run first

**Objective:** Prove the publishing queue without risking X.

**Files:**
- Create: `~/solvers-x-engine/scripts/publish_due.py`
- Create: `~/solvers-x-engine/scripts/tests/test_publish_due.py`

**Rules:**
1. Read `auto-post` switch; if OFF, exit silently.
2. Claim one `ready` due row atomically.
3. Validate body, approval, schedule, length and idempotency key.
4. In `--dry-run`, write event only; never call `xurl`.
5. In live mode, run `xurl post <body>` once.
6. Persist tweet ID/URL, `posted_at`, state `posted`.
7. On failure, state `failed`, record redacted error, never blind retry after an ambiguous network result.

**Tests first:** OFF no-op; not-due no-op; missing approval rejected; duplicate claim rejected; dry-run never invokes xurl; successful fake xurl stores ID.

## Task 13: Make X metric sync historical and quiet

**Objective:** Replace fake trajectory and avoid noisy cron deliveries.

**Files:**
- Modify: `~/solvers-x-engine/scripts/sync_x_to_supabase.py`
- Add: `~/solvers-x-engine/scripts/tests/test_sync_x.py`

**Changes:**
- `--quiet` mode prints nothing on success.
- Sparkline reads last 12 real metric snapshots instead of fabricating history.
- Derive posts/replies 7d from recent own tweets where the API allows it.
- Store `raw.source` labels per metric; UI marks unavailable analytics as unavailable, not seeded.

## Task 14: Create durable Hermes jobs

**Objective:** Wire scripts and agents into the gateway scheduler.

**Jobs:**

| Job | Schedule | Type | Delivery |
|---|---:|---|---|
| `solvers-x-sync` | every 1h | script-only quiet | silent unless error |
| `solvers-capture-processor` | every 5m | reasoning agent + claim script | silent unless draft created/error |
| `solvers-daily-pulse` | 08:30 America/Bogota | reasoning agent | Telegram + Supabase |
| `solvers-creator-scout` | Mon/Wed/Fri 09:00 | reasoning agent | Supabase, Telegram summary |
| `solvers-publisher` | every 2m | script-only | Telegram only when posted/error |

**Important:** Jobs always exist; dashboard switches control whether they act. This avoids trying to start local Hermes cron from Vercel.

**Verification:** create jobs paused, run each manually once, inspect Supabase events, then resume non-publisher jobs.

---

# Phase 3 — Press Play safely

## Task 15: Launch gates

### Gate A — Secure
- [ ] Incognito requires login.
- [ ] Anonymous REST cannot read/write operator tables.
- [ ] Service role absent from browser bundle.
- [ ] API mutation without operator session returns 401.

### Gate B — Human loop
- [ ] Create one real capture.
- [ ] Hermes produces draft with no invented facts.
- [ ] Request changes once and receive revised draft.
- [ ] Approve and schedule it.
- [ ] Calendar reflects real UTC/Bogota time.

### Gate C — Dry-run automation
- [ ] Enable Daily Pulse.
- [ ] Enable Creator Scout.
- [ ] Enable Draft Factory.
- [ ] Keep Publisher in dry-run.
- [ ] Execute three scheduled dry-runs without duplicates.

### Gate D — Publisher live
- [ ] Run `xurl whoami` and verify `@valentinflrz`.
- [ ] Valentin explicitly approves enabling Publisher.
- [ ] Publish one low-risk approved post.
- [ ] Verify tweet URL in X and Supabase.
- [ ] Keep `autonomous generation -> direct publish` impossible.

---

## 3. Recommended execution order

### Session 1 — Secure and capture
Tasks 1–6. Outcome: private dashboard + real capture inbox.

### Session 2 — Approve and schedule
Tasks 7–9. Outcome: complete human workflow in Agency OS.

### Session 3 — Hermes workers
Tasks 10–14. Outcome: factory creates/syncs/publishes from queues.

### Session 4 — Launch
Task 15. Outcome: Daily Pulse, Scout and Draft Factory ON; Publisher dry-run, then one controlled live post.

---

## 4. Seven-day operating targets after Play

| Metric | Target |
|---|---:|
| Real Solvers captures | 5 |
| Drafts generated | 7–10 |
| Drafts approved | 5 |
| Posts published | 5 |
| Value replies | 15 |
| Duplicate/unauthorized posts | 0 |
| Invented claims/numbers | 0 |
| High-ticket conversations attributed | Baseline, then optimize |

---

## 5. Files expected to change

### App
- `package.json`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/middleware.ts`
- `src/app/login/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/api/mc/captures/route.ts`
- `src/app/api/mc/drafts/route.ts`
- `src/app/api/mc/schedule/route.ts`
- `src/lib/auth.ts`
- `src/lib/workflow.ts`
- `src/lib/live.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/components/capture-drawer.tsx`
- `src/components/schedule-editor.tsx`
- tests beside each behavior

### Database
- `supabase/schema.sql`
- `supabase/migrations/20260709_01_secure_operator.sql`
- `supabase/migrations/20260709_02_captures.sql`

### Hermes execution
- `~/solvers-x-engine/scripts/mc_client.py`
- `~/solvers-x-engine/scripts/claim_capture.py`
- `~/solvers-x-engine/scripts/save_draft.py`
- `~/solvers-x-engine/scripts/publish_due.py`
- `~/solvers-x-engine/scripts/sync_x_to_supabase.py`
- `~/solvers-x-engine/brand/DRAFT_CONTRACT.md`

---

## 6. Verification commands

```bash
# App
npm test -- --run
npm run lint
npm run build

# Worker tests
python3 -m unittest discover -s ~/solvers-x-engine/scripts/tests -p 'test_*.py' -v

# Identity
xurl whoami

# Scheduler
hermes cron list --all

# Production smoke
curl -I https://dashvalentinsolvers.vercel.app
```

## 7. Explicit non-goals for first Play

- No autonomous DMs.
- No automatic likes/follows.
- No generated post publishing without a human approval record.
- No complex CRM or client OS yet.
- No vanity analytics presented as real data.
- No multi-user roles until the single-operator loop is stable.
