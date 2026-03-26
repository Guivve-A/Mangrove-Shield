import { useEffect, useRef, useState } from 'react';

import clsx from 'clsx';
import { gsap } from 'gsap';

interface KPIBlockProps {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  toneClass?: string;
  className?: string;
}

function formatValue(value: number, decimals: number): string {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(value);
  }

  return value.toFixed(decimals);
}

export function KPIBlock({
  label,
  value,
  suffix = '',
  decimals = 0,
  toneClass = 'text-slate-100',
  className,
}: KPIBlockProps): JSX.Element {
  const previousValue = useRef(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const target = { value: previousValue.current };

    const tween = gsap.to(target, {
      value,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        setDisplay(target.value);
      },
      onComplete: () => {
        previousValue.current = value;
      },
    });

    return () => {
      tween.kill();
    };
  }, [value]);

  return (
    <div
      data-kpi-block
      className={clsx(
        'glass-card px-3.5 py-2.5',
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="glow-line mt-1.5 w-8 opacity-50" />
      <p className={clsx('mt-2 text-lg font-bold tabular-nums', toneClass)}>
        {formatValue(display, decimals)}
        {suffix}
      </p>
    </div>
  );
}
