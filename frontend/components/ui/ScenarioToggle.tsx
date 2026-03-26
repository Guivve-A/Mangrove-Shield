import clsx from 'clsx';

import type { ScenarioConfig, ScenarioKey } from '@/types/geospatial';

interface ScenarioToggleProps {
  options: ScenarioConfig[];
  value: ScenarioKey;
  onChange: (value: ScenarioKey) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ScenarioToggle({
  options,
  value,
  onChange,
  disabled = false,
  compact = false,
}: ScenarioToggleProps): JSX.Element {
  return (
    <div
      className={clsx(
        'grid gap-2',
        compact ? 'grid-cols-2' : 'grid-cols-2 max-[480px]:grid-cols-1',
        disabled && 'opacity-45'
      )}
    >
      {options.map((option) => {
        const isActive = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.key)}
            className={clsx(
              'rounded-xl border px-3 py-2 text-left transition duration-200',
              isActive
                ? 'border-cyan-400/80 bg-cyan-900/30 text-cyan-100 shadow-[0_0_0_1px_rgba(56,189,248,0.45)]'
                : 'border-slate-700/55 bg-slate-900/35 text-slate-300 hover:border-slate-500/80 hover:bg-slate-800/45'
            )}
          >
            <p className={clsx('font-semibold', compact ? 'text-[11px]' : 'text-xs')}>{option.label}</p>
          </button>
        );
      })}
    </div>
  );
}
