import clsx from 'clsx';

export interface LayerToggleState {
    sarWaterMask: boolean;
    vulnerability: boolean;
}

interface LayerTogglesProps {
    toggles: LayerToggleState;
    onChange: (toggles: LayerToggleState) => void;
    className?: string;
}

function Toggle({ label, active, onChange }: { label: string; active: boolean; onChange: (v: boolean) => void }): JSX.Element {
    return (
        <button
            type="button"
            onClick={() => onChange(!active)}
            className={clsx(
                'flex items-center gap-2 rounded-mc-sm border px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.14em] transition-all duration-200',
                active
                    ? 'border-sat-cyan/40 bg-sat-cyan/10 text-sat-cyan shadow-[0_0_10px_rgba(25,211,218,0.08)]'
                    : 'border-[var(--border-subtle)] bg-mc-secondary/30 text-mc-dim hover:text-mc-muted hover:border-mc-muted/20',
            )}
        >
            <span className={clsx('inline-block h-1.5 w-1.5 rounded-full transition-colors', active ? 'bg-sat-cyan' : 'bg-mc-dim/40')} />
            {label}
        </button>
    );
}

export function LayerToggles({ toggles, onChange, className }: LayerTogglesProps): JSX.Element {
    return (
        <div className={clsx('flex items-center gap-1.5', className)}>
            <Toggle
                label="SAR Water"
                active={toggles.sarWaterMask}
                onChange={(v) => onChange({ ...toggles, sarWaterMask: v })}
            />
            <Toggle
                label="Vulnerability"
                active={toggles.vulnerability}
                onChange={(v) => onChange({ ...toggles, vulnerability: v })}
            />
        </div>
    );
}
