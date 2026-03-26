from __future__ import annotations

import math
from collections import Counter
from typing import Any

from app.backends.base import DataBackend


REGION_METADATA = {
    "id": "greater-guayaquil-ecuador",
    "name": "Greater Guayaquil",
    "country": "Ecuador",
    "focus": "Mangrove resilience and flood vulnerability",
}


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_index(value: Any, default: float = 0.0) -> float:
    return _clamp(_to_float(value, default))


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _risk_level(index: float) -> str:
    if index >= 0.8:
        return "critical"
    if index >= 0.65:
        return "high"
    if index >= 0.4:
        return "moderate"
    return "low"


def _ring_area_km2(ring: list[list[float]]) -> float:
    if len(ring) < 3:
        return 0.0

    points: list[tuple[float, float]] = []
    for coordinate in ring:
        if len(coordinate) < 2:
            continue
        points.append((_to_float(coordinate[0]), _to_float(coordinate[1])))

    if len(points) < 3:
        return 0.0

    if points[0] != points[-1]:
        points.append(points[0])

    mean_lat = _mean([latitude for _, latitude in points])
    km_per_degree_lon = 111.320 * math.cos(math.radians(mean_lat))
    km_per_degree_lat = 110.574

    shoelace = 0.0
    for (lon_a, lat_a), (lon_b, lat_b) in zip(points, points[1:]):
        x_a = lon_a * km_per_degree_lon
        y_a = lat_a * km_per_degree_lat
        x_b = lon_b * km_per_degree_lon
        y_b = lat_b * km_per_degree_lat
        shoelace += (x_a * y_b) - (x_b * y_a)

    return abs(shoelace) * 0.5


def _polygon_area_km2(polygon_coordinates: list[list[list[float]]]) -> float:
    if not polygon_coordinates:
        return 0.0

    outer_area = _ring_area_km2(polygon_coordinates[0])
    holes_area = sum(_ring_area_km2(inner_ring) for inner_ring in polygon_coordinates[1:])
    return max(0.0, outer_area - holes_area)


def _feature_area_km2(feature: dict[str, Any]) -> float:
    geometry = feature.get("geometry", {})
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates", [])

    if geometry_type == "Polygon":
        return _polygon_area_km2(coordinates)
    if geometry_type == "MultiPolygon":
        return sum(_polygon_area_km2(polygon) for polygon in coordinates)
    return 0.0


def _feature_properties(feature: dict[str, Any]) -> dict[str, Any]:
    properties = feature.get("properties", {})
    if isinstance(properties, dict):
        return properties
    return {}


