import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Oswald } from 'next/font/google';

import type { LiveData } from '@/hooks/useLiveData';

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

import { getFloodStatus } from '@/lib/liveApi';

const STATUS_POLL_INTERVAL = 60_000;

interface EcosystemSectionProps {
  liveData: LiveData;
}

interface LocalFloodStatus {
  timestamp: string;
  weather: {
    weather_now: {
      rain_mm_h: number | null;
    };
    error?: string | null;
  };
  tide: {
    level_m: number | null;
    error?: string | null;
  };
  ecosystem_health?: {
    health_index?: number | null;
    classification?: string | null;
    trend?: string | null;
    date_acquired?: string | null;
    sensor?: string | null;
    error?: string | null;
    components?: {
      ndvi_mean?: number | null;
      canopy_cover?: number | null;
      fragmentation_index?: number | null;
      species_diversity?: string | number | null;
      water_quality?: string | number | null;
    };
    model?: {
      model_id?: string | null;
      version?: string | null;
    };
  };
}

type FeedState = 'LIVE' | 'SYNCING' | 'AWAITING' | 'OFFLINE' | 'STANDBY';
type PillarId = 'rain' | 'tide' | 'ndvi';

interface PillarConfig {
  id: PillarId;
  number: string;
  title: string[];
  accent: string;
  value: number | null;
  decimals: number;
  unit: string;
  source: string;
  state: FeedState;
  summary: string;
}

function formatClockLabel(value?: string | null): string {
  if (!value) {
    return '--:--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function resolveFeedState({
  value,
  error,
  isLoading = false,
}: {
  value: number | null;
  error?: string | null;
  isLoading?: boolean;
}): FeedState {
  if (value !== null) {
    return 'LIVE';
  }

  if (isLoading) {
    return 'SYNCING';
  }

  if (error === 'AWAITING_TRIGGER') {
    return 'AWAITING';
  }

  if (error) {
    return 'OFFLINE';
  }

  return 'STANDBY';
}

function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

function AnimatedMetric({
  value,
  decimals,
  isActive,
}: {
  value: number | null;
  decimals: number;
  isActive: boolean;
}): JSX.Element {
  const [displayValue, setDisplayValue] = useState(0);
  const lastValueRef = useRef(0);

  useEffect(() => {
    if (value === null) {
      setDisplayValue(0);
      lastValueRef.current = 0;
      return;
    }

    if (!isActive) {
      setDisplayValue(value);
      lastValueRef.current = value;
      return;
    }

    let animationFrame = 0;
    let startTime = 0;
    const from = lastValueRef.current;
    const distance = value - from;
    const duration = 1400;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = from + distance * eased;
      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }

      lastValueRef.current = value;
      setDisplayValue(value);
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [value, decimals, isActive]);

  if (value === null) {
    return <span>--</span>;
  }

  return <span>{formatNumber(displayValue, decimals)}</span>;
}

function RainGraphic({ accent }: { accent: string }): JSX.Element {
  const delays = ['0.1s', '0.4s', '0.2s', '0.6s', '0.3s', '0.5s', '0.7s', '0.2s'];

  return (
    <div className="flex h-36 w-full items-end justify-center gap-2 opacity-80 transition-opacity duration-300 group-hover:opacity-100">
      {delays.map((delay, index) => (
        <span
          key={`rain-${delay}-${index}`}
          className={`ecosystem-rain-bar ${index > 5 ? 'hidden md:block' : ''}`}
          style={{
            animationDelay: delay,
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${accent} 2px, ${accent} 4px)`,
          }}
        />
      ))}
    </div>
  );
}

function TideGraphic({ accent }: { accent: string }): JSX.Element {
  const delays = ['0s', '-1s', '-2s', '-1.5s', '-0.5s'];

  return (
    <div className="flex w-full flex-col items-center justify-center gap-6 opacity-80 transition-opacity duration-300 group-hover:opacity-100">
      {delays.map((delay, index) => (
        <span
          key={`tide-${delay}-${index}`}
          className="ecosystem-tide-line"
          style={{
            animationDelay: delay,
            backgroundColor: accent,
            boxShadow: `0 0 12px ${accent}66`,
          }}
        />
      ))}
    </div>
  );
}

function NdviGraphic({ accent }: { accent: string }): JSX.Element {
  const delays = ['0s', '0.18s', '0.36s', '0.12s', '0.5s', '0.28s'];

  return (
    <div className="grid w-full max-w-[220px] grid-cols-1 gap-2 opacity-80 transition-opacity duration-300 group-hover:opacity-100">
      {delays.map((delay, index) => (
        <span
          key={`ndvi-${delay}-${index}`}
          className="ecosystem-ndvi-block h-4 w-full"
          style={{
            animationDelay: delay,
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 4px, ${accent} 4px, ${accent} 7px)`,
          }}
        />
      ))}
    </div>
  );
}

