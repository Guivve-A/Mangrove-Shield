# Animation System - GSAP + ScrollTrigger

## Core modules

- `frontend/src/animations/sceneController.ts`
  - Registers ScrollTrigger scene orchestration.
  - Tracks active scene (`hero`, `operational`, `inspector`, `simulation`, `comparison`).
  - Configures scene pinning and scene-enter transitions.

- `frontend/src/animations/transitions.ts`
  - Shared easing tokens and reusable helpers:
    - `fadeSlideIn`
    - `blurIn`
    - `gentlePulse`

## Choreography model

1. Scene triggers
- `data-scene` sections are observed with ScrollTrigger.
- `onEnter` and `onEnterBack` dispatch scene changes to UI state.

2. Scene pinning
- Sections with `data-pin="true"` are pinned for configured distances (`data-pin-distance`).
- Operational and simulation scenes have longer pin windows for exploration.

3. Entrance motion
- Hero: blur-in title + staggered KPI chips + pulsing scroll hint.
- Scene cards: fade/slide reveal on scene entry.

4. Data transitions
- KPI values use GSAP count-up transitions (`KPIBlock`).
- Scenario/date changes crossfade map stage.
- Zone inspector sheet slides from bottom via GSAP.
- Sparkline paths animate with stroke dash draw-on.

## Reduced motion

- `prefers-reduced-motion` is detected in `pages/index.tsx`.
- Heavy scroll-scrub effects are disabled when reduce is requested.
- Fallback keeps minimal fades for state continuity.

## Cleanup pattern

- Scene controller is created inside React `useEffect` and returns cleanup.
- All timelines/triggers are scoped through `gsap.context(...)` and reverted on unmount.

## Extending safely

1. Add a new scene section with `data-scene="<name>"`.
2. Update `UIScene` union in `frontend/types/geospatial.ts`.
3. Add layer/camera behavior for the scene in `IntelligenceMap.tsx`.
4. Add scene motion rules in `sceneController.ts`.
