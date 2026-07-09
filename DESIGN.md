# Design — Solvers Mission Control

## Direction
Vercel dashboard × X dark UI. Product register. Monochrome only.

## Tokens
```
--bg: #000000
--panel: #0a0a0a
--panel-2: #111111
--line: #1a1a1a
--line-strong: #2a2a2a
--ink: #fafafa
--body: #e5e5e5
--muted: #a3a3a3
--faint: #737373
--dim: #525252
--good: #4ade80
--warn: #facc15
--bad: #f87171
```

## Type
- UI: system-ui / Inter-like (system stack)
- Data / handles / IDs: ui-monospace
- Scale: 11 / 12 / 13 / 14 / 16 / 20 / 28
- Weights: 400 body, 500 labels, 600 titles only when needed

## Layout
- Fixed left rail 240px (desktop)
- Main max ~1120 content
- 8px base grid
- Hairline borders, 10–12px radius max (tool, not toy)
- No nested cards; sections = border + bg shift

## Signature
Left rail solid black with white active pill. Status chips monochrome except state colors.

## Motion
Almost none. Tab switch instant. Optional 120ms opacity on panel enter.
