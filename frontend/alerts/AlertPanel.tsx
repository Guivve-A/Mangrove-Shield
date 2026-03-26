import { useEffect, useRef } from 'react';

import { gsap } from 'gsap';

import type { AlertItem } from '@/types/geospatial';
import { Card } from '@/components/ui/Card';
import { AlertItem as AlertRow } from '@/components/ui/AlertItem';

interface AlertPanelProps {
  alerts: AlertItem[];
}

export function AlertPanel({ alerts }: AlertPanelProps): JSX.Element {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    const tween = gsap.fromTo(
      listRef.current.querySelectorAll('[data-alert-item]'),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, stagger: 0.06, duration: 0.35, ease: 'power2.out' }
    );

    return () => {
      tween.kill();
    };
  }, [alerts]);

  return (
    <Card title="Intel Alerts" subtitle="Operational notifications for flood and mangrove signals.">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Live stream</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">{alerts.length}</span>
      </div>

      <div ref={listRef} className="scrollbar-soft max-h-[220px] space-y-2 overflow-y-auto pr-1">
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </div>
    </Card>
  );
}
