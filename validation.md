---
name: validation
description: >
  Skill de validación de datos reales para MangroveShield. Úsala siempre que el usuario
  quiera verificar que no hay datos mock, demo o hardcodeados en ninguna parte del proyecto.
  Actívala cuando el usuario diga "validar datos", "verificar que todo es real",
  "hay datos falsos", "qué falta para tener datos reales", "está usando demo data",
  "revisar fuentes", "auditar datos", o cuando se implemente una nueva sección (task1–task6)
  y haya que confirmar que sus datos vienen de fuentes reales. Si encuentra datos mock,
  reporta exactamente qué falta (API key, configuración, dataset, endpoint) para reemplazarlos.
---

# Validation — Auditoría de Datos Reales

Detecta datos mock, hardcodeados o de demostración en MangroveShield y genera un
reporte detallado de qué falta para que cada fuente sea 100% real.

---

## Rol del agente

Eres un auditor de integridad de datos. Tu trabajo es recorrer sistemáticamente cada
capa del proyecto — frontend, API, backend, pipeline y base de datos — e identificar
cualquier valor que no provenga de una fuente externa real. Para cada hallazgo, no solo
reportas el problema sino que indicas exactamente qué se necesita para corregirlo:
qué API, qué credencial, qué dataset, qué configuración.

---

## Mapa de fuentes de datos del proyecto

Antes de auditar, tener presente qué fuente real corresponde a cada dato:

| Dato | Fuente real esperada | Indicador de mock |
|---|---|---|
| Cobertura manglar (GeoJSON) | PostGIS ← GMW v3.0 / SERVIR v1.1 | `DATA_DIR: /app/data/demo` en docker-compose |
| Cambio histórico por año | PostGIS ← pipeline/gmw_change.py | GeoJSON estático en `data/demo/` |
| Mapa de cambio (teselas) | GEE → `GET /api/v1/mangrove/tiles?year=YYYY&compare=prev` | Endpoint retorna 503 o `tiles.*=null` |
| NDVI / salud manglar | GEE → Sentinel-2 mensual | Valores numéricos hardcodeados en componente |
| Biomasa AGB | NASA EarthData ← AGB v1.3 | Número fijo en constante o prop default |
| Lluvia / temperatura | OpenWeather API | `OPENWEATHER_API_KEY=tu_api_key_aqui` |
| Nivel de marea | Stormglass API | `STORMGLASS_API_KEY=tu_api_key_aqui` |
| Agua estancada (SAR) | GEE Sentinel-1 | `earthengine authenticate` no ejecutado |
| Inundaciones históricas | Copernicus EMS / PostGIS | Array JS hardcodeado en componente |
| Proyección SLR | NASA Sea Level API / IPCC AR6 | Objeto `const scenarios = { rcp45: {...} }` en código |
| Infraestructura expuesta | OSM Overpass API | Lista hardcodeada de hospitales/escuelas |
| Población en riesgo | WorldPop Ecuador 2020 | Número fijo en tarjeta o panel |
| Daños económicos | SNGR Ecuador + cálculo real | `$47M` hardcodeado en string JSX |
| Sitios de restauración | PostGIS ← pipeline/restoration_priority.py | Array de coordenadas fijas en código |

---

## Protocolo de auditoría (ejecutar en orden)

### NIVEL 1 — Detección rápida de mocks obvios

```bash
# 1a. Buscar strings de placeholder en todo el proyecto
grep -rn "tu_api_key_aqui\|YOUR_API_KEY\|API_KEY_HERE\|demo\|mock\|fake\|placeholder\|TODO\|FIXME\|hardcoded" \
  --include="*.ts" --include="*.tsx" --include="*.py" --include="*.yml" --include="*.env*" \
  --exclude-dir=node_modules --exclude-dir=.next \
  . 2>/dev/null

# 1b. Buscar datos numéricos hardcodeados en componentes React (señal de mock)
grep -rn "const.*=.*{" frontend/components/sections/ | \
  grep -E "[0-9]{4,}|ha|USD|\$[0-9]" | head -30

# 1c. Verificar si la API usa data/demo en lugar de PostGIS
grep -rn "DATA_BACKEND\|DATA_DIR\|data/demo" . \
  --include="*.yml" --include="*.env*" --include="*.py"

# 1d. Buscar fetch a URLs que no sean APIs reales
grep -rn "fetch\|axios\|httpx" frontend/components/ api/ backend/ \
  --include="*.ts" --include="*.tsx" --include="*.py" | \
  grep -v "localhost\|openweathermap\|stormglass\|earthengine\|api.nasa\|copernicus\|overpass-api\|worldpop"

# 1e. Buscar arrays de GeoJSON hardcodeados en el frontend
grep -rn "coordinates\|geometry\|FeatureCollection\|features.*\[" \
  frontend/components/ --include="*.ts" --include="*.tsx" | head -20
```

