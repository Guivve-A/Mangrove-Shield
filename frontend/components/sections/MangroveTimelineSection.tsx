import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Oswald } from 'next/font/google';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import type { MangroveTimelineResponse, MangroveYearRecord } from '@/types/geospatial';
import { loadMangroveTimeline } from '@/lib/api';

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// ---------------------------------------------------------------------------
// Animated count-up hook
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration: number, active: boolean): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, active]);

  return value;
}

// ---------------------------------------------------------------------------
// TimeSlider component
// ---------------------------------------------------------------------------

interface TimeSliderProps {
  years: number[];
  selectedIndex: number;
  onChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

function TimeSlider({ years, selectedIndex, onChange, isPlaying, onTogglePlay }: TimeSliderProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Play controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">
          {isPlaying ? 'Reproduciendo' : 'Pausado'}
        </span>
      </div>

      {/* Year track */}
      <div className="relative flex w-full max-w-xl items-center justify-between px-2">
        {/* Background line */}
        <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-white/15" />
        {/* Progress line */}
        <div
          className="absolute left-2 top-1/2 h-px -translate-y-1/2 bg-emerald-400/60 transition-all duration-400"
          style={{ width: `${(selectedIndex / Math.max(years.length - 1, 1)) * 100}%` }}
        />

        {years.map((year, i) => {
          const isActive = i === selectedIndex;
          return (
            <button
              key={year}
              onClick={() => onChange(i)}
              className="group relative z-10 flex flex-col items-center"
              aria-label={`Seleccionar año ${year}`}
            >
              <div
                className={`h-3 w-3 rounded-full border-2 transition-all duration-300 ${
                  isActive
                    ? 'scale-125 border-emerald-400 bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]'
                    : 'border-white/30 bg-white/10 group-hover:border-white/60'
                }`}
              />
              <span
                className={`mt-2 font-mono text-[11px] transition-colors ${
                  isActive ? 'font-bold text-emerald-400' : 'text-white/40 group-hover:text-white/70'
                }`}
              >
                {year}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating stats panel (top-right of map area)
// ---------------------------------------------------------------------------

interface StatsPanelProps {
  record: MangroveYearRecord;
  prevRecord: MangroveYearRecord | null;
}

function StatsPanel({ record, prevRecord }: StatsPanelProps) {
  const deltaSign = record.delta_ha >= 0 ? '+' : '';
  const deltaColor = record.delta_ha >= 0 ? 'text-emerald-400' : 'text-red-400';
  const arrow = record.delta_ha >= 0 ? '\u25B2' : '\u25BC';

  return (
    <div className="rounded-xl border border-white/10 bg-black/70 px-5 py-4 backdrop-blur-xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        Cobertura {record.year}
      </p>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-baseline justify-between gap-6">
          <span className="text-[12px] text-white/60">Total</span>
          <span className="font-mono text-[15px] font-semibold text-white">
            {record.total_ha.toLocaleString()} ha
          </span>
        </div>
        {prevRecord && (
          <div className="flex items-baseline justify-between gap-6">
            <span className="text-[12px] text-white/60">vs anterior</span>
            <span className={`font-mono text-[15px] font-semibold ${deltaColor}`}>
              {deltaSign}{record.delta_ha.toLocaleString()} ha {arrow}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-6">
          <span className="text-[12px] text-white/60">Tasa de pérdida</span>
          <span className="font-mono text-[15px] font-semibold text-amber-400">
            {record.loss_rate_pct}% anual
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for Recharts
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a1628]/95 px-4 py-3 text-[12px] shadow-xl backdrop-blur-md">
      <p className="mb-1.5 font-mono text-[11px] font-bold text-white/70">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-white/60">
            {entry.dataKey === 'total_ha' ? 'Cobertura' : 'Pérdida acum.'}:
          </span>
          <span className="font-mono font-semibold text-white">
            {entry.value.toLocaleString()} ha
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------

export function MangroveTimelineSection() {
  const [data, setData] = useState<MangroveTimelineResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  // Intersection observer for viewport entry
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Load data on mount
  useEffect(() => {
    let cancelled = false;
    loadMangroveTimeline().then((res) => {
      if (!cancelled) setData(res);
    });
    return () => { cancelled = true; };
  }, []);

  // Auto-play cycling
  useEffect(() => {
    if (!isPlaying || !data) return;
    const timer = setInterval(() => {
      setSelectedIndex((prev) => {
        const next = prev + 1;
        if (next >= data.records.length) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying, data]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && data && selectedIndex >= data.records.length - 1) {
        setSelectedIndex(0);
      }
      return !prev;
    });
  }, [data, selectedIndex]);

  // Derived data
  const records = data?.records ?? [];
  const years = data?.years ?? [];
  const selectedRecord = records[selectedIndex] ?? null;
  const prevRecord = selectedIndex > 0 ? records[selectedIndex - 1] : null;

  const totalLoss = data?.summary.total_loss_ha ?? 0;
  const totalGain = data?.summary.total_gain_ha ?? 0;
  const netChange = data?.summary.net_change_ha ?? 0;

  // Chart data: add cumulative loss column
  const chartData = useMemo(() => {
    let cumLoss = 0;
    return records.map((r) => {
      cumLoss += r.loss_ha;
      return { ...r, cumulative_loss: cumLoss };
    });
  }, [records]);

  // Animated metric counters
  const animLoss = useCountUp(totalLoss, 1800, isVisible);
  const animGain = useCountUp(totalGain, 1800, isVisible);
  const animNet = useCountUp(Math.abs(netChange), 1800, isVisible);

  if (!data) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center bg-[#0a1628]">
        <div className="rounded-full border border-white/10 bg-ocean-dark/70 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55 backdrop-blur-md">
          Cargando datos GMW v3.0...
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="mangrove-timeline"
      className="relative w-full overflow-hidden bg-[#0a1628] py-20 font-sans"
    >
      {/* Background decoration */}
      <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-[180px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-red-500/5 blur-[160px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Data provenance badge */}
        <div className="mb-6 flex justify-center">
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] backdrop-blur-md ${
            data._source === 'firestore'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${
              data._source === 'firestore' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
            }`} />
            {data._source === 'firestore'
              ? 'Datos en vivo \u00b7 GMW v3.0 via GEE Pipeline \u2192 Firestore'
              : 'Estimaci\u00f3n calibrada \u00b7 GMW v3.0 + SERVIR Amazonia v1.1 (literatura)'}
          </div>
        </div>

        {/* ─── Zone 1: Header with animated metrics ─── */}
        <div className="mb-16 text-center">
          <span className="mb-4 block font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-400/70">
            Global Mangrove Watch v3.0
          </span>
          <h2
            className={`${oswald.className} text-4xl uppercase leading-none tracking-[0.05em] text-white md:text-6xl`}
          >
            Cambio Histórico de Manglar
          </h2>
          <p className="mt-3 font-mono text-[13px] uppercase tracking-[0.15em] text-white/40">
            Gran Guayaquil &middot; 2014 &rarr; 2024
          </p>

          {/* Metric cards */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
            <div className="flex flex-col items-center rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-4 backdrop-blur-sm">
              <span className={`${oswald.className} text-3xl font-bold text-red-400 md:text-4xl`}>
                -{animLoss.toLocaleString()} ha
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Pérdidas
              </span>
            </div>
            <div className="flex flex-col items-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-4 backdrop-blur-sm">
              <span className={`${oswald.className} text-3xl font-bold text-emerald-400 md:text-4xl`}>
                +{animGain.toLocaleString()} ha
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Ganancias
              </span>
            </div>
            <div className="flex flex-col items-center rounded-xl border border-amber-500/20 bg-amber-500/5 px-6 py-4 backdrop-blur-sm">
              <span className={`${oswald.className} text-3xl font-bold text-amber-400 md:text-4xl`}>
                {netChange >= 0 ? '+' : '-'}{animNet.toLocaleString()} ha
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Balance Neto
              </span>
            </div>
          </div>
        </div>

        {/* ─── Zone 2: Interactive map area with slider ─── */}
        <div className="relative mb-12 rounded-2xl border border-white/8 bg-[#0d1a2e] p-1">
          {/* Map placeholder with coverage visualization */}
          <div className="relative h-[380px] overflow-hidden rounded-xl bg-gradient-to-br from-[#0b1929] to-[#0a1220] md:h-[480px]">
            {/* Grid overlay */}
            <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />

            {/* Central coverage visualization */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Mangrove coverage circle */}
              <div className="relative">
                <svg viewBox="0 0 200 200" width="220" height="220" className="drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  {/* Background ring */}
                  <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  {/* Coverage arc */}
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="url(#coverageGrad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${((selectedRecord?.total_ha ?? 0) / 55000) * 534} 534`}
                    transform="rotate(-90 100 100)"
                    className="transition-all duration-700"
                  />
                  {/* Loss arc */}
                  <circle
                    cx="100"
                    cy="100"
                    r="72"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${((selectedRecord?.loss_ha ?? 0) / 2000) * 452} 452`}
                    transform="rotate(-90 100 100)"
                    opacity="0.7"
                    className="transition-all duration-700"
                  />
                  {/* Gain arc */}
                  <circle
                    cx="100"
                    cy="100"
                    r="72"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${((selectedRecord?.gain_ha ?? 0) / 500) * 452} 452`}
                    transform="rotate(90 100 100)"
                    opacity="0.7"
                    className="transition-all duration-700"
                  />
                  <defs>
                    <linearGradient id="coverageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className={`${oswald.className} text-3xl font-bold text-white md:text-4xl`}>
                    {(selectedRecord?.total_ha ?? 0).toLocaleString()}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                    hectáreas
                  </span>
                  <span className={`mt-1 font-mono text-[13px] font-bold ${
                    (selectedRecord?.delta_ha ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {(selectedRecord?.delta_ha ?? 0) >= 0 ? '+' : ''}{(selectedRecord?.delta_ha ?? 0).toLocaleString()} ha
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-6 flex items-center gap-5 font-mono text-[10px] text-white/50">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Cobertura
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  Pérdida
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-cyan-500" />
                  Ganancia
                </div>
              </div>
            </div>

            {/* Floating stats panel — top right */}
            {selectedRecord && (
              <div className="absolute right-3 top-3 w-56">
                <StatsPanel record={selectedRecord} prevRecord={prevRecord} />
              </div>
            )}

            {/* Year badge — top left */}
            <div className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                Año Seleccionado
              </span>
              <span className={`${oswald.className} ml-2 text-lg font-bold text-emerald-400`}>
                {selectedRecord?.year ?? '—'}
              </span>
            </div>
          </div>

          {/* Slider below the map */}
          <div className="mt-4 px-4 pb-3">
            <TimeSlider
              years={years}
              selectedIndex={selectedIndex}
              onChange={(i) => { setSelectedIndex(i); setIsPlaying(false); }}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
            />
          </div>
        </div>

        {/* ─── Zone 3: Area chart ─── */}
        <div className="rounded-2xl border border-white/8 bg-[#0d1a2e] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">
                Evolución de Cobertura
              </h3>
              <p className="mt-1 text-[13px] text-white/25">
                Hectáreas de manglar &middot; 2014 – 2024
              </p>
            </div>
            <div className="flex items-center gap-4 font-mono text-[10px] text-white/40">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-5 rounded-sm bg-emerald-500/40" />
                Cobertura
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-5 border-t border-dashed border-red-400" />
                Pérdida acum.
              </div>
            </div>
          </div>

          <div className="h-[260px] w-full md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                onClick={(e) => {
                  if (e?.activeTooltipIndex !== undefined) {
                    setSelectedIndex(e.activeTooltipIndex);
                    setIsPlaying(false);
                  }
                }}
              >
                <defs>
                  <linearGradient id="gradCoverage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  domain={[44000, 54000]}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 8000]}
                  tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="total_ha"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradCoverage)"
                  dot={{ fill: '#10b981', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative_loss"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  fill="none"
                  dot={false}
                />
                {selectedRecord && (
                  <ReferenceDot
                    yAxisId="left"
                    x={selectedRecord.year}
                    y={selectedRecord.total_ha}
                    r={8}
                    fill="#10b981"
                    stroke="#fff"
                    strokeWidth={2}
                    className="animate-pulse"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source attribution footer */}
        <div className="mt-6 border-t border-white/[0.04] pt-4 text-center">
          <p className="font-mono text-[8px] uppercase leading-5 tracking-[0.15em] text-white/20">
            Fuentes: Bunting et al. (2022) Global Mangrove Watch v3.0, Nature Sci. Data.
            &middot; SERVIR Amazonia v1.1 (2022) &middot; Sentinel-1 SAR GEE (2024)
          </p>
          <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/15">
            DOI: 10.1038/s41597-022-01574-5 &middot; Bbox: -80.1, -2.4, -79.4, -1.7 &middot; CRS: EPSG:4326
          </p>
        </div>
      </div>
    </section>
  );
}
