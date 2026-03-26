from __future__ import annotations

import json
from pathlib import Path
from typing import Any

try:
    import psycopg
    from psycopg import sql
except ModuleNotFoundError:  # pragma: no cover - exercised in non-DB local tests
    psycopg = None  # type: ignore[assignment]
    sql = None  # type: ignore[assignment]

from .file_backend import LAYER_FILES


DEFAULT_DATE = "2026-01-01"


class PostGISBackend:
    def __init__(self, database_url: str, data_dir: Path):
        self.database_url = database_url
        self.data_dir = data_dir
        self.connection: Any = None

    def initialize(self) -> None:
        if psycopg is None:
            raise RuntimeError("psycopg is required for the PostGIS backend")
        self.connection = psycopg.connect(self.database_url, autocommit=True)
        self._create_schema()
        self._seed_demo_data()

    def _get_connection(self) -> Any:
        if self.connection is None:
            raise RuntimeError("Database connection is not initialized")
        return self.connection

    def _create_schema(self) -> None:
        conn = self._get_connection()
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            for table_name in LAYER_FILES:
                identifier = sql.Identifier(table_name)
                cur.execute(
                    sql.SQL(
                        """
                        CREATE TABLE IF NOT EXISTS {table_name} (
                            id BIGSERIAL PRIMARY KEY,
                            feature_id TEXT NOT NULL,
                            obs_date DATE NOT NULL,
                            properties JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                            geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
                            UNIQUE(feature_id, obs_date)
                        );
                        """
                    ).format(table_name=identifier)
                )
                cur.execute(
                    sql.SQL(
                        "CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} USING GIST (geom);"
                    ).format(
                        index_name=sql.Identifier(f"{table_name}_geom_idx"),
                        table_name=identifier,
                    )
                )
                cur.execute(
                    sql.SQL("CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} (obs_date);").format(
                        index_name=sql.Identifier(f"{table_name}_date_idx"),
                        table_name=identifier,
                    )
                )

    def _seed_demo_data(self) -> None:
        conn = self._get_connection()
        with conn.cursor() as cur:
            for layer_name, file_name in LAYER_FILES.items():
                data_path = self.data_dir / file_name
                if not data_path.exists():
                    raise FileNotFoundError(f"Missing demo file: {data_path}")

                with data_path.open("r", encoding="utf-8") as handle:
                    collection = json.load(handle)

                table_identifier = sql.Identifier(layer_name)
                cur.execute(
                    sql.SQL("TRUNCATE TABLE {table_name} RESTART IDENTITY;").format(
                        table_name=table_identifier
                    )
                )
                for index, feature in enumerate(collection.get("features", []), start=1):
                    props = dict(feature.get("properties", {}))
                    obs_date = props.pop("date", DEFAULT_DATE)
                    feature_id = str(feature.get("id") or props.get("id") or f"{layer_name}-{index}")
                    geometry = json.dumps(feature["geometry"])
                    properties = json.dumps(props)

                    cur.execute(
                        sql.SQL(
                            """
                            INSERT INTO {table_name} (feature_id, obs_date, properties, geom)
                            VALUES (%s, %s, %s::jsonb, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
                            ON CONFLICT (feature_id, obs_date)
                            DO UPDATE SET properties = EXCLUDED.properties, geom = EXCLUDED.geom;
                            """
                        ).format(table_name=table_identifier),
                        (feature_id, obs_date, properties, geometry),
                    )

    def get_layer(self, layer_name: str, date: str | None = None) -> dict[str, Any]:
        conn = self._get_connection()
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL(
                    """
                    SELECT json_build_object(
                        'type', 'FeatureCollection',
                        'features', COALESCE(
                            json_agg(
                                json_build_object(
                                    'type', 'Feature',
                                    'id', feature_id,
                                    'geometry', ST_AsGeoJSON(geom)::json,
                                    'properties', properties || jsonb_build_object('date', to_char(obs_date, 'YYYY-MM-DD'))
                                ) ORDER BY feature_id
                            ),
                            '[]'::json
                        )
                    )
                    FROM {table_name}
                    WHERE (%s::date IS NULL OR obs_date = %s::date);
                    """
                ).format(table_name=sql.Identifier(layer_name)),
                (date, date),
            )
            result = cur.fetchone()
            if not result or not result[0]:
                return {"type": "FeatureCollection", "features": []}
            return result[0]

    def list_dates(self) -> list[str]:
        conn = self._get_connection()
        union_queries = []
        for table_name in LAYER_FILES:
            union_queries.append(
                sql.SQL("SELECT obs_date FROM {table_name}").format(
                    table_name=sql.Identifier(table_name)
                )
            )

        query = sql.SQL(" UNION ").join(union_queries)
        full_query = sql.SQL("SELECT to_char(obs_date, 'YYYY-MM-DD') FROM ({subquery}) AS dates ORDER BY obs_date;").format(
            subquery=query
        )

        with conn.cursor() as cur:
            cur.execute(full_query)
            rows = cur.fetchall()
        return [row[0] for row in rows]

    def counts(self) -> dict[str, int]:
        conn = self._get_connection()
        response: dict[str, int] = {}
        with conn.cursor() as cur:
            for table_name in LAYER_FILES:
                cur.execute(
                    sql.SQL("SELECT COUNT(*) FROM {table_name};").format(
                        table_name=sql.Identifier(table_name)
                    )
                )
                response[table_name] = int(cur.fetchone()[0])
        return response

    def close(self) -> None:
        if self.connection is not None:
            self.connection.close()
            self.connection = None
