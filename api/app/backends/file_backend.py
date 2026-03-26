from __future__ import annotations

import json
from pathlib import Path

from .base import GeoJSON


LAYER_FILES = {
    "flood": "flood_polygons.geojson",
    "priorities": "priority_zones.geojson",
    "mangrove_extent": "mangrove_extent.geojson",
    "mangrove_hotspots": "mangrove_hotspots.geojson",
}


class FileBackend:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir

    def initialize(self) -> None:
        missing = [name for name in LAYER_FILES.values() if not (self.data_dir / name).exists()]
        if missing:
            missing_csv = ", ".join(missing)
            raise FileNotFoundError(f"Missing demo files in {self.data_dir}: {missing_csv}")

    def _load_collection(self, layer_name: str) -> GeoJSON:
        file_name = LAYER_FILES[layer_name]
        with (self.data_dir / file_name).open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def get_layer(self, layer_name: str, date: str | None = None) -> GeoJSON:
        collection = self._load_collection(layer_name)
        if not date:
            return collection

        filtered_features = []
        for feature in collection.get("features", []):
            props = feature.get("properties", {})
            feature_date = props.get("date")
            if feature_date == date:
                filtered_features.append(feature)

        return {"type": "FeatureCollection", "features": filtered_features}

    def list_dates(self) -> list[str]:
        unique_dates: set[str] = set()
        for layer_name in LAYER_FILES:
            collection = self._load_collection(layer_name)
            for feature in collection.get("features", []):
                feature_date = feature.get("properties", {}).get("date")
                if feature_date:
                    unique_dates.add(feature_date)
        return sorted(unique_dates)

    def counts(self) -> dict[str, int]:
        response: dict[str, int] = {}
        for layer_name in LAYER_FILES:
            collection = self._load_collection(layer_name)
            response[layer_name] = len(collection.get("features", []))
        return response

    def close(self) -> None:
        return None