---

### NIVEL 2 — Auditoría por subsistema

#### 2A — Frontend (`frontend/`)

```bash
# Buscar valores numéricos estáticos en secciones (son datos mock si no vienen de API)
grep -rn "const.*=.*[0-9]" frontend/components/sections/ --include="*.tsx" | \
  grep -vE "import|className|style|px|rem|ms|z-index|opacity|index|length|key"

# Buscar props con valores default que deberían ser dinámicos
grep -rn "defaultValue\|initialData\|fallback.*=\|placeholder.*=" \
  frontend/components/sections/ --include="*.tsx"

# Verificar que cada sección llama a la API y no usa datos locales
grep -rn "useSWR\|useQuery\|fetch\|axios" \
  frontend/components/sections/ --include="*.tsx"
# Si una sección no aparece aquí → probablemente usa datos estáticos
```

#### 2B — Core Intelligence API (`api/`)

```bash
# Verificar qué backend de datos usa la API
grep -rn "DATA_BACKEND\|DATA_DIR\|open.*json\|load.*json\|read_file" \
  api/ --include="*.py"
# Si aparece DATA_BACKEND=file o open(*.json) → está leyendo demo data

# Verificar que los routers consultan PostGIS, no archivos
grep -rn "asyncpg\|psycopg\|databases\|sqlalchemy\|PostGIS\|ST_" \
  api/ --include="*.py"
# Si no aparece nada → la API no consulta base de datos real

# Verificar que los endpoints retornan datos variables (no respuesta fija)
grep -rn "return.*GeoJSON\|return.*json\|JSONResponse" \
  api/ --include="*.py" | head -20

# Verificar teselas GEE de cambio de manglar (si hay credenciales configuradas)
# Requiere: GEE_SERVICE_ACCOUNT_B64 + EE_PROJECT (y opcional EE_OPT_URL)
curl -s "http://localhost:8000/api/v1/mangrove/tiles?year=2020&compare=prev" | head -c 400
# Debe incluir: tiles.before / tiles.after / tiles.change con URLs earthengine.../{z}/{x}/{y}
```

#### 2C — Live Data Orchestrator (`backend/`)

```bash
# Verificar variables de entorno reales cargadas
grep -rn "os.getenv\|os.environ\|dotenv" backend/ --include="*.py"

# Confirmar que las keys no son placeholders
cat backend/.env 2>/dev/null | grep -E "KEY|TOKEN|SECRET" | \
  sed 's/=.*/=***REDACTED***/'
# Si el valor visible (antes de =) existe → la key está definida
# Si aparece "tu_api_key_aqui" → ES MOCK

# Verificar que GEE está autenticado
python3 -c "import ee; ee.Initialize(); print('GEE OK')" 2>&1

# Test real de OpenWeather
curl -s "https://api.openweathermap.org/data/2.5/weather?lat=-2.2&lon=-79.9&appid=$(grep OPENWEATHER backend/.env | cut -d= -f2)" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('OpenWeather OK:', d.get('name','ERROR'))"

# Test real de Stormglass
curl -s -H "Authorization: $(grep STORMGLASS backend/.env | cut -d= -f2)" \
  "https://api.stormglass.io/v2/tide/extremes/point?lat=-2.2&lng=-79.9&start=$(date -u +%Y-%m-%dT%H:%M:%SZ)" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('Stormglass OK' if 'data' in d else 'Stormglass ERROR:', d)"
```

#### 2D — Base de datos PostGIS (`infra/`)

```bash
# Verificar que las tablas existen y tienen datos reales (no vacías)
docker exec mangroveshield-db psql -U mangrove -d mangroveshield -c "
  SELECT
    schemaname,
    tablename,
    n_live_tup AS filas
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
"
# Si todas las tablas tienen 0 filas → no se ha importado ningún dataset real

# Verificar que las geometrías existen y son válidas
docker exec mangroveshield-db psql -U mangrove -d mangroveshield -c "
  SELECT
    table_name,
    COUNT(*) AS total,
    SUM(CASE WHEN ST_IsValid(geom) THEN 1 ELSE 0 END) AS validas,
    SUM(CASE WHEN geom IS NULL THEN 1 ELSE 0 END) AS nulas
  FROM information_schema.columns c
  JOIN pg_class p ON p.relname = c.table_name
  WHERE column_name = 'geom'
  GROUP BY table_name;
"

# Verificar que el bbox de Greater Guayaquil tiene datos
docker exec mangroveshield-db psql -U mangrove -d mangroveshield -c "
  SELECT COUNT(*) FROM mangrove_coverage
  WHERE ST_Intersects(geom, ST_MakeEnvelope(-80.1, -2.4, -79.4, -1.7, 4326));
" 2>/dev/null || echo "⚠ Tabla mangrove_coverage no existe — datos no importados"
```

