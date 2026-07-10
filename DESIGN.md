# Design — Solvers Agency OS / Mission Control v2.0

## Direction
**Editorial operations room.** Think a high-ticket studio’s internal command screen: the restraint of Vercel, the navigation clarity of Linear, and the real-time density of an operations desk. Distinction comes from hierarchy and composition — not color effects.

## Signature
The **Operating Horizon**: one broad, asymmetric command surface combining weekly completion, live account trajectory, throughput and the single next action. It replaces the generic four-KPI hero row.

## Palette
- `void` — `#050505` page
- `rail` — `#090909` navigation/context surfaces
- `surface` — `#0D0D0D` working planes
- `line` — `#232323` structure
- `paper` — `#F2F0EA` primary inversion/action
- `ink` — `#F5F5F3` foreground
- `muted` — `#999995` secondary copy
- `signal` — `#D7FF64` live/primary system signal, used sparingly
- semantic green/amber/red only for status

## Type
- UI: Inter
- Data/labels: JetBrains Mono
- Scale: 10 / 11 / 12 / 13 / 15 / 18 / 24 / 40 / 56
- Product density; large type only for the weekly thesis.

## Layout
Desktop (≥1180px):
```text
┌──────────────┬─────────────────────────────────────┬───────────────┐
│ Agency rail  │ Workspace / operating canvas        │ Action rail   │
│ 224px        │ minmax(0, 1fr)                      │ 288px         │
└──────────────┴─────────────────────────────────────┴───────────────┘
```
- No centered `max-w-6xl` shell
- 4pt scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Structural borders, 0–12px radius; no pill soup
- Cards only for actionable, bounded objects; analytics group by alignment/dividers

Tablet/mobile:
- Rails collapse into top bar and bottom nav
- Action rail becomes an inline section
- Touch targets ≥44px

## Interaction
- 160–220ms state transitions, ease-out
- Visible `focus-visible` outline
- Skeleton-style loading; no isolated spinner
- Draft approval gives explicit busy/error state
- Reduced-motion disables non-essential transitions

## Navigation
- Command
- Production
- Calendar
- Review
- Systems

## Version marker
Visible in rail/footer: `Agency OS · 2.0` so deployments cannot be confused with v1.x.
