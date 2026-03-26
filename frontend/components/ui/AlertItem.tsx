import clsx from 'clsx';

import type { AlertItem as AlertItemType } from '@/types/geospatial';

import { Badge } from './Badge';

interface AlertItemProps {
  alert: AlertItemType;
}

function toneClass(severity: AlertItemType['severity']): string {
  if (severity === 'critical') {
    return 'border-red-400/70 bg-red-950/30';
  }
  if (severity === 'warning') {
    return 'border-amber-400/70 bg-amber-950/28';
  }
  return 'border-cyan-400/60 bg-cyan-950/25';
}

function badgeTone(severity: AlertItemType['severity']): 'info' | 'warning' | 'critical' {
  if (severity === 'critical') {
    return 'critical';
  }
  if (severity === 'warning') {
    return 'warning';
  }
  return 'info';
}

export function AlertItem({ alert }: AlertItemProps): JSX.Element {
  return (
    <article
      data-alert-item
      className={clsx(
        'group rounded-2xl border px-3 py-2 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(3,8,18,0.42)]',
        toneClass(alert.severity)
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone={badgeTone(alert.severity)}>{alert.severity}</Badge>
        <span className="text-[10px] text-slate-400">{new Date(alert.timestamp).toLocaleTimeString()}</span>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100">{alert.title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">{alert.detail}</p>
    </article>
  );
}
