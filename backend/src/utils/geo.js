function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function isValidBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    return false;
  }

  const [minLon, minLat, maxLon, maxLat] = bbox;
  return (
    [minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value)) &&
    minLon < maxLon &&
    minLat < maxLat &&
    minLon >= -180 &&
    maxLon <= 180 &&
    minLat >= -90 &&
    maxLat <= 90
  );
}

function bboxIntersects(a, b) {
  const [aMinLon, aMinLat, aMaxLon, aMaxLat] = a;
  const [bMinLon, bMinLat, bMaxLon, bMaxLat] = b;
  return !(aMaxLon < bMinLon || bMaxLon < aMinLon || aMaxLat < bMinLat || bMaxLat < aMinLat);
}

function bboxContainsPoint(bbox, point) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const [lon, lat] = point;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

function bboxCenter(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

function bboxToPolygon(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return {
    type: "Polygon",
    coordinates: [[
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ]],
  };
}

function flattenCoordinates(input, bucket = []) {
  if (!Array.isArray(input)) {
    return bucket;
  }

  if (input.length >= 2 && typeof input[0] === "number" && typeof input[1] === "number") {
    bucket.push([Number(input[0]), Number(input[1])]);
    return bucket;
  }

  for (const child of input) {
    flattenCoordinates(child, bucket);
  }

  return bucket;
}

function geometryToBbox(geometry) {
  if (!geometry || !geometry.coordinates) {
    return null;
  }

  const points = flattenCoordinates(geometry.coordinates);
  if (!points.length) {
    return null;
  }

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of points) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }

  return [minLon, minLat, maxLon, maxLat];
}

function featureIntersectsBbox(feature, bbox) {
  if (!feature || !feature.geometry) {
    return false;
  }

  const featureBbox = geometryToBbox(feature.geometry);
  if (!featureBbox) {
    return false;
  }

  return bboxIntersects(featureBbox, bbox);
}

function pointInRing(point, ring) {
  let inside = false;
  const [x, y] = point;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInPolygon(point, polygonCoordinates) {
  if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length === 0) {
    return false;
  }

  const [outerRing, ...holes] = polygonCoordinates;
  if (!pointInRing(point, outerRing)) {
    return false;
  }

  for (const hole of holes) {
    if (pointInRing(point, hole)) {
      return false;
    }
  }

  return true;
}

function pointInFeature(point, feature) {
  if (!feature || !feature.geometry) {
    return false;
  }

  const { type, coordinates } = feature.geometry;
  if (type === "Polygon") {
    return pointInPolygon(point, coordinates);
  }

  if (type === "MultiPolygon") {
    return coordinates.some((polygon) => pointInPolygon(point, polygon));
  }

  return false;
}

function buildGrid(bbox, rows, cols) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lonStep = (maxLon - minLon) / cols;
  const latStep = (maxLat - minLat) / rows;

  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cellMinLon = minLon + col * lonStep;
      const cellMaxLon = cellMinLon + lonStep;
      const cellMinLat = minLat + row * latStep;
      const cellMaxLat = cellMinLat + latStep;
      const cellBbox = [cellMinLon, cellMinLat, cellMaxLon, cellMaxLat];

      cells.push({
        row,
        col,
        bbox: cellBbox,
        center: [(cellMinLon + cellMaxLon) / 2, (cellMinLat + cellMaxLat) / 2],
        geometry: bboxToPolygon(cellBbox),
      });
    }
  }

  return cells;
}

function featureCollection(features = []) {
  return {
    type: "FeatureCollection",
    features,
  };
}

module.exports = {
  clamp,
  isValidBbox,
  bboxIntersects,
  bboxContainsPoint,
  bboxCenter,
  bboxToPolygon,
  geometryToBbox,
  featureIntersectsBbox,
  pointInFeature,
  buildGrid,
  featureCollection,
};