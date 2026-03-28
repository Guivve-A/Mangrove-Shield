import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Oswald } from 'next/font/google';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import type {
  HealthSummaryResponse,
  HealthTimeseriesResponse,
  MunicipalityHealth,
} from '@/types/geospatial';
import { loadHealthSummary, loadHealthTimeseries } from '@/lib/api';

const oswald = Oswald({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' });

// ─── Instrument index tabs ──────────────────────────────────────────────────

type IndexKey = 'ndvi' | 'ndwi' | 'agb' | 'height';

const INDEX_META: Record<IndexKey, { label: string; unit: string; accessor: keyof MunicipalityHealth }> = {
  ndvi:   { label: 'NDVI',          unit: '',      accessor: 'ndvi' },
  ndwi:   { label: 'NDWI',          unit: '',      accessor: 'ndwi' },
  agb:    { label: 'BIOMASA',       unit: 'Mg/ha', accessor: 'agb_mg_ha' },
  height: { label: 'ALTURA DOSEL',  unit: 'm',     accessor: 'canopy_height_m' },
};

// ─── Animated counter ───────────────────────────────────────────────────────

function useAnimatedValue(target: number, duration: number, active: boolean): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, active]);
  return val;
}

// ─── Corner bracket decorators (NASA targeting reticle feel) ────────────────

function Brackets({ className = '' }: { className?: string }) {
  return (
    <>
      {/* top-left */}
      <div className={`pointer-events-none absolute left-0 top-0 h-4 w-4 border-l border-t ${className}`} />
      {/* top-right */}
      <div className={`pointer-events-none absolute right-0 top-0 h-4 w-4 border-r border-t ${className}`} />
      {/* bottom-left */}
      <div className={`pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b border-l ${className}`} />
      {/* bottom-right */}
      <div className={`pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b border-r ${className}`} />
    </>
  );
}

// ─── SVG Instrument Gauge (altimeter style) ─────────────────────────────────

