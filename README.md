# MangroveShield Earth Intelligence Platform

MangroveShield is a professional geospatial decision-support platform for flood-risk intelligence and mangrove protection in Greater Guayaquil, Ecuador. It integrates real-time environmental monitoring (weather, tide) and satellite SAR imagery to predict flood exposure and prioritize physical interventions.

## Architecture & System Stack

The platform is divided into three distinct sub-systems:

1. **Frontend Application (`frontend/`)**
   - Built with Next.js, React, TypeScript, and TailwindCSS.
   - Interactive cinematic map powered by MapLibre, deck.gl, and GSAP animations.
   - Responsible for data visualization, risk scoring display, and environmental data representation.

2. **Core Intelligence API (`api/`)**
   - Built with Python (FastAPI).
   - Serves GeoJSON datasets for vulnerability zones, mangrove coverage, and pre-calculated flood polygons.
   - Optionally backed by a PostgreSQL + PostGIS database for complex geospatial queries.

3. **Live Data Orchestrator (`backend/`)**
   - Built with Python (FastAPI).
   - Pulls real-time **rainfall** and **temperature** data from OpenWeather.
   - Pulls real-time **tide levels** in the Gulf of Guayaquil using Stormglass.
   - Fetches live **SAR satellite imagery** (Synthetic Aperture Radar) via Google Earth Engine to detect standing water regardless of cloud cover.

---

## Prerequisites & API Keys

To run the full *live* monitoring system, you need the following accounts/keys:
- **Node.js 20+** & **Python 3.11+**
- **Docker & Docker Compose** (Optional, for easy containerization)
- [OpenWeatherMap API Key](https://openweathermap.org/api)
- [Stormglass API Key](https://stormglass.io/)
- [Google Earth Engine](https://earthengine.google.com/) account (Requires running `earthengine authenticate` locally)

Place your API keys in the orchestration environment file:
`backend/.env`:
```env
OPENWEATHER_API_KEY=tu_api_key_aqui
STORMGLASS_API_KEY=tu_api_key_aqui
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

---

## 🚀 Running the Platform

There are two primary ways to run MangroveShield depending on your needs.

### Method A: Full Production Stack (Docker)
Ideal for viewing the platform architecture and intelligence logic quickly. This spins up the Frontend, Core Intelligence API (Port 8000), and PostGIS database.

```bash
docker compose up --build
```
- **Frontend Dashboard:** http://localhost:3000
- **Intelligence API & Docs:** http://localhost:8000/docs

*Note: The dockerized environment primarily uses historical demo data to guarantee stability. For live signal integrations, use Method B.*

### Method B: Manual Live Orchestration (Recommended for Real-Time Monitoring)
This method spins up the local Python orchestrator to fetch live API data (Rain, Tide, SAR) and connects the Next.js frontend to it.

**1. Start the Live Data Orchestrator (Port 8080)**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Authenticate with Google Earth Engine (First time only)
earthengine authenticate

# Start the uvicorn server
uvicorn main:app --reload --port 8080
```

**2. Start the Frontend (Port 3000)**
Open a new terminal session:
```bash
cd frontend
npm install
npm run dev
```
Navigate to http://localhost:3000. Under the "Risk Section", live weather and tide widgets will actively ping the Orchestrator on port `8080` for real-time readings.

---

## Validation & Testing

- **Backend Logic (Orchestrator):** You can manually force data syncs by hitting the `POST http://localhost:8080/api/v1/trigger/weather` endpoint.
- **Frontend UI Build:** Run `npm test` inside the `frontend/` directory.

## Documentation Reference
For deeper design paradigms and data schemas, check the `docs/` folder:
- `UX_DESIGN.md`: Visual paradigms and UI rules.
- `INTERACTION_FLOW.md` & `UX_FLOW.md`: Web page routing and user progression.
- `DATA_SCHEMA.md` & `DATA_FORMATTING.md`: Types and payload outlines expected by the frontend.
- `ANIMATION_SYSTEM.md`: GSAP timelines and component transitions.
- `BACKEND_API.md`: In-depth Core API specs.
