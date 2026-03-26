from __future__ import annotations

from typing import Any, Protocol

GeoJSON = dict[str, Any]


class DataBackend(Protocol):
    def initialize(self) -> None:
        pass

    def get_layer(self, layer_name: str, date: str | None = None) -> GeoJSON:
        pass

    def list_dates(self) -> list[str]:
        pass

    def counts(self) -> dict[str, int]:
        pass

    def close(self) -> None:
        pass
