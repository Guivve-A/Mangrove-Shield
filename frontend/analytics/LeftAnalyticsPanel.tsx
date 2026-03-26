import clsx from 'clsx';

import type { IntelligenceMetrics, TopZoneRecord } from '@/types/geospatial';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

interface LeftAnalyticsPanelProps {
  metrics: IntelligenceMetrics;
  zones: TopZoneRecord[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}

function ProgressStat({ label, value, tone }: { label: string; value: number; tone: string }): JSX.Element {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <span className="text-slate-300">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', tone)}
          style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function LeftAnalyticsPanel({
  metrics,
  zones,
  selectedZoneId,
  onSelectZone,
}: LeftAnalyticsPanelProps): JSX.Element {
  return (
    <aside className="flex h-full flex-col gap-3 overflow-hidden">
      <Card
        animateTag="left"
        title="Risk Intelligence"
        subtitle="Sentinel-1 SAR Monitoring (cloud-resilient) for Greater Guayaquil."
      >
        <div className="mb-3">
          <Badge tone="info">Operational Analytics</Badge>
        </div>
        <div className="space-y-3 rounded-xl border border-slate-700/50 bg-panelSoft/55 p-3">
          <ProgressStat label="Flood Probability" value={metrics.floodRiskIndex} tone="bg-gradient-to-r from-blue-500 to-cyan-400" />
          <ProgressStat label="Mangrove Coverage" value={metrics.mangroveCoverage} tone="bg-gradient-to-r from-emerald-600 to-lime-400" />
          <ProgressStat label="Urban Exposure" value={metrics.urbanExposure} tone="bg-gradient-to-r from-orange-500 to-amber-300" />
        </div>
      </Card>

      <Card
        animateTag="left"
        title="Critical Zones"
        subtitle="Top 5 locations sorted by vulnerability score. Click to focus map."
        className="min-h-0 flex-1"
      >
        <div className="scrollbar-soft max-h-[42vh] space-y-2 overflow-y-auto pr-1">
          {zones.map((zone, index) => {
            const active = selectedZoneId === zone.id;
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => onSelectZone(zone.id)}
                className={clsx(
                  'w-full rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5',
                  active
                    ? 'border-cyan-400/80 bg-cyan-900/30 shadow-[0_0_0_1px_rgba(34,211,238,0.45)]'
                    : 'border-slate-700/50 bg-slate-900/35 hover:border-slate-500/70 hover:bg-slate-800/45'
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Zone {index + 1}</span>
                  <Badge tone={zone.vulnerability >= 0.75 ? 'critical' : zone.vulnerability >= 0.64 ? 'warning' : 'info'}>
                    {Math.round(zone.vulnerability * 100)}
                  </Badge>
                </div>
                <div className="text-sm font-semibold text-slate-100">{zone.zoneName}</div>
                <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-slate-300">
                  <span>flood prob</span>
                  <span className="text-right">{Math.round(zone.floodProbability * 100)}%</span>
                  <span>urban exposure</span>
                  <span className="text-right">{Math.round(zone.urbanExposure * 100)}%</span>
                  <span>distance mangroves</span>
                  <span className="text-right">{zone.distanceToMangrovesKm.toFixed(2)} km</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </aside>
  );
}
