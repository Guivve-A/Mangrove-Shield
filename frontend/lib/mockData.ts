export interface GuayaquilKpiSnapshot {
  date: string;
  mangroveCoveragePct: number;
  healthIndex: number;
  floodRiskIndex: number;
  exposedPopulation: number;
  criticalInfrastructure: number;
  rainfall72h: number;
}

export interface GuayaquilHotspot {
  id: string;
  name: string;
  area: string;
  severity: number;
}

export const GUAYAQUIL_KPI_TIMELINE: GuayaquilKpiSnapshot[] = [
  {
    date: '2026-01-01',
    mangroveCoveragePct: 66,
    healthIndex: 0.63,
    floodRiskIndex: 0.69,
    exposedPopulation: 223400,
    criticalInfrastructure: 37,
    rainfall72h: 171,
  },
  {
    date: '2026-01-15',
    mangroveCoveragePct: 58,
    healthIndex: 0.53,
    floodRiskIndex: 0.81,
    exposedPopulation: 271800,
    criticalInfrastructure: 45,
    rainfall72h: 194,
  },
  {
    date: '2026-02-01',
    mangroveCoveragePct: 71,
    healthIndex: 0.68,
    floodRiskIndex: 0.64,
    exposedPopulation: 198300,
    criticalInfrastructure: 31,
    rainfall72h: 149,
  },
];

export const GUAYAQUIL_HOTSPOTS: GuayaquilHotspot[] = [
  { id: 'isla-puna-norte', name: 'Isla Puna Norte', area: 'Golfo de Guayaquil', severity: 0.72 },
  { id: 'guayas-estuary-core', name: 'Estuario del Rio Guayas', area: 'Canal principal', severity: 0.79 },
  { id: 'duran-ribera', name: 'Duran Ribera Este', area: 'Margen estuarina', severity: 0.76 },
  { id: 'samborondon-humedal', name: 'Samborondon Humedal', area: 'Noreste metropolitano', severity: 0.64 },
  { id: 'jambeli-canal', name: 'Canal de Jambeli', area: 'Corredor sur', severity: 0.74 },
];
