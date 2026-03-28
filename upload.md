---
name: upload
description: >
  Skill de sincronización y despliegue para MangroveShield. Úsala siempre que el usuario
  quiera subir cambios, hacer push, deployar, sincronizar el repo, actualizar Firebase,
  corregir errores de CI/CD, revisar GitHub Actions, o mantener coherencia entre
  el repositorio, los workflows y el hosting en Firebase. También actívala cuando el
  usuario diga "sube los cambios", "deployar", "push", "está fallando el action",
  "actualizar producción", o "sincronizar". Cubre el ciclo completo: validar → commit
  → push → verificar Actions → confirmar deploy en Firebase.
---

# Upload — Skill de Sincronización y Despliegue

Mantiene GitHub, GitHub Actions y Firebase coherentes y sin errores tras cada cambio
en MangroveShield. Ejecuta el ciclo completo en orden estricto.

---

## Arquitectura de despliegue

```
Local (Claude Code)
    │
    ├── git push → GitHub (Guivve-A/Mangrove-Shield · rama main)
    │                   │
    │              .github/workflows/
    │                   │
    │              ┌────┴──────────────────────────┐
    │              │  CI pipeline (GitHub Actions) │
    │              │  1. make test (pytest + npm)  │
    │              │  2. docker compose build      │
    │              │  3. deploy → Firebase Hosting │
    │              └───────────────────────────────┘
    │                   │
    └──────────── Firebase Hosting (frontend/Next.js)
                  Firebase (si aplica: Firestore, Storage)
```

---

## Protocolo de ejecución (orden obligatorio)

### PASO 1 — Validación local antes del push

Nunca hacer push sin pasar estas verificaciones:

```bash
# 1a. Tests completos
make test
# Si falla → detener aquí, corregir antes de continuar

# 1b. Build del frontend sin errores
cd frontend && npm run build
# Si hay errores TypeScript o de módulos → corregir antes de continuar

# 1c. Verificar que no hay secrets expuestos
git diff --staged | grep -iE "(api_key|password|secret|token)" && echo "⚠ SECRET DETECTADO"

# 1d. Verificar .env no está en staging
git status | grep "\.env" && echo "⚠ .env en staging — NO hacer push"

# 1e. Docker compose build local (confirmar que los 3 servicios levantan)
docker compose build --no-cache
docker compose up -d && sleep 10
curl -f http://localhost:8000/docs || echo "⚠ API no responde"
curl -f http://localhost:3000 || echo "⚠ Frontend no responde"

# 1f. Verificar endpoint de teselas del timeline (requiere GEE configurado en la API)
curl -s "http://localhost:8000/api/v1/mangrove/tiles?year=2020&compare=prev" | head -c 400
# Debe incluir URLs tipo: ...earthengine.../{z}/{x}/{y}
# Si retorna 503 → faltan GEE_SERVICE_ACCOUNT_B64 y EE_PROJECT en el servicio `api`

docker compose down
```

Si cualquier paso falla → **detener, reportar el error exacto y corregirlo** antes de avanzar.

---

### PASO 2 — Commit semántico

Formato de commit obligatorio:
```
<tipo>(<subsistema>): <descripción corta en presente>

[cuerpo opcional — qué cambia y por qué]
[refs: #issue si aplica]
```

Tipos válidos:
```
feat      → nueva sección o funcionalidad (task1–task6)
fix       → corrección de bug
data      → cambio en datasets, endpoints GeoJSON, PostGIS
style     → cambio de UI sin lógica
refactor  → reestructura sin cambio de comportamiento
perf      → optimización de performance
ci        → cambio en GitHub Actions o Dockerfile
docs      → documentación (CLAUDE.md, skills, DATA_SCHEMA.md)
```

Ejemplos correctos:
```
feat(frontend): add MangroveTimelineSection with GMW v3.0 slider
fix(api): correct bbox filtering in /mangrove/change endpoint
data(pipeline): export GMW change layers 2014-2024 to PostGIS
ci(actions): add Firebase deploy step to workflow
```

Comandos:
```bash
git add -A
git status  # revisar qué entra en el commit — nunca `git add .` a ciegas
git commit -m "<mensaje semántico>"
```

---

### PASO 3 — Push y verificación de GitHub Actions

```bash
git push origin main
```

Inmediatamente después, verificar el estado del workflow:

```bash
# Listar runs recientes
gh run list --limit 5

# Ver el run más reciente en tiempo real
gh run watch

# Si falla → ver log completo del job que falló
gh run view <run-id> --log-failed
```

**Causas comunes de fallo en Actions y su corrección:**

| Error | Causa | Corrección |
|---|---|---|
| `pytest: command not found` | requirements.txt desactualizado en Docker | Añadir pytest a `api/requirements.txt` |
| `npm ci` falla | `package-lock.json` no commiteado | `git add package-lock.json && git commit` |
| `docker build` falla en CI | Dockerfile depende de archivo no commiteado | Verificar `.dockerignore` no excluye archivos necesarios |
| `FIREBASE_TOKEN` not found | Secret no configurado en GitHub | Añadir en Settings → Secrets → `FIREBASE_TOKEN` |
| PostGIS healthcheck timeout | La DB tarda más de 60s en CI | Aumentar `retries: 10` en `docker-compose.yml` |
| GEE auth falla en CI | `earthengine authenticate` requiere browser | Usar Service Account GEE en CI (ver sección GEE abajo) |

