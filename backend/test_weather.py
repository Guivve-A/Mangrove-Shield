import asyncio
from main import fetch_weather, fetch_tide
from pprint import pprint
import sys

async def run():
    print("Pruebas de APIs Externas:")
    print("--- OpenWeather (Current Weather) ---")
    w = await fetch_weather(force=True)
    pprint(w)
    
    print("\n--- Stormglass (v2) ---")
    try:
        t = await fetch_tide(force=True)
        pprint(t)
    except Exception as e:
        print(e)
        
    # Salir con código de error si las métricas clave fallaron o regresaron 0 a causa de un error crítico
    if "error" in w and "INVALID_KEY" in str(w.get("error", "")):
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run())
