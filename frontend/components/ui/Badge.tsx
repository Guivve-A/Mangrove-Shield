import clsx from 'clsx';
import type { PropsWithChildren } from 'react';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

interface BadgeProps extends PropsWithChildren {
  tone?: BadgeTone;
  glow?: boolean;
  className?: string;
}

const toneClass: Record<BadgeTone, string> = {
  neutral: 'border-slate-600/40 bg-slate-800/60 text-slate-200',
  info: 'border-cyan-400/35 bg-cyan-950/40 text-cyan-200',
  success: 'border-emerald-500/35 bg-emerald-950/40 text-emerald-200',
  warning: 'border-amber-500/35 bg-amber-950/40 text-amber-200',
  critical: 'border-red-500/40 bg-red-950/40 text-red-200',
};

export function Badge({ tone = 'neutral', glow, className, children }: BadgeProps): JSX.Element {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
        toneClass[tone],
        glow && 'badge-glow',
        className,
      )}
    >
      {children}
    </span>
  );
}
