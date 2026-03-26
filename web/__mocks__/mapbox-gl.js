const mapInstances = [];

class MockSource {
  constructor(data) {
    this.data = data;
    this.setData = jest.fn((nextData) => {
      this.data = nextData;
    });
  }
}

class MockMap {
  constructor(options) {
    this.options = options;
    this.events = {};
    this.sources = new Map();
    this.layers = new Map();
    this.terrain = null;
    this.addControl = jest.fn();
    this.addSource = jest.fn((id, source) => {
      const sourceValue = source.type === 'geojson' ? new MockSource(source.data) : source;
      this.sources.set(id, sourceValue);
    });
    this.getSource = jest.fn((id) => this.sources.get(id));
    this.removeSource = jest.fn((id) => this.sources.delete(id));
    this.addLayer = jest.fn((layer) => {
      this.layers.set(layer.id, layer);
    });
    this.getLayer = jest.fn((id) => this.layers.get(id));
    this.removeLayer = jest.fn((id) => this.layers.delete(id));
    this.setTerrain = jest.fn((terrain) => {
      this.terrain = terrain;
    });
    this.easeTo = jest.fn();
    this.setLayoutProperty = jest.fn();
    this.setPaintProperty = jest.fn();
    this.queryRenderedFeatures = jest.fn(() => []);
    this.getCanvas = jest.fn(() => ({ style: {} }));
    this.resize = jest.fn();
    this.remove = jest.fn();

    mapInstances.push(this);

    setTimeout(() => {
      const handlers = this.events.load || [];
      handlers.forEach((handler) => handler());
    }, 0);
  }

  on(event, layerIdOrHandler, handler) {
    let fn = handler;
    if (typeof layerIdOrHandler === 'function') {
      fn = layerIdOrHandler;
    }

    if (!this.events[event]) {
      this.events[event] = [];
    }

    if (fn) {
      this.events[event].push(fn);
    }
    return this;
  }

  off(event, handler) {
    if (!this.events[event]) {
      return this;
    }

    this.events[event] = this.events[event].filter((h) => h !== handler);
    return this;
  }
}

module.exports = {
  Map: jest.fn((options) => new MockMap(options)),
  NavigationControl: jest.fn(),
  accessToken: '',
  __mockInstances: mapInstances,
};