export function EcosystemSection({ liveData }: EcosystemSectionProps): JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [canUseCursor, setCanUseCursor] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorExpanded, setCursorExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [localStatus, setLocalStatus] = useState<LocalFloodStatus | null>(null);
  const [localStatusError, setLocalStatusError] = useState<string | null>(null);

  const fetchCurrentStatus = useCallback(async () => {
    try {
      const payload = await getFloodStatus();
      setLocalStatus(payload as unknown as LocalFloodStatus);
      setLocalStatusError(null);
    } catch (error: unknown) {
      setLocalStatusError(error instanceof Error ? error.message : 'Unable to reach data feed.');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) {
        return;
      }

      await fetchCurrentStatus();
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, STATUS_POLL_INTERVAL);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [fetchCurrentStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(pointer: fine)');
    const updatePointerState = () => setCanUseCursor(mediaQuery.matches);

    updatePointerState();
    mediaQuery.addEventListener('change', updatePointerState);

    return () => mediaQuery.removeEventListener('change', updatePointerState);
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await fetchCurrentStatus();
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!canUseCursor || !cursorRef.current) {
      return;
    }

    cursorRef.current.style.left = `${event.clientX}px`;
    cursorRef.current.style.top = `${event.clientY}px`;
    setCursorVisible(true);
  };

  const localRainValue =
    localStatus && !localStatus.weather.error && localStatus.weather.weather_now.rain_mm_h !== null
      ? localStatus.weather.weather_now.rain_mm_h
      : null;
  const liveRainValue = liveData.weather.data?.weather_now.rain_mm_h ?? null;
  const rainValue = localRainValue ?? liveRainValue;
  const rainError = localStatus?.weather?.error ?? liveData.weather.error;
  const rainState = resolveFeedState({
    value: rainValue,
    error: rainError,
    isLoading: liveData.weather.isLoading && rainValue === null,
  });

  const tideValue =
    localStatus && !localStatus.tide.error && localStatus.tide.level_m !== null
      ? localStatus.tide.level_m
      : null;
  const tideError = localStatus?.tide?.error ?? (localStatusError ? 'LOCAL_STATUS_OFFLINE' : undefined);
  const tideState = resolveFeedState({
    value: tideValue,
    error: tideError,
    isLoading: !localStatus && !localStatusError,
  });

  const ecosystemFeed = liveData.ecosystemHealth.data;
  const localEcosystemFeed = localStatus?.ecosystem_health;
  const ndviValue = localEcosystemFeed?.components?.ndvi_mean ?? ecosystemFeed?.components.ndvi_mean ?? localEcosystemFeed?.health_index ?? null;
  const canopyCover = localEcosystemFeed?.components?.canopy_cover ?? ecosystemFeed?.components.canopy_cover ?? null;
  const fragmentationIndex = localEcosystemFeed?.components?.fragmentation_index ?? ecosystemFeed?.components.fragmentation_index ?? null;
  const ndviError = liveData.ecosystemHealth.error ?? localEcosystemFeed?.error;
  const ndviClassification = localEcosystemFeed?.classification ?? ecosystemFeed?.classification ?? null;
  const ndviTrend = localEcosystemFeed?.trend ?? ecosystemFeed?.trend ?? null;
  const ndviState = resolveFeedState({
    value: ndviValue,
    error: ndviError,
    isLoading: liveData.ecosystemHealth.isLoading && ndviValue === null,
  });

  const syncLabel =
    localStatus?.timestamp != null
      ? `SYNC ${formatClockLabel(localStatus.timestamp)}`
      : liveData.weather.data?.timestamp
        ? `LIVE ${formatClockLabel(liveData.weather.data.timestamp)}`
        : 'BOOT';

  const ndviSummary = ndviClassification
    ? `Sentinel-2 sigue el vigor del manglar. Estado ${ndviClassification.toUpperCase()} con tendencia ${(ndviTrend ?? 'stable').toUpperCase()}.`
    : ecosystemFeed
    ? `Sentinel-2 sigue el vigor del manglar. Estado ${ecosystemFeed.classification.toUpperCase()} con tendencia ${ecosystemFeed.trend.toUpperCase()}.`
    : localEcosystemFeed?.error === 'AWAITING_TRIGGER'
      ? 'La capa satelital esta en espera. Usa Sync para solicitar una lectura NDVI.'
      : ndviError
        ? 'La capa ecosistemica esta degradada. El panel conserva el ultimo indice disponible.'
        : 'El motor ecosistemico esta enlazando la ultima escena satelital disponible.';

  const pillars: PillarConfig[] = [
    {
      id: 'rain',
      number: '.01',
      title: ['PRECIPITACION', 'ACTIVA'],
      accent: 'var(--storm-orange)',
      value: rainValue,
      decimals: 1,
      unit: 'MM / HR',
      source: 'OPENWEATHER / RAIN PROXY',
      state: rainState,
      summary:
        rainState === 'AWAITING'
          ? 'El stream meteorologico esta en espera. Usa Sync para solicitar una lectura inmediata.'
          : rainState === 'OFFLINE'
            ? 'La capa meteorologica esta degradada. El panel conserva el ultimo proxy disponible.'
            : 'OpenWeather y los proxies hidrologicos siguen la lluvia horaria para anticipar saturacion.',
    },
    {
      id: 'tide',
      number: '.02',
      title: ['OSCILACION', 'MARITIMA'],
      accent: 'var(--sat-cyan)',
      value: tideValue,
      decimals: 2,
      unit: 'METROS',
      source: 'STORMGLASS / SEA LEVEL',
      state: tideState,
      summary:
        tideState === 'AWAITING'
          ? 'La cola costera esta inactiva. Usa Sync para pedir una lectura de nivel del mar.'
          : tideState === 'OFFLINE'
            ? 'La telemetria maritima esta degradada. El motor espera un nuevo paquete costero.'
            : 'El feed costero consulta el nivel del mar para detectar amplitud anomala antes de la intrusion.',
    },
    {
      id: 'ndvi',
      number: '.03',
      title: ['COBERTURA', 'NDVI'],
      accent: 'var(--estuary)',
      value: ndviValue,
      decimals: 2,
      unit: 'INDICE',
      source: localEcosystemFeed?.model?.version
        ? `SENTINEL-2 / ${localEcosystemFeed.model.version}`
        : ecosystemFeed?.model?.version
          ? `SENTINEL-2 / ${ecosystemFeed.model.version}`
          : 'SENTINEL-2 / HEALTH LAYER',
      state: ndviState,
      summary: ndviSummary,
    },
  ];

  return (
    <section
      id="ecosystem"
      ref={sectionRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setCursorVisible(false);
        setCursorExpanded(false);
      }}
      className={`relative overflow-hidden bg-[#05090d] text-white selection:bg-white selection:text-black ${canUseCursor ? 'cursor-none' : ''}`}
    >
      <div id="mangrove" className="pointer-events-none absolute top-0 h-px w-px" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(25,211,218,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(242,140,56,0.14),transparent_28%),linear-gradient(180deg,#020406_0%,#07141d_52%,#05090d_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,transparent_100%)]" />

      <div
        ref={cursorRef}
        className={`${canUseCursor ? 'block' : 'hidden'} pointer-events-none fixed left-[-100px] top-[-100px] z-[70] -translate-x-1/2 -translate-y-1/2 transition-[width,height,opacity] duration-200`}
        style={{
          width: cursorExpanded ? 40 : 20,
          height: cursorExpanded ? 40 : 20,
          opacity: cursorVisible ? 1 : 0,
        }}
      >
        <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white mix-blend-difference" />
        <span className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-white mix-blend-difference" />
      </div>

      <div className="relative z-10 px-6 pb-10 pt-24 md:px-10 lg:px-14">
        <header className="border-b border-white/8 bg-black/10 backdrop-blur-sm">
          <div className="flex flex-col items-center px-1 pb-4 pt-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-white/45">
              MangroveShield Live
            </div>

            <div className="mt-5 flex w-full items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
              <span className="hidden md:inline">Rain / Tide / NDVI</span>
              <span className="hidden h-px flex-1 bg-white/15 md:block" />

              <h2
                className={`${oswald.className} mx-2 whitespace-nowrap text-center text-4xl uppercase leading-none tracking-[0.08em] text-white md:text-6xl lg:text-[5.2rem]`}
              >
                Motor Predictivo
              </h2>

              <span className="hidden h-px flex-1 bg-white/15 md:block" />
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="inline-flex min-h-9 items-center justify-center border border-white/14 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white/70 transition-colors duration-300 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSyncing ? 'SYNCING' : 'SYNC >'}
              </button>
            </div>

            <div className="mt-5 flex w-full items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-white/35">
              <span>{localStatusError ? 'Local feed offline' : 'Operational matrix'}</span>
              <span>{syncLabel}</span>
            </div>
          </div>
        </header>

        <div className="flex w-full flex-col bg-black/10 backdrop-blur-[2px] lg:min-h-[calc(100vh-11rem)] lg:flex-row">
          {pillars.map((pillar) => (
            <article
              key={pillar.id}
              onPointerEnter={() => {
                if (canUseCursor) {
                  setCursorExpanded(true);
                }
              }}
              onPointerLeave={() => setCursorExpanded(false)}
              className="group relative flex min-h-[460px] flex-1 flex-col overflow-hidden border-t-2 border-white/10 border-b border-b-white/8 px-8 py-8 transition-[flex,background-color,transform] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] lg:min-h-0 lg:border-b-0 lg:px-10 lg:py-10 lg:hover:flex-[1.22] lg:hover:bg-white/[0.02]"
              style={{
                borderTopColor: pillar.accent,
                borderRight: pillar.id !== 'ndvi' ? '1px solid rgba(255,255,255,0.08)' : undefined,
                transform: isVisible ? 'translateY(0px)' : 'translateY(22px)',
                opacity: isVisible ? 1 : 0,
                transitionDelay: isVisible ? '0ms' : '0ms',
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-40 opacity-25 blur-3xl"
                style={{
                  background: `radial-gradient(circle at top, ${pillar.accent}55 0%, transparent 72%)`,
                }}
              />

              <div className="relative z-10 text-right">
                <span
                  className="font-mono text-6xl font-bold tracking-[-0.08em] md:text-8xl"
                  style={{
                    color: 'transparent',
                    WebkitTextStroke: `1px ${pillar.accent}`,
                  }}
                >
                  {pillar.number}
                </span>
              </div>

              <div className="relative z-10 flex min-h-[220px] flex-1 items-center justify-center transition-transform duration-500 group-hover:scale-[1.05]">
                {pillar.id === 'rain' && <RainGraphic accent={pillar.accent} />}
                {pillar.id === 'tide' && <TideGraphic accent={pillar.accent} />}
                {pillar.id === 'ndvi' && <NdviGraphic accent={pillar.accent} />}
              </div>

              <div className="relative z-10 mt-auto">
                <h3
                  className={`${oswald.className} mb-6 text-5xl uppercase leading-[0.88] tracking-[0.04em] md:text-6xl lg:text-[4.3rem]`}
                  style={{ color: pillar.accent }}
                >
                  {pillar.title[0]}
                  <br />
                  {pillar.title[1]}
                </h3>

                <div className="font-mono" style={{ color: pillar.accent }}>
                  <div className="flex items-end gap-3 border-b pb-3" style={{ borderColor: `${pillar.accent}55` }}>
                    <span className="text-4xl font-light leading-none md:text-[2.8rem]">
                      <AnimatedMetric value={pillar.value} decimals={pillar.decimals} isActive={isVisible} />
                    </span>
                    <span className="mb-1 text-[11px] uppercase tracking-[0.28em] text-white/55">
                      {pillar.unit}
                    </span>
                  </div>

                  {/* Sub-metrics for the NDVI pillar — real Earth Engine outputs */}
                  {pillar.id === 'ndvi' && (canopyCover !== null || fragmentationIndex !== null) && (
                    <div className="mt-3 border-b pb-3 grid grid-cols-2 gap-x-4 gap-y-1" style={{ borderColor: `${pillar.accent}33` }}>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-[0.22em] text-white/40">Cobertura Dosel</span>
                        <span className="text-lg font-medium leading-none mt-1">
                          <AnimatedMetric value={canopyCover !== null ? canopyCover * 100 : null} decimals={1} isActive={isVisible} />
                          <span className="text-[10px] text-white/45 ml-1">%</span>
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-[0.22em] text-white/40">Fragmentación</span>
                        <span className="text-lg font-medium leading-none mt-1">
                          <AnimatedMetric value={fragmentationIndex} decimals={3} isActive={isVisible} />
                          <span className="text-[10px] text-white/45 ml-1">idx</span>
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.18em]">
                    <span
                      className="rounded-full border px-3 py-1"
                      style={{
                        borderColor: `${pillar.accent}55`,
                        color: pillar.accent,
                      }}
                    >
                      {pillar.state}
                    </span>
                    <span className="text-white/38">{pillar.source}</span>
                  </div>

                  <p className="mt-4 max-w-sm text-sm leading-6 text-white/72">
                    {pillar.summary}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <style jsx>{`
        .ecosystem-rain-bar {
          width: 26px;
          height: 100%;
          transform-origin: bottom;
          animation: ecosystem-eq-bounce 1.5s infinite ease-in-out alternate;
        }

        .ecosystem-tide-line {
          height: 2px;
          width: 72px;
          animation: ecosystem-tide-wave 3s infinite ease-in-out;
        }

        .ecosystem-ndvi-block {
          animation: ecosystem-ndvi-pulse 2s infinite steps(5);
        }

        @keyframes ecosystem-eq-bounce {
          0% {
            height: 22%;
            opacity: 0.45;
          }
          100% {
            height: 100%;
            opacity: 1;
          }
        }

        @keyframes ecosystem-tide-wave {
          0%,
          100% {
            transform: translateX(-26px);
            width: 42px;
            opacity: 0.35;
          }
          50% {
            transform: translateX(26px);
            width: 112px;
            opacity: 1;
          }
        }

        @keyframes ecosystem-ndvi-pulse {
          0%,
          100% {
            opacity: 0.24;
          }
          50% {
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ecosystem-rain-bar,
          .ecosystem-tide-line,
          .ecosystem-ndvi-block {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
