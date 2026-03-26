import type { LiveData } from '@/hooks/useLiveData';

interface SignalsSectionProps {
    liveData: LiveData;
}

function signalMode(isFallback: boolean): string {
    return isFallback ? 'Fallback' : 'Live';
}

function levelBadge(level: string): string {
    if (level === 'critical') return 'badge-danger';
    if (level === 'high') return 'badge-orange';
    if (level === 'moderate') return 'badge-cyan';
    return 'badge-estuary';
}

function SignalPanel({
    title,
    mode,
    children,
}: {
    title: string;
    mode: string;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <article className="reveal rounded-[30px] border border-[var(--border-light)] bg-white/88 p-6 shadow-[0_20px_60px_-42px_rgba(10,37,64,0.24)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
                <p className="text-caption text-estuary/85">{title}</p>
                <span className="rounded-full border border-slate-200/80 bg-slate-50/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ocean-dark/58">
                    {mode}
                </span>
            </div>
            <div className="mt-6">
                {children}
            </div>
        </article>
    );
}

export function SignalsSection({ liveData }: SignalsSectionProps): JSX.Element {
    const weather = liveData.weather.data;
    const vulnerability = liveData.vulnerability.data;
    const waterMask = liveData.waterMask.data;
    const anomalies = liveData.anomalies.data;

    return (
        <section id="signals" className="section section-light !min-h-0 !items-start overflow-hidden">
            <div className="section-inner">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-start">
                    <div className="max-w-[520px]">
                        <div className="accent-line mb-6 reveal" />
                        <p className="reveal text-caption text-estuary mb-4">Validation + Live Feed</p>
                        <h2 className="reveal heading-section text-ocean-dark">
                            Continuous signals keep the intelligence layer credible.
                        </h2>
                        <p className="reveal text-body text-secondary-dark mt-6">
                            After the map and outcomes, the product should close with proof that the system is active. These live signals show the operational layer is refreshed, monitored, and grounded in recent observations.
                        </p>

                        <div className="reveal mt-10 rounded-[28px] border border-[var(--border-light)] bg-white/82 p-6 shadow-[0_18px_50px_-40px_rgba(10,37,64,0.2)]">
                            <p className="text-caption text-ocean-dark/55">Signal categories</p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                {['Weather', 'Vulnerability', 'SAR', 'Anomalies'].map((item) => (
                                    <span
                                        key={item}
                                        className="rounded-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ocean-dark/68"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <SignalPanel title="Weather now" mode={signalMode(liveData.weather.isFallback)}>
                            {weather ? (
                                <>
                                    <p className="font-mono text-[40px] font-semibold tracking-[-0.05em] text-ocean-dark">
                                        {weather.weather_now.rain_mm_h}
                                        <span className="ml-2 text-[18px] font-medium text-ocean-dark/45">mm/h</span>
                                    </p>
                                    <p className="mt-3 text-[14px] text-[var(--text-dark-secondary)]">
                                        Wind {weather.weather_now.wind_kph} kph | Humidity {weather.weather_now.humidity_pct}% | Temp {weather.weather_now.temperature_c} C
                                    </p>
                                </>
                            ) : (
                                <p className="text-[14px] text-[var(--text-dark-dim)]">Awaiting live weather stream.</p>
                            )}
                        </SignalPanel>

                        <SignalPanel title="Vulnerability" mode={signalMode(liveData.vulnerability.isFallback)}>
                            {vulnerability ? (
                                <>
                                    <p className="font-mono text-[40px] font-semibold tracking-[-0.05em] text-ocean-dark">
                                        {vulnerability.vulnerability_index_100}
                                        <span className="ml-2 text-[18px] font-medium text-ocean-dark/45">/100</span>
                                    </p>
                                    <div className="mt-4">
                                        <span className={`badge ${levelBadge(vulnerability.level)}`}>{vulnerability.level}</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-[14px] text-[var(--text-dark-dim)]">Awaiting vulnerability computation.</p>
                            )}
                        </SignalPanel>

                        <SignalPanel title="SAR water mask" mode={signalMode(liveData.waterMask.isFallback)}>
                            {waterMask ? (
                                <>
                                    <p className="font-mono text-[40px] font-semibold tracking-[-0.05em] text-ocean-dark">
                                        {Math.round(waterMask.stats.water_extent_ratio * 100)}%
                                    </p>
                                    <p className="mt-3 text-[14px] text-[var(--text-dark-secondary)]">
                                        {waterMask.stats.water_cells} detected water cells across {waterMask.stats.mangrove_cells} monitored cells.
                                    </p>
                                </>
                            ) : (
                                <p className="text-[14px] text-[var(--text-dark-dim)]">Awaiting SAR acquisition.</p>
                            )}
                        </SignalPanel>

                        <SignalPanel title="Anomalies" mode={signalMode(liveData.anomalies.isFallback)}>
                            {anomalies ? (
                                <>
                                    <p className="font-mono text-[40px] font-semibold tracking-[-0.05em] text-ocean-dark">
                                        {anomalies.anomalies.length}
                                    </p>
                                    <p className="mt-3 text-[14px] text-[var(--text-dark-secondary)]">
                                        {anomalies.anomalies.length > 0
                                            ? `Latest flagged zone: ${anomalies.anomalies[0].zone_name}`
                                            : 'No active anomalies in the latest interval.'}
                                    </p>
                                </>
                            ) : (
                                <p className="text-[14px] text-[var(--text-dark-dim)]">Awaiting anomaly monitoring stream.</p>
                            )}
                        </SignalPanel>
                    </div>
                </div>
            </div>
        </section>
    );
}
