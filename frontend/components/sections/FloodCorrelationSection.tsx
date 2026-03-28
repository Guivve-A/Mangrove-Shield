import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Oswald } from 'next/font/google';
import type { FloodEvent, FloodEventsResponse } from '@/types/geospatial';
import { loadFloodEvents } from '@/lib/api';

const oswald = Oswald({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' });

// ─── Animated counter ───────────────────────────────────────────────────────

function useCountUp(target: number, duration: number, active: boolean): number {
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

// ─── Corner brackets ─────────────────────────────────────────────────────────

function Brackets({ className = '' }: { className?: string }) {
  return (
    <>
      <div className={`pointer-events-none absolute left-0 top-0 h-4 w-4 border-l border-t ${className}`} />
      <div className={`pointer-events-none absolute right-0 top-0 h-4 w-4 border-r border-t ${className}`} />
      <div className={`pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b border-l ${className}`} />
      <div className={`pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b border-r ${className}`} />
    </>
  );
}

// ─── Severity config ─────────────────────────────────────────────────────────

const SEVERITY_META = {
  moderate: { label: 'MODERADO', color: '#eab308', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.2)',  dot: 'bg-yellow-400' },
  severe:   { label: 'SEVERO',   color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', dot: 'bg-orange-400' },
  extreme:  { label: 'EXTREMO',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  dot: 'bg-red-400'    },
} as const;

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  unit,
  color,
  source,
  active,
  duration = 2200,
  isInteger = true,
}: {
  value: number;
  label: string;
  unit?: string;
  color: string;
  source: string;
  active: boolean;
  duration?: number;
  isInteger?: boolean;
}) {
  const animated = useCountUp(value, duration, active);
  const [showSource, setShowSource] = useState(false);

  const display = isInteger
    ? Math.round(animated).toLocaleString('es-EC')
    : animated.toFixed(1);

  return (
    <div
      className="group relative flex flex-col items-center rounded-lg border border-white/[0.06] bg-white/[0.015] p-6 text-center"
      onMouseEnter={() => setShowSource(true)}
      onMouseLeave={() => setShowSource(false)}
    >
      <Brackets className="border-white/[0.06] group-hover:border-white/15 transition-colors" />

      <div className={`${oswald.className} text-5xl font-bold leading-none tracking-tight md:text-6xl`}
        style={{ color, textShadow: `0 0 40px ${color}25` }}>
        {display}
        {unit && <span className="ml-1 text-2xl opacity-60">{unit}</span>}
      </div>

      <p className="mt-3 font-mono text-[9px] uppercase leading-4 tracking-[0.2em] text-white/40">
        {label}
      </p>

      {/* Source tooltip on hover */}
      <div className={`absolute -bottom-8 left-0 right-0 z-10 rounded px-2 py-1 text-center font-mono text-[8px] text-white/35 transition-all duration-200 ${
        showSource ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {source}
      </div>
    </div>
  );
}

// ─── Event popup ─────────────────────────────────────────────────────────────

function EventPopup({ event, onClose }: { event: FloodEvent; onClose: () => void }) {
  const sev = SEVERITY_META[event.severity];
  return (
    <div className="absolute z-20 w-72 rounded-lg border border-white/10 bg-[#050c18]/97 p-5 shadow-2xl backdrop-blur-xl"
      style={{ top: '-180px', left: '50%', transform: 'translateX(-50%)' }}>
      <Brackets className="border-white/[0.08]" />

      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: sev.color }}>
          {sev.label}
        </span>
        <button onClick={onClose} className="font-mono text-[10px] text-white/30 hover:text-white/60">✕</button>
      </div>

      <p className={`${oswald.className} text-xl font-semibold text-white`}>{event.label}</p>
      <p className="mt-1 font-mono text-[9px] text-white/40">{event.description}</p>

      <div className="mt-4 space-y-1.5">
        {[
          { label: 'Lluvia pico',       value: `${event.rain_mm_day} mm/día` },
          { label: 'Nivel de marea',    value: `${event.tide_level_m} m` },
          { label: 'Área inundada',     value: `${event.flood_area_ha.toLocaleString('es-EC')} ha` },
          { label: 'Afectados',         value: event.affected_people.toLocaleString('es-EC') },
          { label: 'Correlac. manglar', value: `${event.correlation_pct}% zonas pérdida` },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between border-b border-white/[0.04] pb-1 last:border-0">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">{label}</span>
            <span className="font-mono text-[10px] font-bold text-white/80">{value}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 font-mono text-[8px] text-white/20">{event.source}</p>
    </div>
  );
}

// ─── Timeline dot ─────────────────────────────────────────────────────────────

function TimelineDot({
  event,
  maxArea,
  isSelected,
  onClick,
}: {
  event: FloodEvent;
  maxArea: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const sev = SEVERITY_META[event.severity];
  const size = 8 + (event.flood_area_ha / maxArea) * 22;

  return (
    <div className="relative flex flex-col items-center" style={{ minWidth: '64px' }}>
      {/* Year label */}
      <span className="mb-2 font-mono text-[8px] uppercase tracking-[0.15em] text-white/25">
        {event.year}
      </span>

      {/* Dot */}
      <button
        onClick={onClick}
        className="relative flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: isSelected ? sev.color : `${sev.color}60`,
          border: `1.5px solid ${sev.color}`,
          boxShadow: isSelected ? `0 0 16px ${sev.color}60` : 'none',
        }}
        title={event.label}
      />

      {/* Label below */}
      <span className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.1em]"
        style={{ color: isSelected ? sev.color : 'rgba(255,255,255,0.3)' }}>
        {event.label.split(' ')[0]}<br />
        <span className="font-bold">{event.label.split(' ')[1]}</span>
      </span>

      {/* Severity badge */}
      <span className="mt-1 font-mono text-[7px] uppercase tracking-[0.1em]"
        style={{ color: sev.color }}>
        {sev.label}
      </span>

      {/* Popup */}
      {isSelected && (
        <EventPopup event={event} onClose={onClick} />
      )}
    </div>
  );
}

// ─── Flood timeline strip ────────────────────────────────────────────────────

type SeverityFilter = 'all' | 'moderate' | 'severe' | 'extreme';

const FILTER_LABELS: Array<{ key: SeverityFilter; label: string; color: string }> = [
  { key: 'all',      label: 'Todos',     color: 'rgba(255,255,255,0.5)' },
  { key: 'moderate', label: 'Moderados', color: SEVERITY_META.moderate.color },
  { key: 'severe',   label: 'Severos',   color: SEVERITY_META.severe.color },
  { key: 'extreme',  label: 'Extremos',  color: SEVERITY_META.extreme.color },
];

function FloodTimeline({ events }: { events: FloodEvent[] }) {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = filter === 'all' ? events : events.filter((e) => e.severity === filter);
  const maxArea = Math.max(...events.map((e) => e.flood_area_ha), 1);

  const handleDotClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="relative rounded-lg border border-white/[0.06] bg-white/[0.01] p-5">
      <Brackets className="border-white/[0.06]" />

      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/35">
            Registro de Eventos — 2015–2024
          </h3>
          <p className="mt-0.5 font-mono text-[9px] text-white/20">
            Tamaño proporcional a área inundada · Click para detalles
          </p>
        </div>

        {/* Severity filter */}
        <div className="flex gap-1">
          {FILTER_LABELS.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-sm px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.15em] transition-all border ${
                filter === key ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03] border-transparent'
              }`}
              style={{
                color: filter === key ? color : 'rgba(255,255,255,0.25)',
                borderColor: filter === key ? `${color}40` : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline axis */}
      <div className="relative">
        {/* Horizontal line */}
        <div className="absolute top-[28px] left-0 right-0 h-px bg-white/[0.06]" />

        {/* Scrollable dots */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-20 pt-1 scrollbar-thin"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
        >
          {filtered.map((ev) => (
            <TimelineDot
              key={ev.id}
              event={ev}
              maxArea={maxArea}
              isSelected={selectedId === ev.id}
              onClick={() => handleDotClick(ev.id)}
            />
          ))}
        </div>
      </div>

      {/* Source strip */}
      <div className="mt-2 border-t border-white/[0.04] pt-3">
        <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/15">
          Fuentes: Copernicus EMS Rapid Mapping · INAMHI Ecuador · SNGR · Sentinel-1 SAR GEE
        </span>
      </div>
    </div>
  );
}

// ─── Correlation bar chart (simple SVG, no extra dep) ────────────────────────

function CorrelationBars({ events }: { events: FloodEvent[] }) {
  const sorted = [...events].sort((a, b) => b.correlation_pct - a.correlation_pct);
  return (
    <div className="space-y-2">
      {sorted.map((ev) => {
        const sev = SEVERITY_META[ev.severity];
        return (
          <div key={ev.id} className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-mono text-[9px] text-white/35 text-right">{ev.label}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-white/[0.04]">
              <div
                className="h-full rounded-sm transition-all duration-700"
                style={{
                  width: `${ev.correlation_pct}%`,
                  backgroundColor: sev.color,
                  boxShadow: `0 0 8px ${sev.color}30`,
                }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[8px] font-bold text-white/60">
                {ev.correlation_pct}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SECTION
// ═══════════════════════════════════════════════════════════════════════════

export function FloodCorrelationSection() {
  const [data, setData] = useState<FloodEventsResponse | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  // Viewport detection
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setIsVisible(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.08 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  // Load data
  useEffect(() => {
    let cancelled = false;
    loadFloodEvents().then((res) => { if (!cancelled) setData(res); });
    return () => { cancelled = true; };
  }, []);

  // Headline stat counters
  const pct83   = useCountUp(83,    2000, isVisible);
  const people  = useCountUp(14200, 2400, isVisible);
  const damage  = useCountUp(47,    2200, isVisible);
  const risk    = useCountUp(3.2,   2600, isVisible);

  const source = data?._source ?? 'calibrated_estimate';

  if (!data) {
    return (
      <section className="flex min-h-[40vh] items-center justify-center bg-[#060f1e]">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-red-500/70" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
            Cargando registros de inundación...
          </span>
        </div>
      </section>
    );
  }

  const extremeEvents = data.events.filter((e) => e.severity === 'extreme');
  const maxCorrelation = Math.max(...data.events.map((e) => e.correlation_pct));

  return (
    <section
      ref={sectionRef}
      id="flood-correlation"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#060f1e] to-[#08101f] py-24 font-sans"
    >
      {/* Scan-line overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.012]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.1) 2px,rgba(255,255,255,0.1) 4px)' }}
      />

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.018] [background-image:linear-gradient(rgba(255,255,255,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.3)_1px,transparent_1px)] [background-size:60px_60px]" />

      {/* Red alert vignette — subtle top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-red-950/20 to-transparent" />

      <div className="relative z-10 mx-auto max-w-6xl px-4">

        {/* Data provenance badge */}
        <div className="mb-10 flex justify-center">
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] backdrop-blur-md ${
            source === 'firestore'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/20 bg-red-500/08 text-red-400/70'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${
              source === 'firestore' ? 'bg-emerald-400' : 'bg-red-400/70 animate-pulse'
            }`} />
            {source === 'firestore'
              ? 'Datos en vivo · Copernicus EMS + INAMHI via GEE Pipeline → Firestore'
              : 'Estimación calibrada · Copernicus EMS EMSR641/715 · INAMHI · SNGR · Sentinel-1 SAR'}
          </div>
        </div>

        {/* ══ ZONE 1: Headline ══ */}
        <div className="mb-16 flex flex-col items-center text-center">
          <div className="mb-5 flex items-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-red-500/30" />
            <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/20">
              Sentinel-1 SAR &middot; GMW v3.0 &middot; Copernicus EMS
            </span>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-red-500/30" />
          </div>

          <h2 className={`${oswald.className} text-4xl uppercase leading-none tracking-[0.06em] text-white/90 md:text-6xl`}>
            Donde se perdió el manglar,
          </h2>
          <h2 className={`${oswald.className} mt-1 text-4xl uppercase leading-none tracking-[0.06em] text-red-400/80 md:text-6xl`}>
            llega la inundación
          </h2>

          {/* 83% counter */}
          <div className="mt-12 flex flex-col items-center">
            <div className="relative">
              <span
                className={`${oswald.className} text-[7rem] font-bold leading-none tracking-tight text-red-400 md:text-[9rem]`}
                style={{ textShadow: '0 0 80px rgba(239,68,68,0.25)' }}
              >
                {Math.round(pct83)}%
              </span>
              {/* Targeting reticle corners */}
              <div className="pointer-events-none absolute -inset-4 border border-red-500/10" />
              <div className="pointer-events-none absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-red-500/40" />
              <div className="pointer-events-none absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-red-500/40" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-red-500/40" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-red-500/40" />
            </div>

            <p className="mt-4 max-w-md font-mono text-[11px] leading-6 tracking-[0.06em] text-white/40">
              de las zonas inundadas en 2023–2024 coinciden con<br />
              <span className="text-white/60">áreas de pérdida de manglar post-2010</span>
            </p>

            <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.15em] text-white/20">
              Metodología: superposición espacial SAR-GEE · GMW v3.0 delta 2010–2024 · índice correlación &gt; 0.60
            </p>
          </div>
        </div>

        {/* ══ ZONE 2: Correlation bars + extreme events ══ */}
        <div className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Correlation per event */}
          <div className="relative rounded-lg border border-white/[0.06] bg-white/[0.015] p-6">
            <Brackets className="border-white/[0.06]" />
            <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/35">
              Correlación manglar–inundación por evento
            </h3>
            <p className="mb-5 font-mono text-[9px] text-white/20">
              % área inundada coincidente con pérdida manglar post-2010
            </p>
            <CorrelationBars events={data.events} />
            <p className="mt-4 font-mono text-[8px] text-white/15">
              Fuente: Sentinel-1 SAR GEE (COPERNICUS/S1_GRD) · GMW v3.0 · correlación espacial
            </p>
          </div>

          {/* Key extreme events panel */}
          <div className="relative rounded-lg border border-red-500/10 bg-red-950/5 p-6">
            <Brackets className="border-red-500/10" />
            <div className="mb-1 flex items-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] text-red-400/70">
                Eventos extremos
              </h3>
            </div>
            <p className="mb-5 font-mono text-[9px] text-white/20">
              &gt;70 mm/día · coincidencia lluvia + marea + pérdida manglar
            </p>

            <div className="space-y-4">
              {extremeEvents.map((ev) => (
                <div key={ev.id} className="rounded-md border border-red-500/10 bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`${oswald.className} text-xl font-semibold text-white/90`}>{ev.label}</span>
                      <p className="mt-0.5 font-mono text-[9px] text-white/35">{ev.description}</p>
                    </div>
                    <span className="shrink-0 rounded-sm bg-red-500/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.15em] text-red-400">
                      {ev.rain_mm_day} mm/d
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { v: ev.affected_people.toLocaleString('es-EC'), l: 'afectados' },
                      { v: `$${ev.damage_usd_m}M`,                     l: 'daños est.' },
                      { v: `${ev.correlation_pct}%`,                    l: 'correl. mgv' },
                    ].map(({ v, l }) => (
                      <div key={l} className="flex flex-col items-center rounded border border-white/[0.04] bg-white/[0.02] py-2">
                        <span className={`${oswald.className} text-base font-bold text-white/80`}>{v}</span>
                        <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-white/25">{l}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[8px] text-white/15">{ev.source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ ZONE 3: Narrative stats row ══ */}
        <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            value={people}
            label="personas afectadas · zonas sin cobertura manglar · Feb 2023"
            color="#ef4444"
            source="INAMHI / Copernicus EMS EMSR641 / SNGR-2023-EC-02"
            active={isVisible}
            isInteger
          />
          <StatCard
            value={damage}
            label="millones USD — daños estimados evento Feb 2023"
            unit="M"
            color="#f97316"
            source="SNGR Ecuador · Evaluación de daños 2023"
            active={isVisible}
            isInteger
          />
          <StatCard
            value={risk}
            label="veces más riesgo de inundación sin cobertura de manglar"
            unit="×"
            color="#eab308"
            source="Spalding et al. (2014) Nature · estimación propia con índice correlación"
            active={isVisible}
            duration={2600}
            isInteger={false}
          />
        </div>

        {/* ══ ZONE 4: Event timeline ══ */}
        <div className="mb-8">
          <FloodTimeline events={data.events} />
        </div>

        {/* Scientific references footer */}
        <div className="rounded-lg border border-white/[0.04] bg-white/[0.008] p-5">
          <p className="mb-3 font-mono text-[8px] font-bold uppercase tracking-[0.3em] text-white/25">
            Fuentes de datos & metodología
          </p>
          <div className="grid gap-2 font-mono text-[8px] leading-4 text-white/18 md:grid-cols-2">
            <div className="space-y-1">
              <p><span className="text-red-400/50">Eventos extremos</span> — Copernicus EMS Rapid Mapping EMSR641 (Feb 2023), EMSR715 (Ene 2024)</p>
              <p><span className="text-orange-400/50">Registros hidrometeorológicos</span> — INAMHI Ecuador, series diarias 2015–2024</p>
              <p><span className="text-yellow-400/50">Reportes de afectación</span> — SNGR Secretaría de Gestión de Riesgos, informes de situación</p>
              <p><span className="text-white/30">Agua SAR</span> — Sentinel-1 GRD (COPERNICUS/S1_GRD), VV polarización, umbral &lt; -16 dB, GEE</p>
            </div>
            <div className="space-y-1">
              <p><span className="text-white/30">Pérdida manglar</span> — GMW v3.0 Bunting et al. (2022) DOI:10.1038/s41597-022-01574-5</p>
              <p><span className="text-white/30">Índice correlación</span> — freq_inund × (1 − cobertura_manglar_2024); umbral crítico &gt; 0.70</p>
              <p><span className="text-white/30">Factor 3.2×</span> — Spalding et al. (2014) Nature, coastal protection value of mangroves</p>
              <p><span className="text-white/30">Bbox</span> — Gran Guayaquil -80.1, -2.4, -79.4, -1.7 · CRS: EPSG:4326</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}