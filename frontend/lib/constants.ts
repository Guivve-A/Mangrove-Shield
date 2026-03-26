import type { CameraState, ScenarioConfig } from '@/types/geospatial';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';


export const SCENARIOS: ScenarioConfig[] = [
  {
    key: 'healthy',
    label: 'Healthy Mangroves',
    floodFactor: 0.72,
    mangroveFactor: 1.18,
    exposureFactor: 0.9,
  },
  {
    key: 'current',
    label: 'Current State',
    floodFactor: 1,
    mangroveFactor: 1,
    exposureFactor: 1,
  },
  {
    key: 'degraded',
    label: 'Degraded Mangroves',
    floodFactor: 1.38,
    mangroveFactor: 0.64,
    exposureFactor: 1.15,
  },
  {
    key: 'restoration',
    label: 'Restoration Scenario',
    floodFactor: 0.84,
    mangroveFactor: 1.13,
    exposureFactor: 0.94,
  },
];

export const DEFAULT_CAMERA: CameraState = {
  center: [-79.92, -2.34],
  zoom: 9.55,
  pitch: 34,
  bearing: -18,
};

export const DATE_FALLBACK = ['2026-01-01', '2026-01-15', '2026-02-01'];

export const RAINFALL_BASELINE: Record<string, number> = {
  '2026-01-01': 171,
  '2026-01-15': 194,
  '2026-02-01': 149,
};

export const SCENE_CAMERA_PRESETS: Record<string, CameraState> = {
  hero: {
    center: [-79.92, -2.34],
    zoom: 9.2,
    pitch: 20,
    bearing: -8,
  },
  operational: {
    center: [-79.92, -2.34],
    zoom: 9.9,
    pitch: 36,
    bearing: -18,
  },
  inspector: {
    center: [-79.89, -2.24],
    zoom: 11.35,
    pitch: 50,
    bearing: -24,
  },
  simulation: {
    center: [-79.95, -2.33],
    zoom: 9.6,
    pitch: 40,
    bearing: -12,
  },
  comparison: {
    center: [-79.95, -2.33],
    zoom: 9.65,
    pitch: 45,
    bearing: -20,
  },
};

export const HOTSPOT_CAMERA_PRESETS: Record<string, CameraState> = {
  'zone-puna': { center: [-80.005, -2.68], zoom: 11.2, pitch: 52, bearing: -26 },
  'zone-jambeli': { center: [-79.94, -2.80], zoom: 11.2, pitch: 52, bearing: -23 },
  'zone-duran': { center: [-79.815, -2.175], zoom: 11.4, pitch: 54, bearing: -20 },
  'zone-samborondon': { center: [-79.885, -2.115], zoom: 11.3, pitch: 53, bearing: -18 },
  'zone-estuario-centro': { center: [-79.92, -2.245], zoom: 11.25, pitch: 54, bearing: -24 },
};
