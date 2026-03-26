import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  Scatter,
  ScatterChart,
  ZAxis,
} from 'recharts';

import type { TimeSeriesPoint } from '@/types/geospatial';

interface AnalyticsChartsProps {
  data: TimeSeriesPoint[];
}

export function AnalyticsCharts({ data }: AnalyticsChartsProps): JSX.Element {
  return (
    <section className="grid h-full grid-rows-3 gap-3 rounded-xl border border-slate-700/40 bg-panel p-3 shadow-panel">
      <article className="rounded-lg border border-slate-700/50 bg-panelSoft/55 p-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Flood Risk Evolution</h3>
        <ResponsiveContainer width="100%" height="88%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#233449" />
            <XAxis dataKey="date" stroke="#86a2c0" fontSize={10} />
            <YAxis stroke="#86a2c0" fontSize={10} domain={[0, 1]} />
            <Tooltip contentStyle={{ backgroundColor: '#06111b', border: '1px solid #2d4662' }} />
            <Line type="monotone" dataKey="floodRisk" stroke="#3ba0ff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </article>

      <article className="rounded-lg border border-slate-700/50 bg-panelSoft/55 p-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Mangrove Coverage Trend</h3>
        <ResponsiveContainer width="100%" height="88%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#233449" />
            <XAxis dataKey="date" stroke="#86a2c0" fontSize={10} />
            <YAxis stroke="#86a2c0" fontSize={10} domain={[0, 1]} />
            <Tooltip contentStyle={{ backgroundColor: '#06111b', border: '1px solid #2d4662' }} />
            <Area
              type="monotone"
              dataKey="mangroveHealth"
              stroke="#2fd17f"
              fillOpacity={1}
              fill="url(#mangroveGradient)"
            />
            <defs>
              <linearGradient id="mangroveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2fd17f" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#0a3622" stopOpacity={0.2} />
              </linearGradient>
            </defs>
          </AreaChart>
        </ResponsiveContainer>
      </article>

      <article className="rounded-lg border border-slate-700/50 bg-panelSoft/55 p-2">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Rainfall vs Flood Correlation</h3>
        <ResponsiveContainer width="100%" height="88%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#233449" />
            <XAxis dataKey="rainfall" name="Rainfall" stroke="#86a2c0" fontSize={10} />
            <YAxis dataKey="floodAreaProxy" name="Flood" stroke="#86a2c0" fontSize={10} />
            <ZAxis dataKey="floodRisk" range={[40, 180]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#06111b', border: '1px solid #2d4662' }} />
            <Legend />
            <Scatter name="Correlation" data={data} fill="#f59e0b" />
          </ScatterChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}
