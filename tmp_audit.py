import urllib.request, json, os, asyncio

results = {}

# OpenWeather
key = os.getenv("OPENWEATHER_API_KEY", "")
try:
    req = urllib.request.Request(f"https://api.openweathermap.org/data/2.5/weather?lat=-2.2&lon=-79.9&appid={key}")
    with urllib.request.urlopen(req, timeout=5) as r:
        results["OpenWeather"] = "✅ REAL" if r.getcode() == 200 else f"❌ ERROR {r.getcode()}"
except Exception as e:
    results["OpenWeather"] = f"❌ ERROR connection {e}"

# Stormglass
key = os.getenv("STORMGLASS_API_KEY", "")
try:
    req = urllib.request.Request("https://api.stormglass.io/v2/tide/extremes/point?lat=-2.2&lng=-79.9&start=2026-01-01", headers={"Authorization": key})
    with urllib.request.urlopen(req, timeout=5) as r:
        results["Stormglass"] = "✅ REAL" if r.getcode() == 200 else f"❌ ERROR {r.getcode()}"
except Exception as e:
     results["Stormglass"] = f"❌ ERROR connection {e}"

# GEE
try:
    import ee
    ee.Initialize()
    results["GEE"] = "✅ REAL"
except Exception as e:
    results["GEE"] = f"❌ {str(e)[:60].replace(chr(10), ' ')}"

# PostGIS
try:
    import asyncpg
    async def check():
        conn = await asyncpg.connect("postgresql://mangrove:mangrove_secure_password@localhost:5432/mangroveshield")
        rows = await conn.fetchval("SELECT COUNT(*) FROM mangrove_coverage")
        await conn.close()
        return rows
    rows = asyncio.run(check())
    results["PostGIS/GMW"] = f"✅ REAL ({rows} features)" if rows > 0 else "⚠ VACÍO (0 rows)"
except Exception as e:
    results["PostGIS/GMW"] = f"❌ {str(e)[:60].replace(chr(10), ' ')}"

# API local
try:
    req = urllib.request.Request("http://localhost:8000/api/v1/mangrove/change?year=2020")
    with urllib.request.urlopen(req, timeout=5) as r:
        data = json.loads(r.read().decode())
        is_demo = "demo" in str(data).lower() or data.get("metadata", {}).get("total_ha", 0) == 0
        results["API /mangrove/change"] = "⚠ DEMO DATA" if is_demo else "✅ REAL"
except Exception as e:
    results["API /mangrove/change"] = f"❌ {str(e)[:60].replace(chr(10), ' ')}"

print("\n=== VALIDATION REPORT ===")
for source, status in results.items():
    print(f"  {source:<25} {status}")
print("=========================\n")
