import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MapDashboard from '../components/MapDashboard';
import { HOTSPOT_HEIGHT_MULTIPLIER, PRIORITY_HEIGHT_MULTIPLIER } from '../3d/layers';

const mapboxgl = jest.requireMock('mapbox-gl');

const collection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'test-zone',
      properties: {
        date: '2026-01-01',
        flood_likelihood: 0.8,
        exposure: 0.7,
        mangrove_health: 0.5,
        priority_score: 0.75,
        severity: 0.55,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-75.56, 10.41],
            [-75.55, 10.41],
            [-75.55, 10.42],
            [-75.56, 10.42],
            [-75.56, 10.41],
          ],
        ],
      },
    },
  ],
};

function mockFetch(): void {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const href = String(url);
    if (href.includes('/timeline')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ dates: ['2026-01-01', '2026-01-15'] }),
      } as Response);
    }

    return Promise.resolve({
      ok: true,
      json: async () => collection,
    } as Response);
  }) as jest.Mock;
}

beforeEach(() => {
  mapboxgl.Map.mockClear();
  mapboxgl.__mockInstances.length = 0;
  mockFetch();
});

afterEach(() => {
  jest.clearAllMocks();
});

test('initializes the map with 3D terrain when enabled', async () => {
  render(<MapDashboard initial3DEnabled />);

  await waitFor(() => {
    expect(mapboxgl.Map).toHaveBeenCalledTimes(1);
    expect(mapboxgl.__mockInstances.length).toBe(1);
  });

  const map = mapboxgl.__mockInstances[0];

  await waitFor(() => {
    expect(map.setTerrain).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'dem',
        exaggeration: 1.8,
      })
    );
  });
});

test('creates extrusion layers with expected height multipliers', async () => {
  render(<MapDashboard initial3DEnabled />);

  await waitFor(() => {
    expect(mapboxgl.__mockInstances.length).toBe(1);
  });

  const map = mapboxgl.__mockInstances[0];

  await waitFor(() => {
    const addLayerCalls = map.addLayer.mock.calls.map((call: any[]) => call[0]);
    const priorityExtrusion = addLayerCalls.find((layer: any) => layer.id === 'priority-extrusion');
    const hotspotsExtrusion = addLayerCalls.find((layer: any) => layer.id === 'mangrove-hotspots-extrusion');

    expect(priorityExtrusion).toBeDefined();
    expect(priorityExtrusion.paint['fill-extrusion-height']).toEqual(
      expect.arrayContaining([PRIORITY_HEIGHT_MULTIPLIER])
    );

    expect(hotspotsExtrusion).toBeDefined();
    expect(hotspotsExtrusion.paint['fill-extrusion-height']).toEqual(
      expect.arrayContaining([HOTSPOT_HEIGHT_MULTIPLIER])
    );
  });
});

test('toggles between 2D and 3D modes from the switch', async () => {
  const user = userEvent.setup();
  render(<MapDashboard initial3DEnabled={false} />);

  await waitFor(() => {
    expect(mapboxgl.__mockInstances.length).toBe(1);
  });

  const map = mapboxgl.__mockInstances[0];
  const toggle = screen.getByLabelText(/3d view|2d view/i);

  await user.click(toggle);

  await waitFor(() => {
    expect(map.setTerrain).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'dem', exaggeration: 1.8 })
    );
  });

  await user.click(toggle);

  await waitFor(() => {
    expect(map.setTerrain).toHaveBeenCalledWith(null);
  });
});