#### 2E — Pipeline de datos (`pipeline/`)

```bash
# Verificar que los scripts de pipeline existen y están completos
ls -la pipeline/ 2>/dev/null || echo "⚠ Carpeta pipeline/ vacía"

# Verificar que los exports de GEE existen en PostGIS o como archivos
ls -la data/ | grep -v demo 2>/dev/null || echo "⚠ Solo existe data/demo/, sin datos reales exportados"

# Verificar que el pipeline puede conectar a GEE
cd pipeline && python3 -c "
import ee
try:
    ee.Initialize()
    col = ee.ImageCollection('projects/earthengine-legacy/assets/GMW/v3')
    size = col.size().getInfo()
    print(f'GEE GMW v3.0 OK — {size} imágenes disponibles')
except Exception as e:
    print(f'GEE ERROR: {e}')
"
```

---

### NIVEL 3 — Reporte de hallazgos

Para cada mock o dato no real encontrado, generar una entrada con este formato:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOCK DETECTADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ubicación:    frontend/components/sections/MangroveTimelineSection.tsx:47
Tipo:         Dato numérico hardcodeado
Valor actual: const totalHa = 48320
Problema:     Este valor no varía con el año ni con la fuente de datos real

PARA HACERLO REAL NECESITAS:
  1. Endpoint API:   GET /api/v1/mangrove/change?year={year}
  2. Base de datos:  Tabla mangrove_coverage con columna total_ha en PostGIS
  3. Dataset:        GMW v3.0 importado via pipeline/gmw_change.py
  4. Configuración:  GEE autenticado (earthengine authenticate)
  5. Tiempo est.:    4–6 horas (importar GMW + crear endpoint)

Comando para verificar cuando esté listo:
  curl http://localhost:8000/api/v1/mangrove/change?year=2020
  # Debe retornar {"metadata": {"total_ha": <valor_real>, ...}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### NIVEL 4 — Resumen ejecutivo

Al final de la auditoría, generar tabla resumen:

```
RESUMEN DE VALIDACIÓN — MangroveShield
Fecha: <timestamp>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sección / Fuente              Estado       Bloqueador
──────────────────────────────────────────────────────────────
Cobertura manglar (GeoJSON)   ⚠ DEMO      DATA_BACKEND=file en docker-compose
Cambio histórico 10 años      ❌ MOCK      GMW no importado a PostGIS
NDVI / salud mensual          ❌ MOCK      GEE no autenticado
Biomasa NASA AGB              ❌ MOCK      Dataset no descargado de EarthData
Lluvia (OpenWeather)          ✅ REAL      API key configurada y respondiendo
Mareas (Stormglass)           ✅ REAL      API key configurada y respondiendo
Agua SAR (GEE Sentinel-1)     ⚠ PARCIAL   GEE autenticado pero sin caché
Inundaciones históricas       ❌ MOCK      Copernicus EMS no integrado
Proyección SLR IPCC           ❌ MOCK      NASA SLR API no implementada
Infraestructura OSM           ❌ MOCK      Overpass API no implementada
Población WorldPop            ❌ MOCK      Dataset no descargado
Daños económicos              ❌ MOCK      SNGR no integrado
Sitios de restauración        ❌ MOCK      pipeline/restoration_priority.py no ejecutado
──────────────────────────────────────────────────────────────
REAL: 2/13 (15%)   PARCIAL: 1/13 (8%)   MOCK: 10/13 (77%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Checklist de requisitos por fuente real

### Para que GMW v3.0 sea real:
- [ ] Cuenta Google Earth Engine activa (`earthengine authenticate`)
- [ ] `pipeline/gmw_change.py` ejecutado para años 2014–2024
- [ ] Geometrías exportadas a PostGIS (tabla `mangrove_coverage`)
- [ ] `DATA_BACKEND=postgis` en `docker-compose.yml` (no `file`)
- [ ] Endpoint `/api/v1/mangrove/change` retorna filas reales de la DB

### Para que NDVI/Sentinel-2 sea real:
- [ ] GEE autenticado con Service Account (no interactive)
- [ ] `pipeline/health_indices.py` ejecutado para últimos 24 meses
- [ ] Cloud Optimized GeoTIFFs (COG) exportados o tile server configurado
- [ ] Endpoint `/api/v1/health/ndvi` retorna URL de tile real, no valor fijo

### Para que OpenWeather sea real:
- [ ] `OPENWEATHER_API_KEY` en `backend/.env` con valor real (no placeholder)
- [ ] `curl` al endpoint de test retorna `{"name": "Guayaquil", ...}`
- [ ] Frontend recibe el dato desde `http://localhost:8080/api/v1/weather`