function InstrumentGauge({ value, label, classification }: {
  value: number;
  label: string;
  classification: { status: string; color: string };
}) {
  const radius = 88;
  const stroke = 7;
  const circumference = 2 * Math.PI * radius;
  // Arc spans 270 degrees (3/4 of circle)
  const arcLength = circumference * 0.75;
  const filledLength = (value / 100) * arcLength;

  // Tick marks around the gauge (every 10%)
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const pct = i * 10;
    // Map 0-100% to -225deg to +45deg (270 deg sweep starting from bottom-left)
    const angle = -225 + (pct / 100) * 270;
    const rad = (angle * Math.PI) / 180;
    const outerR = radius + 14;
    const innerR = radius + 6;
    return {
      x1: 100 + Math.cos(rad) * innerR,
      y1: 100 + Math.sin(rad) * innerR,
      x2: 100 + Math.cos(rad) * outerR,
      y2: 100 + Math.sin(rad) * outerR,
      label: pct,
      lx: 100 + Math.cos(rad) * (outerR + 10),
      ly: 100 + Math.sin(rad) * (outerR + 10),
      major: pct % 20 === 0,
    };
  });

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 200 200" width="260" height="260" className="drop-shadow-[0_0_40px_rgba(16,185,129,0.08)]">
        {/* Outer ring (instrument bezel) */}
        <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <circle cx="100" cy="100" r={radius + 16} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

        {/* Tick marks */}
        {ticks.map((t) => (
          <g key={t.label}>
            <line
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.major ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)'}
              strokeWidth={t.major ? 1.5 : 0.7}
            />
            {t.major && (
              <text x={t.lx} y={t.ly} textAnchor="middle" dominantBaseline="middle"
                fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">
                {t.label}
              </text>
            )}
          </g>
        ))}

        {/* Background arc */}
        <circle
          cx="100" cy="100" r={radius} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(135 100 100)"
        />

        {/* Filled arc */}
        <circle
          cx="100" cy="100" r={radius} fill="none"
          stroke={classification.color}
          strokeWidth={stroke}
          strokeDasharray={`${filledLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(135 100 100)"
          className="transition-all duration-1000"
          style={{ filter: `drop-shadow(0 0 8px ${classification.color}50)` }}
        />

        {/* Inner glow ring */}
        <circle cx="100" cy="100" r={radius - 14} fill="none"
          stroke={classification.color} strokeWidth="0.5" opacity="0.2" />

        {/* Cross-hair center */}
        <line x1="95" y1="100" x2="105" y2="100" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <line x1="100" y1="95" x2="100" y2="105" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
      </svg>

      {/* Center readout (overlaid) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: '10px' }}>
        <span className={`${oswald.className} text-5xl font-bold tracking-tight`}
          style={{ color: classification.color, textShadow: `0 0 30px ${classification.color}30` }}>
          {Math.round(value)}%
        </span>
        <span className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em]"
          style={{ color: classification.color }}>
          {classification.status}
        </span>
      </div>

      {/* Label below */}
      <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">
        {label}
      </span>
    </div>
  );
}

// ─── Health distribution bar (segmented, NASA telemetry style) ──────────────

const DIST_SEGMENTS: Array<{ key: string; label: string; color: string }> = [
  { key: 'healthy',  label: 'SANO',      color: '#10b981' },
  { key: 'moderate', label: 'MODERADO',  color: '#eab308' },
  { key: 'degraded', label: 'DEGRADADO', color: '#f97316' },
  { key: 'critical', label: 'CRITICO',   color: '#ef4444' },
];

function DistributionBar({ distribution, visible }: {
  distribution: Record<string, number>;
  visible: boolean;
}) {
  return (
    <div className="w-full max-w-lg">
      {/* Segmented bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
        {DIST_SEGMENTS.map((seg) => (
          <div
            key={seg.key}
            className="transition-all duration-1000 ease-out"
            style={{
              width: visible ? `${distribution[seg.key] ?? 0}%` : '0%',
              backgroundColor: seg.color,
              boxShadow: `0 0 8px ${seg.color}40`,
            }}
          />
        ))}
      </div>
      {/* Labels */}
      <div className="mt-3 flex justify-between">
        {DIST_SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex flex-col items-center">
            <span className="font-mono text-[13px] font-bold" style={{ color: seg.color }}>
              {distribution[seg.key] ?? 0}%
            </span>
            <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">
              {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Municipality instrument card ───────────────────────────────────────────

function MunicipalityCard({ muni, activeIndex, onSelect }: {
  muni: MunicipalityHealth;
  activeIndex: IndexKey;
  onSelect: () => void;
}) {
  const meta = INDEX_META[activeIndex];
  const rawValue = muni[meta.accessor] as number;
  const displayValue = meta.unit ? rawValue.toLocaleString() : rawValue.toFixed(3);
  const ndviPct = Math.min(100, Math.max(0, muni.ndvi * 100));
  const isPositive = muni.annual_delta >= 0;

  return (
    <button
      onClick={onSelect}
      className="group relative overflow-hidden rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-5 text-left transition-all duration-300 hover:border-white/[0.12] hover:from-white/[0.05]"
    >
      <Brackets className="border-white/[0.08] group-hover:border-white/20 transition-colors" />

      {/* Status LED */}
      <div className="flex items-center gap-2.5">
        <div className="relative h-2 w-2">
          <div className="absolute inset-0 rounded-full" style={{ backgroundColor: muni.color }} />
          <div className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ backgroundColor: muni.color }} />
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
          {muni.name}
        </span>
      </div>

      {/* Primary readout */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className={`${oswald.className} text-3xl font-bold text-white`}>
          {displayValue}
        </span>
        {meta.unit && (
          <span className="font-mono text-[10px] text-white/30">{meta.unit}</span>
        )}
      </div>

      {/* NDVI bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${ndviPct}%`, backgroundColor: muni.color }}
        />
      </div>

      {/* Status + delta */}
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[10px]" style={{ color: muni.color }}>
          {muni.status}
        </span>
        <span className={`font-mono text-[10px] font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '\u25B2' : '\u25BC'} {muni.annual_delta >= 0 ? '+' : ''}{muni.annual_delta}/a
        </span>
      </div>
    </button>
  );
}

// ─── Telemetry readout line ─────────────────────────────────────────────────

function TelemetryReadout({ label, value, unit, color }: {
  label: string; value: string; unit?: string; color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/[0.04] py-2 first:pt-0 last:border-0 last:pb-0">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-[13px] font-bold" style={{ color: color ?? '#fff' }}>{value}</span>
        {unit && <span className="font-mono text-[9px] text-white/25">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Chart tooltip (instrument style) ───────────────────────────────────────

const MUNI_COLORS: Record<string, string> = {
  Guayaquil: '#3b82f6',
  Duran: '#8b5cf6',
  Daule: '#10b981',
  Samborondon: '#f97316',
};

function ChartTooltipContent({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-[#070d18]/95 px-4 py-3 font-mono text-[11px] shadow-2xl backdrop-blur-xl">
      <p className="mb-2 border-b border-white/[0.06] pb-1.5 text-[9px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-white/50">{entry.dataKey}</span>
          </div>
          <span className="font-bold text-white">{entry.value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SECTION
// ═══════════════════════════════════════════════════════════════════════════

export function MangroveHealthSection() {
  const [summary, setSummary] = useState<HealthSummaryResponse | null>(null);
  const [timeseries, setTimeseries] = useState<HealthTimeseriesResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState<IndexKey>('ndvi');
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedMuni, setSelectedMuni] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  // Viewport detection
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setIsVisible(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.1 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  // Load data
  useEffect(() => {
    let c = false;
    Promise.all([loadHealthSummary(), loadHealthTimeseries()]).then(([s, t]) => {
      if (!c) { setSummary(s); setTimeseries(t); }
    });
    return () => { c = true; };
  }, []);

  // Animated gauge value
  const gaugeValue = useAnimatedValue(summary?.global_health_pct ?? 0, 2000, isVisible);

  // Chart data
  const chartData = useMemo(() => {
    if (!timeseries) return [];
    return timeseries.months.map((month, i) => {
      const point: Record<string, string | number> = { month };
      for (const muni of timeseries.municipalities) {
        point[muni] = timeseries.series[muni]?.[i] ?? 0;
      }
      point['mean'] = timeseries.regional_mean[i] ?? 0;
      return point;
    });
  }, [timeseries]);

  // Anomaly detection: months where any municipality's NDVI drops >10% below its own mean
  const anomalyMonths = useMemo(() => {
    if (!timeseries) return new Set<string>();
    const set = new Set<string>();
    for (const muni of timeseries.municipalities) {
      const vals = timeseries.series[muni] ?? [];
      const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      vals.forEach((v, i) => {
        if (v < mean * 0.9) set.add(timeseries.months[i]);
      });
    }
    return set;
  }, [timeseries]);

  const handleSelectMuni = useCallback((name: string) => {
    setSelectedMuni((prev) => (prev === name ? null : name));
  }, []);

  if (!summary) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center bg-[#070d18]">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
            Cargando telemetría Sentinel-2...
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="mangrove-health"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#070d18] to-[#0c1527] py-24 font-sans"
    >
      {/* Scan-line overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)' }} />

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.02] [background-image:linear-gradient(rgba(255,255,255,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.3)_1px,transparent_1px)] [background-size:60px_60px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4">

        {/* Data provenance badge */}
        <div className="mb-8 flex justify-center">
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] backdrop-blur-md ${
            summary._source === 'firestore'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${
              summary._source === 'firestore' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
            }`} />
            {summary._source === 'firestore'
              ? 'Datos en vivo \u00b7 Sentinel-2 SR via GEE Pipeline \u2192 Firestore'
              : 'Estimaci\u00f3n calibrada \u00b7 Sentinel-2 NDVI + NASA AGB v1.3 (literatura)'}
          </div>
        </div>

        {/* ══ ZONE 1: Global health instrument ══ */}
        <div className="mb-20 flex flex-col items-center">
          {/* Mission badge */}
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/20" />
            <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
              Sentinel-2 MSI &middot; 10m &middot; Compuesto Mensual
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/20" />
          </div>

          <h2 className={`${oswald.className} text-center text-4xl uppercase leading-none tracking-[0.08em] text-white/90 md:text-6xl`}>
            Salud del Ecosistema
          </h2>

          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-white/25">
            {summary.period} &middot; Gran Guayaquil
          </p>

          {/* Gauge + telemetry panel */}
          <div className="mt-10 flex flex-col items-center gap-8 md:flex-row md:gap-16">
            <InstrumentGauge
              value={gaugeValue}
              label="Indice de salud global"
              classification={summary.classification}
            />

            {/* Telemetry readouts */}
            <div className="relative w-64 rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
              <Brackets className="border-white/[0.08]" />
              <p className="mb-3 font-mono text-[8px] uppercase tracking-[0.3em] text-white/25">
                Lecturas en vivo
              </p>
              <TelemetryReadout label="NDVI medio" value={summary.ndvi_mean.toFixed(4)} color={summary.classification.color} />
              <TelemetryReadout label="NDWI medio" value={summary.ndwi_mean.toFixed(4)} color="#06b6d4" />
              <TelemetryReadout label="Cobertura" value={summary.period} />
              <TelemetryReadout label="Nubosidad" value="< 20%" unit="filtro" />
              <TelemetryReadout label="Resolución" value="10" unit="m/px" />
            </div>
          </div>

          {/* Distribution bar */}
          <div className="mt-12">
            <DistributionBar distribution={summary.distribution} visible={isVisible} />
          </div>
        </div>

        {/* ══ ZONE 2: Index selector tabs ══ */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1">
            {(Object.keys(INDEX_META) as IndexKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveIndex(key)}
                className={`relative rounded-sm px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-all ${
                  activeIndex === key
                    ? 'bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'text-white/30 hover:bg-white/[0.03] hover:text-white/50'
                }`}
              >
                {INDEX_META[key].label}
                {activeIndex === key && (
                  <div className="absolute bottom-0 left-1/2 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                )}
              </button>
            ))}
          </div>

          {/* Source badge */}
          <span className="hidden font-mono text-[8px] uppercase tracking-[0.2em] text-white/20 md:block">
            {activeIndex === 'agb' || activeIndex === 'height' ? 'NASA AGB v1.3 \u00b7 30m' : 'Sentinel-2 SR \u00b7 10m'}
          </span>
        </div>

        {/* ══ ZONE 3: Municipality instrument cards ══ */}
        <div className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.municipalities.map((muni) => (
            <MunicipalityCard
              key={muni.name}
              muni={muni}
              activeIndex={activeIndex}
              onSelect={() => handleSelectMuni(muni.name)}
            />
          ))}
        </div>

        {/* ══ ZONE 4: Monthly NDVI evolution chart ══ */}
        <div className="relative rounded-lg border border-white/[0.06] bg-white/[0.015] p-6">
          <Brackets className="border-white/[0.06]" />

          {/* Chart header */}
          <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/35">
                Evolución Temporal NDVI
              </h3>
              <p className="mt-1 font-mono text-[9px] text-white/20">
                24 meses &middot; compuesto mediana por municipio
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Anomaly toggle */}
              <button
                onClick={() => setShowAnomalies((v) => !v)}
                className={`flex items-center gap-2 rounded-sm px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] transition-all ${
                  showAnomalies
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'text-white/25 hover:text-white/40 border border-white/[0.06]'
                }`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${showAnomalies ? 'bg-red-400 animate-pulse' : 'bg-white/20'}`} />
                Anomalías
              </button>

              {/* Legend */}
              <div className="hidden items-center gap-3 md:flex">
                {timeseries?.municipalities.map((m) => (
                  <div key={m} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-4 rounded-sm" style={{ backgroundColor: MUNI_COLORS[m] ?? '#888' }} />
                    <span className="font-mono text-[8px] uppercase tracking-wider text-white/30">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[280px] w-full md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="healthyBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="2 8" stroke="rgba(255,255,255,0.03)" />

                <XAxis
                  dataKey="month"
                  tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                  interval={2}
                  tickFormatter={(v: string) => {
                    const parts = v.split('-');
                    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                    return `${months[parseInt(parts[1], 10) - 1]} ${parts[0].slice(2)}`;
                  }}
                />

                <YAxis
                  domain={[0.3, 1.0]}
                  tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v.toFixed(1)}
                />

                {/* Healthy zone band */}
                <ReferenceArea yAxisId={0} y1={0.65} y2={1.0} fill="url(#healthyBand)" />
                <ReferenceLine y={0.65} stroke="rgba(16,185,129,0.15)" strokeDasharray="4 6"
                  label={{ value: 'Umbral sano', position: 'right', fill: 'rgba(16,185,129,0.3)', fontSize: 8 }} />

                <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: 'rgba(255,255,255,0.08)' }} />

                {/* Anomaly highlights */}
                {showAnomalies && chartData.map((d, i) => (
                  anomalyMonths.has(d.month as string) ? (
                    <ReferenceArea
                      key={`anom-${i}`}
                      x1={d.month as string}
                      x2={d.month as string}
                      fill="rgba(239,68,68,0.08)"
                      stroke="rgba(239,68,68,0.15)"
                    />
                  ) : null
                ))}

                {/* Municipality lines */}
                {timeseries?.municipalities.map((muni) => (
                  <Line
                    key={muni}
                    type="monotone"
                    dataKey={muni}
                    stroke={MUNI_COLORS[muni] ?? '#888'}
                    strokeWidth={selectedMuni === null || selectedMuni === muni ? 2 : 0.5}
                    opacity={selectedMuni === null || selectedMuni === muni ? 1 : 0.2}
                    dot={false}
                    activeDot={{ r: 4, fill: MUNI_COLORS[muni], stroke: '#fff', strokeWidth: 1.5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom data strip */}
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-3">
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/20">
              Fuente: COPERNICUS/S2_SR_HARMONIZED &middot; NASA ORNL DAAC AGB v1.3
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/20">
              CRS: EPSG:4326 &middot; Escala: {activeIndex === 'agb' || activeIndex === 'height' ? '30' : '10'}m
            </span>
          </div>
        </div>

        {/* Scientific citations and classification references */}
        <div className="mt-8 rounded-lg border border-white/[0.04] bg-white/[0.01] p-5">
          <p className="mb-3 font-mono text-[8px] font-bold uppercase tracking-[0.3em] text-white/25">
            Referencias Cient&iacute;ficas &amp; Umbrales de Clasificaci&oacute;n
          </p>
          <div className="grid gap-2 font-mono text-[8px] leading-4 text-white/20 md:grid-cols-2">
            <div>
              <p><span className="text-emerald-400/60">NDVI &ge; 0.85 &rarr; Saludable</span> &mdash; Giri et al. (2011) Global Ecology and Biogeography, 20:154-159</p>
              <p><span className="text-yellow-400/60">NDVI &ge; 0.65 &rarr; Moderado</span> &mdash; Alongi (2002) Environmental Conservation, 29:331-349</p>
              <p><span className="text-orange-400/60">NDVI &ge; 0.40 &rarr; Degradado</span> &mdash; Duke et al. (2007) Science, 317:41-42</p>
              <p><span className="text-red-400/60">NDVI &lt; 0.40 &rarr; Cr&iacute;tico</span> &mdash; Below minimum canopy vigour threshold</p>
            </div>
            <div>
              <p>NDVI/NDWI: Sentinel-2 SR Harmonized (COPERNICUS/S2_SR_HARMONIZED), 10m, mediana mensual</p>
              <p>AGB: NASA Global Mangrove AGB v1.3, ORNL DAAC, 30m, baseline 2000</p>
              <p>Dosel: Simard et al. (2019) Nature Geoscience, ICESat-2 / GEDI fusion</p>
              <p>Anomal&iacute;as: &Delta;NDVI &gt; 10% bajo media municipal por periodo</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
