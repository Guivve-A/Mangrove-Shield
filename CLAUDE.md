# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rol del agente
Eres el agente de desarrollo de MangroveShield. Tu responsabilidad es implementar, extender y mantener este repositorio de forma coherente con su arquitectura de tres subsistemas, las convenciones del stack y los objetivos científicos del proyecto. Cuando recibas una tarea, identifica en qué subsistema vive, consulta el schema o doc relevante en `docs/` antes de cambiar contratos, y prioriza las brechas pendientes sobre features nuevos.

## Proyecto
Plataforma geoespacial de inteligencia para protección de manglares y riesgo de inundación en el Gran Guayaquil, Ecuador (3.3M habitantes). Integra monitoreo en tiempo real y análisis satelital.

## Arquitectura
```
frontend/    → Next.js + TypeScript + MapLibre + deck.gl + GSAP  (puerto 3000)
api/         → FastAPI · sirve GeoJSON de vulnerabilidad, manglares, inundación  (puerto 8000)
backend/     → FastAPI · OpenWeather, Stormglass, GEE/SAR en tiempo real  (puerto 8080)
pipeline/    → Procesamiento GEE: cambio histórico, NDVI, biomasa
scripts/     → Utilidades de ingesta y exportación de datos
data/demo/   → GeoJSON de demo (nunca mezclar con datos reales)
infra/       → Init SQL de PostGIS
docs/        → DATA_SCHEMA.md, BACKEND_API.md, UX_DESIGN.md (consultar antes de cambiar contratos)
```

## Stack
- **Python 3.11+** — black + isort + type hints obligatorios
- **Node 20+** — sin `any` en TypeScript, Tailwind utility-first
- **PostGIS** — toda capa real va aquí; `data/demo/` solo para desarrollo local
- **Coordenadas** — siempre WGS84 (EPSG:4326)
- **API keys** — solo desde `.env`, nunca hardcodeadas

## Comandos
```bash
docker compose up --build   # stack completo con datos demo
make test                   # pytest + npm test
earthengine authenticate    # primera vez con GEE
```

### Frontend
```bash
cd frontend && npm ci
npm run dev      # dev server en puerto 3000
npm run build    # export estático a out/
npx tsc --noEmit # type check sin compilar
npm run lint
```

### Backend / API (Python)
```bash
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8080

cd api && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Tests
```bash
make test                        # pytest (api/) + npm test (web/)
docker compose run --rm api pytest
docker compose run --rm web npm test
cd web && npm test               # Jest individual
```

## Flujo de datos
```
GEE / OpenWeather / Stormglass
        ↓ (pipeline/sync_data.py, cada 6h via CI/CD)
Firebase Firestore (api_cache — solo escritura desde backend)
        ↓
frontend hooks: useIntelligenceData + useLiveData
        ↓
IntelligenceMap.tsx (MapLibre + deck.gl)
```

Fallback cuando la API falla: `frontend/public/data/demo/*.geojson`

## Intervalos de polling (frontend)
| Feed | Intervalo | TTL cache |
|---|---|---|
| Weather | 5 min | 4 min |
| Vulnerability | 10 min | 9 min |
| SAR | 30 min | 28 min |
| Ecosystem | 60 min | 55 min |

## Sistema de escenarios
Multiplicadores aplicados en `frontend/lib/scenario.ts`:
| Escenario | flood | mangrove | exposure |
|---|---|---|---|
| healthy | 0.72× | 1.18× | 0.90× |
| current | 1.00× | 1.00× | 1.00× |
| degraded | 1.38× | 0.64× | 1.15× |
| restoration | 0.84× | 1.13× | 0.94× |

## Datasets a integrar
| Dataset | Uso |
|---|---|
| Global Mangrove Watch v3.0 | Cambio de cobertura 1996–2020 |
| NASA AGB v1.3 | Biomasa y altura de dosel (30m, año 2000) |
| SERVIR Amazonia v1.1 | Cobertura Guayas 2018/2020/2022 (10m) |

## Brechas pendientes (prioridad)
1. Sustituir `data/demo/` con datasets reales en PostGIS
2. Análisis histórico de cambio 10 años (GEE → `pipeline/`)
3. Salud del manglar: NDVI + biomasa NASA
4. Correlación espacial manglar–inundación
5. Escenarios climáticos RCP 4.5 / RCP 8.5
6. Sitios prioritarios de restauración

## Reglas
- La lógica geoespacial vive en `api/` o `pipeline/`, nunca en el frontend
- Cambios al schema GeoJSON → actualizar `docs/DATA_SCHEMA.md` primero
- `data/demo/` es de solo lectura para el agente
- CI/CD: deploy a Firebase Hosting en push a `main`; sync de datos cada 6h
- Firebase project ID: `studio-8904974087-7cc0a`
