export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

export function clampPercent01(value: number): number {
  return clamp(value, 0, 1);
}

export function formatPercent(value: number, digits = 0): string {
  const pct = clampPercent01(value) * 100;
  return `${pct.toFixed(digits)}%`;
}

export function formatMillimeters(value: number): string {
  const safe = clamp(value, 0, 2000);
  return `${safe.toFixed(1)} mm`;
}

export function formatCompactNumber(value: number): string {
  const safe = clamp(value, 0, 100_000_000);
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(safe);
}

export function formatInteger(value: number): string {
  const safe = clamp(value, 0, 100_000_000);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(safe));
}

export function formatSignedDelta(value: number, suffix = ''): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}${suffix}`;
}
