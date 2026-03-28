import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Oswald } from 'next/font/google';
import type { MangroveTimelineResponse } from '@/types/geospatial';
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

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
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

      <div className="relative flex w-full max-w-xl items-center justify-between px-2">
        <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-white/15" />
        <div
          className="absolute left-2 top-1/2 h-px -translate-y-1/2 bg-emerald-400/60 transition-all duration-300"
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
// Main section component
// ---------------------------------------------------------------------------

export function MangroveTimelineSection() {
  const [data, setData] = useState<MangroveTimelineResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    loadMangroveTimeline().then((res) => {
      if (!cancelled) setData(res);
    });
    return () => { cancelled = true; };
  }, []);

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

  const records = data?.records ?? [];
  const years = data?.years ?? [];
  const selectedRecord = records[selectedIndex] ?? null;

  const totalLoss = data?.summary.total_loss_ha ?? 0;
  const totalGain = data?.summary.total_gain_ha ?? 0;
  const netChange = data?.summary.net_change_ha ?? 0;

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
      <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-[180px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-red-500/5 blur-[160px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4">

        {/* ─── Zone 1: Header + KPI Row ─── */}
        <div className="mb-16 text-center">
          <span className="mb-4 block font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-400/70">
            Global Mangrove Watch v3.0
          </span>
          <h2 className={`${oswald.className} text-4xl uppercase leading-none tracking-[0.05em] text-white md:text-6xl`}>
            Cambio Histórico del Manglar
          </h2>
          <p className="mt-3 font-mono text-[13px] uppercase tracking-[0.15em] text-white/40">
            Gran Guayaquil &middot; 2014 &rarr; 2024
          </p>

          {/* KPI Row: net_change hero + loss/gain secondary */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">

            {/* Secondary: losses */}
            <div className="flex flex-col items-center rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-4 backdrop-blur-sm">
              <span className={`${oswald.className} tabular-nums text-2xl font-bold text-red-400 md:text-3xl`}>
                -{animLoss.toLocaleString()} ha
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Pérdidas
              </span>
            </div>

            {/* HERO: net_change */}
            <div className="flex flex-col items-center rounded-xl border border-amber-500/20 bg-amber-500/5 px-8 py-5 backdrop-blur-sm">
              <span className={`${oswald.className} tabular-nums text-4xl font-bold text-amber-400 md:text-5xl`}>
                {netChange >= 0 ? '+' : '-'}{animNet.toLocaleString()} ha
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Balance Neto
              </span>
            </div>

            {/* Secondary: gains */}
            <div className="flex flex-col items-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-4 backdrop-blur-sm">
              <span className={`${oswald.className} tabular-nums text-2xl font-bold text-emerald-400 md:text-3xl`}>
                +{animGain.toLocaleString()} ha
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Ganancias
              </span>
            </div>
          </div>
        </div>

        {/* ─── Zone 2: Coverage Circle + Year Stats + Timeline ─── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-[#0d1a2e]">
          <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />

          {/* Circle left + Stats right */}
          <div className="relative flex flex-col items-center gap-8 py-10 md:flex-row md:items-center md:justify-center md:gap-16">

            {/* Circle */}
            <div className="relative flex-shrink-0">
              <svg viewBox="0 0 200 200" width="220" height="220" className="drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle
                  cx="100" cy="100" r="85"
                  fill="none" stroke="url(#coverageGrad)" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${((selectedRecord?.total_ha ?? 0) / 55000) * 534} 534`}
                  transform="rotate(-90 100 100)"
                  className="transition-all duration-700"
                />
                <circle
                  cx="100" cy="100" r="72"
                  fill="none" stroke="#ef4444" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${((selectedRecord?.loss_ha ?? 0) / 2000) * 452} 452`}
                  transform="rotate(-90 100 100)"
                  opacity="0.7"
                  className="transition-all duration-700"
                />
                <circle
                  cx="100" cy="100" r="72"
                  fill="none" stroke="#06b6d4" strokeWidth="4"
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

              {/* Center: selected year */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`${oswald.className} tabular-nums text-4xl font-bold text-emerald-400 md:text-5xl`}>
                  {selectedRecord?.year ?? '—'}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                  año
                </span>
              </div>
            </div>

            {/* Stats: Cobertura / Pérdida / Ganancia for selected year */}
            <div className="flex flex-col gap-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Cobertura</p>
                <p className={`${oswald.className} tabular-nums mt-0.5 text-3xl font-bold text-white md:text-4xl`}>
                  {(selectedRecord?.total_ha ?? 0).toLocaleString()}
                  <span className="ml-1.5 text-base font-normal text-white/30">ha</span>
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Pérdida</p>
                <p className={`${oswald.className} tabular-nums mt-0.5 text-3xl font-bold text-red-400 md:text-4xl`}>
                  -{(selectedRecord?.loss_ha ?? 0).toLocaleString()}
                  <span className="ml-1.5 text-base font-normal text-white/30">ha</span>
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Ganancia</p>
                <p className={`${oswald.className} tabular-nums mt-0.5 text-3xl font-bold text-cyan-400 md:text-4xl`}>
                  +{(selectedRecord?.gain_ha ?? 0).toLocaleString()}
                  <span className="ml-1.5 text-base font-normal text-white/30">ha</span>
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/8 px-6 pb-5 pt-4">
            <TimeSlider
              years={years}
              selectedIndex={selectedIndex}
              onChange={(i) => { setSelectedIndex(i); setIsPlaying(false); }}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
            />
          </div>
        </div>

      </div>
    </section>
  );
}