---

### PASO 4 — Verificar coherencia del workflow YAML

Antes de cualquier cambio a `.github/workflows/`, verificar que el workflow cubre los 3 servicios del proyecto:

```yaml
# Estructura mínima requerida en .github/workflows/main.yml

name: MangroveShield CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      db:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_USER: mangrove
          POSTGRES_PASSWORD: mangrove
          POSTGRES_DB: mangroveshield
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 6
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pip install -r api/requirements.txt
      - run: pytest tests/ -v
      - run: cd frontend && npm ci && npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci && npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: <FIREBASE_PROJECT_ID>
```

Reglas del workflow:
- `deploy` solo corre si `test` pasa (`needs: test`)
- `deploy` solo corre en `main`, nunca en PRs
- Nunca hardcodear tokens — siempre `${{ secrets.NOMBRE }}`

---

### PASO 5 — Verificar deploy en Firebase

```bash
# Ver estado del hosting
firebase hosting:channel:list

# Ver URL de producción
firebase hosting:sites:list

# Si el deploy falló en Actions, deployar manualmente:
cd frontend
npm run build
firebase deploy --only hosting

# Verificar que la URL de producción responde
curl -f https://<proyecto>.web.app || echo "⚠ Firebase no responde"
```

**Variables de entorno en Firebase Hosting:**
El frontend Next.js en Firebase necesita las variables de entorno en build time:

```bash
# En GitHub Actions, añadir antes del npm run build:
env:
  NEXT_PUBLIC_API_BASE_URL: ${{ secrets.NEXT_PUBLIC_API_BASE_URL }}
```

Nunca usar variables `NEXT_PUBLIC_*` con valores de desarrollo en producción.

---

### PASO 6 — Checklist post-deploy

Verificar manualmente después de cada deploy exitoso:

```bash
# 1. La URL de producción carga sin errores de consola
# 2. El mapa MapLibre inicializa correctamente
# 3. Los endpoints de la API responden (si el backend está deployado)
curl https://<api-url>/api/v1/health
# 3b. Timeline tiles: el mapa de cambio responde con teselas reales (GEE)
curl -s "https://<api-url>/api/v1/mangrove/tiles?year=2020&compare=prev" | head -c 400
# 4. No hay errores 404 en assets (JS, CSS, fuentes)
# 5. Las variables de entorno NEXT_PUBLIC_* tienen los valores de producción
```

---

## Configuración de GEE (Runtime + CI)

El mapa del timeline (`/api/v1/mangrove/tiles`) depende de Google Earth Engine.
Para que sea 100% real en producción, la **API** debe tener credenciales de Service Account.

```bash
# 1) Crear service account con acceso a Earth Engine (GCP)
# 2) Descargar el JSON (gee-service-account.json)

# Generar base64 (PowerShell)
# [Convert]::ToBase64String([IO.File]::ReadAllBytes("gee-service-account.json"))

# Generar base64 (Linux/macOS)
# base64 -w0 gee-service-account.json

# Variables requeridas en el servicio que corre la API (Railway / Docker / etc.)
# - GEE_SERVICE_ACCOUNT_B64 = <base64 del JSON>
# - EE_PROJECT = <GCP project id con Earth Engine habilitado>
# Opcional:
# - EE_OPT_URL = https://earthengine-highvolume.googleapis.com
```

En GitHub Actions (solo si el workflow necesita llamar a endpoints que usan GEE):
```yaml
env:
  GEE_SERVICE_ACCOUNT_B64: ${{ secrets.GEE_SERVICE_ACCOUNT_B64 }}
  EE_PROJECT: ${{ secrets.EE_PROJECT }}
```

---

## Secrets requeridos en GitHub

Verificar que estos secrets existen en `Settings → Secrets and variables → Actions`:

| Secret | Descripción |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON de service account de Firebase |
| `NEXT_PUBLIC_API_BASE_URL` | URL de la API en producción |
| `OPENWEATHER_API_KEY` | OpenWeather para el orquestador |
| `STORMGLASS_API_KEY` | Stormglass para mareas |
| `GEE_SERVICE_ACCOUNT_B64` | Base64 del JSON de service account (GEE) |
| `EE_PROJECT` | GCP Project ID con Earth Engine habilitado |
| `DATABASE_URL` | URL de PostGIS en producción (si aplica) |

Si falta alguno → el workflow fallará silenciosamente o con error de autenticación.

---

## Reglas inamovibles

- **Nunca hacer push directo con tests fallando** — corregir primero
- **Nunca commitear `.env`** — verificar `.gitignore` antes de cada push
- **Nunca subir secrets en el código** — usar `${{ secrets.NOMBRE }}` siempre
- **Nunca deployar a Firebase sin que el job `test` haya pasado** (`needs: test`)
- **Si el workflow falla** → leer el log completo con `gh run view --log-failed` antes de intentar fix
- **Si Firebase deploy falla** → verificar que `FIREBASE_SERVICE_ACCOUNT` está configurado y no expiró
- **Después de cambiar `docker-compose.yml`** → verificar que el workflow de CI también refleja el cambio
- **Después de añadir una nueva sección (task1–task6)** → actualizar `docs/DATA_SCHEMA.md` y verificar que el endpoint correspondiente está en la API antes del push
