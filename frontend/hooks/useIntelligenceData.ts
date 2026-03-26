import { startTransition, useEffect, useMemo, useRef, useState } from 'react';

import { loadLayerBundle, loadTimeline } from '@/lib/api';
import { SCENARIOS } from '@/lib/constants';
import { extractTopZones, inspectZone } from '@/lib/geo';
import { buildAlerts, computeMetrics, computeTimeSeries } from '@/lib/metrics';
import { applyScenario } from '@/lib/scenario';
import type {
  LayerBundle,
  ScenarioKey,
  TopZoneRecord,
  ZoneInspection,
} from '@/types/geospatial';

const EMPTY_BUNDLE: LayerBundle = {
  flood: { type: 'FeatureCollection', features: [] },
  priorities: { type: 'FeatureCollection', features: [] },
  mangroveExtent: { type: 'FeatureCollection', features: [] },
  mangroveHotspots: { type: 'FeatureCollection', features: [] },
};

export function useIntelligenceData() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dates, setDates] = useState<string[]>([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);

  const [stormIntensity, setStormIntensity] = useState(1);
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>('current');
  const [compareScenarioKey, setCompareScenarioKey] = useState<ScenarioKey>('degraded');
  const [restorationEnabled, setRestorationEnabled] = useState(false);
  const [terrainMode, setTerrainMode] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [bundlesByDate, setBundlesByDate] = useState<Record<string, LayerBundle>>({});
  const cancelBackgroundPrefetchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;

    const run = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const timeline = await loadTimeline();
        const uniqueDates = timeline.length ? timeline : ['2026-01-01'];
        const initialDate = uniqueDates[0];
        const initialBundle = await loadLayerBundle(initialDate);

        if (!active) {
          return;
        }

        startTransition(() => {
          setDates(uniqueDates);
          setBundlesByDate({ [initialDate]: initialBundle });
          setSelectedDateIndex(0);
        });

        const remainingDates = uniqueDates.filter((date) => date !== initialDate);
        if (!remainingDates.length || typeof window === 'undefined') {
          return;
        }

        const windowWithIdleCallback = window as Window & typeof globalThis & {
          requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
          cancelIdleCallback?: (handle: number) => void;
        };

        const preloadRemaining = async (): Promise<void> => {
          const bundles = await Promise.all(remainingDates.map(async (date) => [date, await loadLayerBundle(date)] as const));
          if (!active) {
            return;
          }

          startTransition(() => {
            setBundlesByDate((current) => {
              const next = { ...current };
              let hasChanges = false;

              for (const [date, bundle] of bundles) {
                if (!next[date]) {
                  next[date] = bundle;
                  hasChanges = true;
                }
              }

              return hasChanges ? next : current;
            });
          });
        };

        if (typeof windowWithIdleCallback.requestIdleCallback === 'function') {
          const handle = windowWithIdleCallback.requestIdleCallback(() => {
            void preloadRemaining();
          }, { timeout: 1500 });
          cancelBackgroundPrefetchRef.current = () => windowWithIdleCallback.cancelIdleCallback?.(handle);
        } else {
          const handle = window.setTimeout(() => {
            void preloadRemaining();
          }, 300);
          cancelBackgroundPrefetchRef.current = () => window.clearTimeout(handle);
        }
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError((loadError as Error).message || 'Failed to load geospatial intelligence data');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
      cancelBackgroundPrefetchRef.current?.();
    };
  }, []);

  const selectedDate = dates[Math.min(selectedDateIndex, Math.max(0, dates.length - 1))] || '';
  const hasSelectedBundle = Boolean(selectedDate && bundlesByDate[selectedDate]);
  const baseBundle = bundlesByDate[selectedDate] || EMPTY_BUNDLE;

  useEffect(() => {
    if (!selectedDate || hasSelectedBundle) {
      return;
    }

    let active = true;

    const loadSelectedBundle = async (): Promise<void> => {
      try {
        const bundle = await loadLayerBundle(selectedDate);
        if (!active) {
          return;
        }

        startTransition(() => {
          setBundlesByDate((current) => (
            current[selectedDate]
              ? current
              : {
                ...current,
                [selectedDate]: bundle,
              }
          ));
        });
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError((loadError as Error).message || 'Failed to load geospatial intelligence data');
      }
    };

    void loadSelectedBundle();

    return () => {
      active = false;
    };
  }, [selectedDate, hasSelectedBundle]);

  const scenario = SCENARIOS.find((item) => item.key === scenarioKey) || SCENARIOS[1];
  const compareScenario = SCENARIOS.find((item) => item.key === compareScenarioKey) || SCENARIOS[2];
  const baselineScenario = SCENARIOS.find((item) => item.key === 'current') || SCENARIOS[1];

  const activeBundle = useMemo(
    () => applyScenario(baseBundle, scenario, stormIntensity, restorationEnabled),
    [baseBundle, scenario, stormIntensity, restorationEnabled]
  );

  const compareBundle = useMemo(
    () => applyScenario(baseBundle, compareScenario, stormIntensity, restorationEnabled),
    [baseBundle, compareScenario, stormIntensity, restorationEnabled]
  );

  const topZones: TopZoneRecord[] = useMemo(() => extractTopZones(activeBundle, 5), [activeBundle]);
  const baselineBundle = useMemo(
    () => applyScenario(baseBundle, baselineScenario, stormIntensity, false),
    [baseBundle, baselineScenario, stormIntensity]
  );
  const baselineTopZones: TopZoneRecord[] = useMemo(() => extractTopZones(baselineBundle, 5), [baselineBundle]);

  useEffect(() => {
    if (!topZones.length) {
      setSelectedZoneId(null);
      return;
    }

    if (!selectedZoneId || !topZones.find((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(topZones[0].id);
    }
  }, [topZones, selectedZoneId]);

  const selectedZone: ZoneInspection | null = useMemo(
    () => inspectZone(activeBundle, selectedZoneId),
    [activeBundle, selectedZoneId]
  );

  const metrics = useMemo(
    () => computeMetrics(activeBundle, selectedDate, scenario, stormIntensity, topZones),
    [activeBundle, selectedDate, scenario, stormIntensity, topZones]
  );
  const baselineMetrics = useMemo(
    () => computeMetrics(baselineBundle, selectedDate, baselineScenario, stormIntensity, baselineTopZones),
    [baselineBundle, selectedDate, baselineScenario, stormIntensity, baselineTopZones]
  );

  const alerts = useMemo(
    () => buildAlerts(metrics, topZones, scenario, restorationEnabled, selectedDate),
    [metrics, topZones, scenario, restorationEnabled, selectedDate]
  );

  const scenarioBundlesByDate = useMemo(() => {
    const derived: Record<string, LayerBundle> = {};
    for (const date of dates) {
      const bundle = bundlesByDate[date];
      if (!bundle) {
        continue;
      }
      derived[date] = applyScenario(bundle, scenario, stormIntensity, restorationEnabled);
    }
    return derived;
  }, [dates, bundlesByDate, scenario, stormIntensity, restorationEnabled]);

  const timeSeries = useMemo(
    () => computeTimeSeries(
      dates.filter((date) => Boolean(scenarioBundlesByDate[date])),
      scenarioBundlesByDate,
      scenario,
      stormIntensity
    ),
    [dates, scenarioBundlesByDate, scenario, stormIntensity]
  );

  return {
    isLoading,
    error,
    dates,
    selectedDate,
    selectedDateIndex,
    setSelectedDateIndex,
    stormIntensity,
    setStormIntensity,
    scenario,
    scenarioKey,
    setScenarioKey,
    compareScenario,
    compareScenarioKey,
    setCompareScenarioKey,
    restorationEnabled,
    setRestorationEnabled,
    terrainMode,
    setTerrainMode,
    comparisonMode,
    setComparisonMode,
    activeBundle,
    compareBundle,
    metrics,
    baselineMetrics,
    topZones,
    selectedZone,
    selectedZoneId,
    setSelectedZoneId,
    alerts,
    timeSeries,
  };
}
