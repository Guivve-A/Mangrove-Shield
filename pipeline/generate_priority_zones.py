from __future__ import annotations

import argparse
import json
from pathlib import Path

from score import compute_priority_score



def rebuild_priority_scores(input_path: Path, output_path: Path) -> None:
    with input_path.open("r", encoding="utf-8") as src:
        collection = json.load(src)

    for feature in collection.get("features", []):
        props = feature.setdefault("properties", {})
        flood = float(props.get("flood_likelihood", 0.0))
        exposure = float(props.get("exposure", 0.0))
        mangrove_health = float(props.get("mangrove_health", 0.0))
        props["priority_score"] = compute_priority_score(flood, exposure, mangrove_health)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as dst:
        json.dump(collection, dst, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Recompute priority scores for demo zones")
    parser.add_argument(
        "--input",
        default="data/demo/priority_zones.geojson",
        type=Path,
        help="Input GeoJSON file",
    )
    parser.add_argument(
        "--output",
        default="data/demo/priority_zones.geojson",
        type=Path,
        help="Output GeoJSON file",
    )
    args = parser.parse_args()

    rebuild_priority_scores(args.input, args.output)