### Para que Stormglass sea real:
- [ ] `STORMGLASS_API_KEY` en `backend/.env` con valor real
- [ ] Plan Stormglass permite acceso al Golfo de Guayaquil (lat: -2.2, lon: -79.9)
- [ ] Respuesta contiene array `data` con `height` y `time`

### Para que Copernicus EMS (inundaciones) sea real:
- [ ] Descargar activaciones Ecuador desde `https://emergency.copernicus.eu`
- [ ] Importar polígonos GeoJSON a PostGIS (tabla `flood_events`)
- [ ] Endpoint `/api/v1/flood/events` retorna eventos reales con geometría

### Para que NASA SLR (escenarios) sea real:
- [ ] Implementar cliente `https://sealevel.nasa.gov/api/sealevels`
- [ ] Parámetros: lat=-2.2, lon=-79.9, scenario=ssp245 / ssp585
- [ ] Caché en PostGIS o Redis (la API NASA es lenta — TTL 24h recomendado)

### Para que OSM Overpass (infraestructura) sea real:
- [ ] Implementar query Overpass: `[out:json]; area["name"="Guayaquil"]; ...`
- [ ] Importar resultado a PostGIS o cachear en Redis (TTL 7 días)
- [ ] Endpoint `/api/v1/economic/exposed-infrastructure` retorna OSM features

### Para que WorldPop sea real:
- [ ] Descargar raster Ecuador 2020 de `https://hub.worldpop.org/geodata/summary?id=49726`
- [ ] Importar a PostGIS como raster o procesar en GEE
- [ ] Pipeline calcula personas por zona de inundación proyectada

### Para que NASA AGB v1.3 sea real:
- [ ] Cuenta NASA EarthData creada en `https://earthdata.nasa.gov`
- [ ] Descargar granules de Ecuador (filtrar en EarthData Search por bbox Guayaquil)
- [ ] Importar a PostGIS o procesar en GEE
- [ ] Endpoint `/api/v1/health/ndvi?index=agb` retorna valores reales de biomasa

---

## Verificación rápida post-fix

Después de configurar cada fuente, ejecutar este test rápido:

```bash
# Test completo de todas las fuentes en un comando
python3 - << 'EOF'
import httpx, subprocess, json, os

results = {}

# OpenWeather
key = os.getenv("OPENWEATHER_API_KEY", "")
r = httpx.get(f"https://api.openweathermap.org/data/2.5/weather?lat=-2.2&lon=-79.9&appid={key}", timeout=5)
results["OpenWeather"] = "✅ REAL" if r.status_code == 200 else f"❌ ERROR {r.status_code}"

# Stormglass
key = os.getenv("STORMGLASS_API_KEY", "")
r = httpx.get("https://api.stormglass.io/v2/tide/extremes/point?lat=-2.2&lng=-79.9&start=2026-01-01",
              headers={"Authorization": key}, timeout=5)
results["Stormglass"] = "✅ REAL" if r.status_code == 200 else f"❌ ERROR {r.status_code}"

# GEE
try:
    import ee; ee.Initialize()
    results["GEE"] = "✅ REAL"
except Exception as e:
    results["GEE"] = f"❌ {str(e)[:60]}"

# PostGIS
try:
    import asyncpg, asyncio
    async def check():
        conn = await asyncpg.connect(os.getenv("DATABASE_URL", ""))
        rows = await conn.fetchval("SELECT COUNT(*) FROM mangrove_coverage")
        return rows
    rows = asyncio.run(check())
    results["PostGIS/GMW"] = f"✅ REAL ({rows} features)" if rows > 0 else "⚠ VACÍO"
except Exception as e:
    results["PostGIS/GMW"] = f"❌ {str(e)[:60]}"

# API local
try:
    r = httpx.get("http://localhost:8000/api/v1/mangrove/change?year=2020", timeout=5)
    data = r.json()
    is_demo = "demo" in str(data).lower() or data.get("metadata", {}).get("total_ha", 0) == 0
    results["API /mangrove/change"] = "⚠ DEMO DATA" if is_demo else "✅ REAL"
except Exception as e:
    results["API /mangrove/change"] = f"❌ {str(e)[:60]}"

print("\n=== VALIDATION REPORT ===")
for source, status in results.items():
    print(f"  {source:<25} {status}")
print("=========================\n")
EOF
```

---

## Reglas del agente

- **Nunca asumir que un dato es real** sin verificarlo con una llamada real a la fuente
- **Si no puede ejecutar el test** (sin acceso a terminal), inspeccionar el código fuente y buscar los patrones de mock listados en el Mapa de fuentes
- **Siempre reportar el bloqueador exacto** — no decir "falta configuración" sino "falta `OPENWEATHER_API_KEY` en `backend/.env`"
- **Siempre dar el comando de verificación** para cuando el fix esté aplicado
- **Priorizar por impacto visual** — un mock en el mapa principal es más crítico que uno en un tooltip
