# Data Formatting and Validation Rules

## Formatter module

Formatting and clamping are centralized in:
- `frontend/lib/format.ts`

## Rules

1. Percent values
- Internal probability/index values are normalized to `0..1`.
- Display uses `formatPercent(value)` and is clamped to `0%..100%`.

2. Rainfall
- Rainfall is displayed with one decimal in millimeters via `formatMillimeters(value)`.
- Values are clamped to non-negative safe bounds.

3. Large numbers
- Population and infrastructure counters use:
  - `formatInteger(value)` for full values.
  - `formatCompactNumber(value)` for compact deltas/cards.

4. Delta values
- Signed indicators use `formatSignedDelta`.
- Positive and negative signs are explicit.

## Why this matters

- Prevents impossible outputs (for example, `126%` mangrove coverage).
- Keeps KPI language consistent across scenes.
- Improves trust for decision-support demonstrations.

## Diagnostics

Non-intrusive diagnostics drawer shows:
- API connectivity status (`online`, `loading`, `degraded`).
- Layer counts for required GeoJSON feeds.
- Missing layer detection without blocking UI.