class IntelligenceService:
    def __init__(self, backend: DataBackend):
        self.backend = backend

    def _resolve_date(self, date: str | None) -> str | None:
        if date:
            return date
        dates = self.backend.list_dates()
        if not dates:
            return None
        return dates[-1]

    def _get_features(self, layer_name: str, date: str | None) -> list[dict[str, Any]]:
        collection = self.backend.get_layer(layer_name, date=date)
        features = collection.get("features", [])
        return [feature for feature in features if isinstance(feature, dict)]

    def _health_index_for_date(self, date: str | None) -> float:
        extent_features = self._get_features("mangrove_extent", date)
        hotspot_features = self._get_features("mangrove_hotspots", date)

        extent_health = [_to_index(_feature_properties(feature).get("mangrove_health")) for feature in extent_features]
        hotspot_health = [_to_index(_feature_properties(feature).get("mangrove_health")) for feature in hotspot_features]

        return _clamp((0.7 * _mean(extent_health)) + (0.3 * _mean(hotspot_health)))

    def _ecosystem_trend(self, resolved_date: str | None) -> dict[str, Any]:
        dates = self.backend.list_dates()
        if not resolved_date or resolved_date not in dates:
            return {
                "direction": "unknown",
                "delta": 0.0,
                "previous_date": None,
            }

        date_index = dates.index(resolved_date)
        if date_index == 0:
            return {
                "direction": "baseline",
                "delta": 0.0,
                "previous_date": None,
            }

        previous_date = dates[date_index - 1]
        previous_health = self._health_index_for_date(previous_date)
        current_health = self._health_index_for_date(resolved_date)
        delta = current_health - previous_health

        if delta > 0.02:
            direction = "improving"
        elif delta < -0.02:
            direction = "declining"
        else:
            direction = "stable"

        return {
            "direction": direction,
            "delta": round(delta, 3),
            "previous_date": previous_date,
        }

    def mangroves(self, date: str | None) -> dict[str, Any]:
        resolved_date = self._resolve_date(date)
        extent_features = self._get_features("mangrove_extent", resolved_date)
        hotspot_features = self._get_features("mangrove_hotspots", resolved_date)

        extent_health = [_to_index(_feature_properties(feature).get("mangrove_health")) for feature in extent_features]
        hotspot_health = [_to_index(_feature_properties(feature).get("mangrove_health")) for feature in hotspot_features]
        hotspot_severity = [_to_index(_feature_properties(feature).get("severity")) for feature in hotspot_features]

        status_counter = Counter(
            str(_feature_properties(feature).get("status", "unknown")).lower()
            for feature in extent_features
        )
        coverage_km2 = sum(_feature_area_km2(feature) for feature in extent_features)

        hotspots = sorted(
            (
                {
                    "id": str(feature.get("id", f"hotspot-{index}")),
                    "name": str(_feature_properties(feature).get("hotspot_name", f"Hotspot {index}")),
                    "severity": round(_to_index(_feature_properties(feature).get("severity")), 3),
                    "mangrove_health": round(_to_index(_feature_properties(feature).get("mangrove_health")), 3),
                }
                for index, feature in enumerate(hotspot_features, start=1)
            ),
            key=lambda item: item["severity"],
            reverse=True,
        )

        return {
            "region": REGION_METADATA,
            "date": resolved_date,
            "summary": {
                "coverage_km2": round(coverage_km2, 2),
                "health_index": round(_mean(extent_health + hotspot_health), 3),
                "degradation_pressure": round(_mean(hotspot_severity), 3),
                "extent_features": len(extent_features),
                "hotspot_features": len(hotspot_features),
                "status_breakdown": dict(status_counter),
            },
            "hotspots": hotspots[:5],
        }

    def flood_risk(self, date: str | None) -> dict[str, Any]:
        resolved_date = self._resolve_date(date)
        flood_features = self._get_features("flood", resolved_date)
        priority_features = self._get_features("priorities", resolved_date)

        flood_likelihood = [_to_index(_feature_properties(feature).get("flood_likelihood")) for feature in flood_features]
        flood_exposure = [_to_index(_feature_properties(feature).get("exposure")) for feature in flood_features]

        priority_exposure = [_to_index(_feature_properties(feature).get("exposure")) for feature in priority_features]
        priority_health = [_to_index(_feature_properties(feature).get("mangrove_health")) for feature in priority_features]
        priority_scores = [_to_index(_feature_properties(feature).get("priority_score")) for feature in priority_features]

        mean_flood_likelihood = _mean(flood_likelihood)
        mean_exposure = _mean(flood_exposure) if flood_exposure else _mean(priority_exposure)
        mangrove_stress = 1.0 - _mean(priority_health)

        risk_index = _clamp(
            (0.5 * mean_flood_likelihood) + (0.35 * mean_exposure) + (0.15 * mangrove_stress)
        )

        zones = sorted(
            (
                {
                    "id": str(feature.get("id", f"zone-{index}")),
                    "zone_name": str(_feature_properties(feature).get("zone_name", f"Zone {index}")),
                    "flood_likelihood": round(_to_index(_feature_properties(feature).get("flood_likelihood")), 3),
                    "exposure": round(_to_index(_feature_properties(feature).get("exposure")), 3),
                    "mangrove_health": round(_to_index(_feature_properties(feature).get("mangrove_health")), 3),
                    "priority_score": round(_to_index(_feature_properties(feature).get("priority_score")), 3),
                }
                for index, feature in enumerate(priority_features, start=1)
            ),
            key=lambda item: item["priority_score"],
            reverse=True,
        )

        critical_zone_count = sum(1 for zone in zones if zone["priority_score"] >= 0.7)

        return {
            "region": REGION_METADATA,
            "date": resolved_date,
            "summary": {
                "risk_index": round(risk_index, 3),
                "risk_level": _risk_level(risk_index),
                "mean_flood_likelihood": round(mean_flood_likelihood, 3),
                "mean_exposure": round(mean_exposure, 3),
                "critical_zones": critical_zone_count,
                "flood_features": len(flood_features),
                "priority_features": len(priority_features),
                "mean_priority_score": round(_mean(priority_scores), 3),
            },
            "zones": zones[:5],
        }

    def coastal_protection(self, date: str | None) -> dict[str, Any]:
        resolved_date = self._resolve_date(date)
        extent_features = self._get_features("mangrove_extent", resolved_date)
        hotspot_features = self._get_features("mangrove_hotspots", resolved_date)
        priority_features = self._get_features("priorities", resolved_date)

        extent_health = [_to_index(_feature_properties(feature).get("mangrove_health")) for feature in extent_features]
        hotspot_severity = [_to_index(_feature_properties(feature).get("severity")) for feature in hotspot_features]
        priority_scores = [_to_index(_feature_properties(feature).get("priority_score")) for feature in priority_features]

        natural_buffer_index = _clamp((0.65 * _mean(extent_health)) + (0.35 * (1 - _mean(hotspot_severity))))
        protection_gap_index = _clamp((0.5 * _mean(priority_scores)) + (0.5 * (1 - natural_buffer_index)))

        intervention_candidates = []
        for index, feature in enumerate(priority_features, start=1):
            properties = _feature_properties(feature)
            flood_likelihood = _to_index(properties.get("flood_likelihood"))
            exposure = _to_index(properties.get("exposure"))
            mangrove_health = _to_index(properties.get("mangrove_health"))
            protection_gap = _clamp((0.55 * flood_likelihood) + (0.3 * exposure) + (0.15 * (1 - mangrove_health)))
            intervention_candidates.append(
                {
                    "id": str(feature.get("id", f"zone-{index}")),
                    "zone_name": str(properties.get("zone_name", f"Zone {index}")),
                    "protection_gap": round(protection_gap, 3),
                    "priority_score": round(_to_index(properties.get("priority_score")), 3),
                }
            )

        intervention_candidates.sort(key=lambda item: item["protection_gap"], reverse=True)

        return {
            "region": REGION_METADATA,
            "date": resolved_date,
            "summary": {
                "natural_buffer_index": round(natural_buffer_index, 3),
                "protection_gap_index": round(protection_gap_index, 3),
                "mangrove_extent_health": round(_mean(extent_health), 3),
                "hotspot_pressure": round(_mean(hotspot_severity), 3),
                "priority_features": len(priority_features),
            },
            "priority_interventions": intervention_candidates[:5],
        }

    def ecosystem_health(self, date: str | None) -> dict[str, Any]:
        resolved_date = self._resolve_date(date)
        extent_features = self._get_features("mangrove_extent", resolved_date)
        hotspot_features = self._get_features("mangrove_hotspots", resolved_date)
        flood_features = self._get_features("flood", resolved_date)

        extent_health = [_to_index(_feature_properties(feature).get("mangrove_health")) for feature in extent_features]
        hotspot_health = [_to_index(_feature_properties(feature).get("mangrove_health")) for feature in hotspot_features]
        hotspot_severity = [_to_index(_feature_properties(feature).get("severity")) for feature in hotspot_features]
        flood_likelihood = [_to_index(_feature_properties(feature).get("flood_likelihood")) for feature in flood_features]

        health_index = _clamp((0.7 * _mean(extent_health)) + (0.3 * _mean(hotspot_health)))
        stress_index = _clamp((0.6 * _mean(hotspot_severity)) + (0.4 * _mean(flood_likelihood)))
        resilience_index = _clamp((0.7 * health_index) + (0.3 * (1 - stress_index)))

        return {
            "region": REGION_METADATA,
            "date": resolved_date,
            "summary": {
                "health_index": round(health_index, 3),
                "stress_index": round(stress_index, 3),
                "resilience_index": round(resilience_index, 3),
                "extent_health": round(_mean(extent_health), 3),
                "hotspot_health": round(_mean(hotspot_health), 3),
                "flood_pressure": round(_mean(flood_likelihood), 3),
            },
            "trend": self._ecosystem_trend(resolved_date),
            "methodology": {
                "sentinel_monitoring": "Sentinel-1 SAR monitoring (cloud-resilient)",
                "elevation_model": "Digital elevation model for flood susceptibility",
                "mangrove_signal": "Mangrove health and hotspot severity indicators",
            },
        }
