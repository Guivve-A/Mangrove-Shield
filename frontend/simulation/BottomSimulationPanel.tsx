import type { ScenarioKey } from '@/types/geospatial';
import { SCENARIOS } from '@/lib/constants';
import { ScenarioToggle } from '@/components/ui/ScenarioToggle';
import clsx from 'clsx';

interface BottomSimulationPanelProps {
  dates: string[];
  selectedDateIndex: number;
  onDateIndexChange: (value: number) => void;
  stormIntensity: number;
  onStormIntensityChange: (value: number) => void;
  restorationEnabled: boolean;
  onRestorationChange: (value: boolean) => void;
  scenario: ScenarioKey;
  onScenarioChange: (value: ScenarioKey) => void;
  terrainMode: boolean;
  onTerrainToggle: () => void;
  comparisonMode: boolean;
  onComparisonToggle: (value: boolean) => void;
  compareScenario: ScenarioKey;
  onCompareScenarioChange: (value: ScenarioKey) => void;
}

export function BottomSimulationPanel({
  dates,
  selectedDateIndex,
  onDateIndexChange,
  stormIntensity,
  onStormIntensityChange,
  restorationEnabled,
  onRestorationChange,
  scenario,
  onScenarioChange,
  terrainMode,
  onTerrainToggle,
  comparisonMode,
  onComparisonToggle,
  compareScenario,
  onCompareScenarioChange,
}: BottomSimulationPanelProps): JSX.Element {
  return (
    <footer
      data-animate-bottom
      className="surface-grid border-t border-slate-700/40 bg-panel/95 px-4 py-3 backdrop-blur-sm"
    >
      <div className="grid grid-cols-12 gap-3 max-[1250px]:grid-cols-1">
        <div className="col-span-3 rounded-2xl border border-slate-700/50 bg-panelSoft/65 p-3">
          <label htmlFor="timeline" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Timeline
          </label>
          <input
            id="timeline"
            type="range"
            min={0}
            max={Math.max(0, dates.length - 1)}
            value={selectedDateIndex}
            onChange={(event) => onDateIndexChange(Number(event.target.value))}
            className="mt-2 w-full accent-cyan-400"
          />
          <div className="mt-1 text-sm text-slate-200">{dates[selectedDateIndex] || 'No date selected'}</div>
        </div>

        <div className="col-span-3 rounded-2xl border border-slate-700/50 bg-panelSoft/65 p-3">
          <label htmlFor="storm" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Storm Intensity
          </label>
          <input
            id="storm"
            type="range"
            min={0.5}
            max={1.8}
            step={0.05}
            value={stormIntensity}
            onChange={(event) => onStormIntensityChange(Number(event.target.value))}
            className="mt-2 w-full accent-orange-400"
          />
          <div className="mt-1 text-sm text-slate-200">{stormIntensity.toFixed(2)}x</div>
        </div>

        <div className="col-span-6 rounded-2xl border border-slate-700/50 bg-panelSoft/65 p-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onRestorationChange(!restorationEnabled)}
              className={clsx(
                'rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition',
                restorationEnabled
                  ? 'border-emerald-400/70 bg-emerald-900/30 text-emerald-200'
                  : 'border-slate-600/60 bg-slate-900/40 text-slate-300 hover:border-slate-500/80'
              )}
            >
              Restoration Impact Simulation
            </button>

            <button
              type="button"
              onClick={() => onComparisonToggle(!comparisonMode)}
              className={clsx(
                'rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition',
                comparisonMode
                  ? 'border-cyan-400/70 bg-cyan-900/30 text-cyan-200'
                  : 'border-slate-600/60 bg-slate-900/40 text-slate-300 hover:border-slate-500/80'
              )}
            >
              Comparison Mode
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">Primary Scenario</p>
            <ScenarioToggle options={SCENARIOS} value={scenario} onChange={onScenarioChange} compact />
          </div>

          <div className="mt-3">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">Comparison Scenario</p>
            <ScenarioToggle
              options={SCENARIOS}
              value={compareScenario}
              onChange={onCompareScenarioChange}
              compact
              disabled={!comparisonMode}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
          Scenario controls update flood, mangrove attenuation, and exposure in real time.
        </div>

        <div className="flex items-center gap-1 rounded-full border border-slate-600/70 bg-slate-900/65 p-1">
          <button
            type="button"
            onClick={() => {
              if (terrainMode) {
                onTerrainToggle();
              }
            }}
            className={clsx(
              'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition',
              !terrainMode ? 'bg-cyan-500 text-slate-950' : 'bg-transparent text-slate-200'
            )}
          >
            2D View
          </button>
          <button
            type="button"
            onClick={() => {
              if (!terrainMode) {
                onTerrainToggle();
              }
            }}
            className={clsx(
              'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition',
              terrainMode ? 'bg-cyan-500 text-slate-950' : 'bg-transparent text-slate-200'
            )}
          >
            3D View
          </button>
        </div>
      </div>
    </footer>
  );
}
