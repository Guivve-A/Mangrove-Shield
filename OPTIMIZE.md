---
name: optimize
description: >
  Audita, optimiza y fortalece el proyecto MangroveShield en tres dimensiones:
  rendimiento de la página (Core Web Vitals, bundle size, carga de mapas),
  seguridad (API keys, CORS, headers HTTP, exposición de datos sensibles) e
  integridad del sistema (contratos GeoJSON, consistencia de datos entre
  subsistemas, cobertura de tests). Usa esta skill siempre que el usuario
  mencione lentitud, vulnerabilidades, errores de datos, revisión de seguridad,
  optimización, auditoría, o quiera verificar que el sistema está íntegro antes
  de un despliegue.
---

# OPTIMIZE — Auditoría de MangroveShield

## Alcance de la skill

Cubre tres dimensiones en orden de ejecución:

1. **Seguridad** — riesgos críticos primero
2. **Integridad** — contratos de datos y consistencia entre subsistemas
3. **Rendimiento** — velocidad de carga y respuesta

---

## 1. Seguridad

### API Keys y secretos
- Verificar que ningún archivo fuera de `.env` contiene keys hardcodeadas
  ```bash
  grep -r "OPENWEATHER_API_KEY\|STORMGLASS_API_KEY\|AIza\|sk-" \
    --include="*.ts" --include="*.py" --include="*.js" \
    --exclude-dir=".git" .
  ```
- Confirmar que `.env` está en `.gitignore`
- Revisar el historial de commits recientes por exposición accidental:
  ```bash
  git log --oneline -20 | head -5
  git diff HEAD~5 HEAD -- "*.env" 2>/dev/null
  ```

### Headers HTTP de seguridad (frontend Next.js)
Verificar que `next.config.js` define estos headers en producción:

| Header | Valor recomendado |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | Restringir a dominios conocidos (MapLibre CDN, APIs propias) |

### CORS (api/ y backend/)
- `api/` (puerto 8000): `CORS_ORIGINS` debe listar solo orígenes conocidos, nunca `*` en producción
- `backend/` (puerto 8080): mismo principio para el orquestador
- Verificar en `docker-compose.yml` que `CORS_ORIGINS` no usa wildcard

### Exposición de datos geoespaciales sensibles
- Los endpoints de la `api/` no deben exponer coordenadas de infraestructura crítica sin autenticación
- Verificar que `/api/vulnerability-zones` requiere al menos un token de lectura en producción

---

## 2. Integridad

### Contrato GeoJSON entre api/ y frontend/
Todo GeoJSON que sirve `api/` debe cumplir el schema en `docs/DATA_SCHEMA.md`.
Validar estructura mínima de cada capa:

```python
# Estructura esperada por MapLibre en el frontend
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "...", "coordinates": [...] },  # WGS84
      "properties": { ... }  # según DATA_SCHEMA.md
    }
  ]
}
```

Pasos:
1. Leer `docs/DATA_SCHEMA.md` para obtener los campos obligatorios por capa
2. Verificar cada GeoJSON en `data/demo/` contra ese schema
3. Si hay endpoints activos, hacer `GET /api/mangroves`, `GET /api/flood-zones` y validar respuesta

### Consistencia entre subsistemas
- Las capas que sirve `api/` deben coincidir con las que consume el frontend (revisar `frontend/lib/constants.ts` o similar)
- El orquestador (`backend/`) debe escribir en los mismos campos que lee la `api/`
- Verificar que PostGIS tiene las tablas que `api/` espera (revisar `infra/postgis/init/`)

### Cobertura de tests
```bash
# Python
cd api && pytest --tb=short -q
# Frontend
cd frontend && npm test -- --watchAll=false
```
- Reportar tests fallidos y módulos sin cobertura
- Priorizar tests para: endpoints GeoJSON, parser SAR, lógica de risk scoring

### Integridad de datos demo vs. reales
- Confirmar que `data/demo/` no contiene datos reales mezclados
- Verificar que `DATA_BACKEND=postgis` no lee accidentalmente de `data/demo/`

---

## 3. Rendimiento

### Frontend (Next.js + MapLibre)

**Bundle size**
```bash
cd frontend && npm run build 2>&1 | grep -E "Route|Size|First Load"
```
Objetivos:
- First Load JS < 200 KB por ruta
- Chunks de MapLibre y deck.gl deben estar en `vendor` separado

**Core Web Vitals objetivo**
| Métrica | Objetivo |
|---|---|
| LCP (Largest Contentful Paint) | < 2.5s |
| FID / INP | < 100ms |
| CLS | < 0.1 |

**Carga de capas del mapa**
- Los GeoJSON de manglares e inundación deben cargarse con `fetch` lazy (no en el bundle)
- Si el GeoJSON supera 1 MB, recomendar conversión a `PMTiles` o `vector tiles` para MapLibre
- Verificar que deck.gl usa `updateTriggers` correctamente para evitar re-renders completos

**Imágenes y assets**
- Verificar que `next/image` se usa para todas las imágenes estáticas
- Confirmar que GSAP solo se importa en componentes que lo usan (no en el bundle global)

### API (FastAPI)

**Latencia de endpoints GeoJSON**
```bash
# Medir tiempo de respuesta de los endpoints principales
curl -o /dev/null -s -w "%{time_total}s\n" http://localhost:8000/api/mangroves
curl -o /dev/null -s -w "%{time_total}s\n" http://localhost:8000/api/flood-zones
```
Objetivo: < 200ms para datos en caché, < 1s para queries PostGIS

**Optimizaciones PostGIS**
- Verificar índices espaciales: `CREATE INDEX USING GIST (geometry)` en todas las tablas geométricas
- Usar `ST_Simplify` para reducir resolución de polígonos grandes antes de serializar a GeoJSON
- Cachear respuestas de endpoints estáticos con `functools.lru_cache` o Redis si está disponible

**Orquestador (backend/)**
- Las llamadas a OpenWeather y Stormglass deben ser asíncronas (`httpx.AsyncClient`)
- Implementar retry con backoff exponencial para llamadas a GEE
- Cachear datos de lluvia/marea con TTL de 10 minutos mínimo para no agotar cuota de APIs

---

## Reporte de salida

Al terminar la auditoría, generar un resumen con este formato:

```
## Resultado de auditoría MangroveShield

### Seguridad
✅ / ⚠️ / ❌  [hallazgo + acción recomendada]

### Integridad
✅ / ⚠️ / ❌  [hallazgo + acción recomendada]

### Rendimiento
✅ / ⚠️ / ❌  [hallazgo + métrica medida]

### Acciones prioritarias
1. [crítico]
2. [importante]
3. [mejora]
```

Usar ✅ si cumple el objetivo, ⚠️ si hay margen de mejora, ❌ si es un riesgo o falla activa.
