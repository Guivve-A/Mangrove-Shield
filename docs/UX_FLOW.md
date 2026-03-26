# UX Flow - MangroveShield Earth Intelligence

## Narrative structure

The frontend is now organized as a five-scene scroll narrative for Greater Guayaquil:

1. `Hero` (Situation)
- Pinned first viewport.
- Full-bleed map backdrop with cinematic overlay.
- Kinetic headline and four live KPI chips.

2. `Operational` (Drivers)
- Pinned operational canvas.
- Left `Signal Stack` with only three drivers: flood probability, mangrove coverage, urban exposure.
- Right `Intel Stream` with animated alert cards.
- Alert click selects zone and opens inspector workflow.

3. `Inspector` (Impact)
- Pinned context panel plus animated bottom sheet.
- Zone metrics, spark-line signal trends, and explainable driver text.
- Map focus transitions to selected zone.

4. `Simulation` (Actions)
- Pinned scenario lab with timeline, storm intensity, restoration toggle, and scenario selector.
- Scenario changes animate KPI deltas and correlation chart context.

5. `Comparison` (Decision)
- Pinned split-view mode.
- Current vs comparison scenario with synchronized camera.
- Outcome summary card for flood risk, exposed population, and critical infrastructure deltas.

## Attention guidance rules

- Progressive disclosure: each scene exposes only the controls needed for that step.
- Motion-led hierarchy: text and cards animate in scene order.
- Inspector scene defocuses map slightly while surfacing analytical details.
- Hotspot pulses are context-bound (operational/inspector interactions).

## Region scope

All scene copy and mock geography are constrained to Greater Guayaquil:
- Guayas estuary
- Isla Puna
- Golfo de Guayaquil
- Duran
- Samborondon
