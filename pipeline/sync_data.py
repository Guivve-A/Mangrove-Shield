import asyncio
import os
import sys
from pathlib import Path

# Add backend to path so we can import main
root_dir = Path(__file__).resolve().parents[1]
sys.path.append(str(root_dir / "backend"))

try:
    from main import (
        get_sar_data,
        fetch_weather,
        fetch_tide,
        get_mangrove_health,
        compute_risk_assessment,
        sync_to_firestore
    )
except ImportError as e:
    print(f"Error importing backend logic: {e}")
    sys.exit(1)

async def run_sync():
    print("Starting automated data synchronization...")
    
    # 1. Fetch all data in parallel
    print("Fetching live data from sensors (GEE, Weather, Tide)...")
    sar_task = asyncio.to_thread(get_sar_data, True)
    weather_task = fetch_weather(True)
    tide_task = fetch_tide(True)
    health_task = asyncio.to_thread(get_mangrove_health, True)

    sar_data, weather_data, tide_data, health_data = await asyncio.gather(
        sar_task, weather_task, tide_task, health_task
    )

    # 2. Compute risk assessment
    print("Computing risk assessment...")
    risk_assessment = compute_risk_assessment(weather_data, tide_data, sar_data, health_data)

    payload = {
        "timestamp": Path(root_dir / "backend").stat().st_mtime, # Dummy or real timestamp
        "weather": weather_data,
        "tide": tide_data,
        "sar_data": sar_data,
        "ecosystem_health": health_data,
        "risk_assessment": risk_assessment,
    }
    
    # Fix timestamp to ISO
    from datetime import datetime
    payload["timestamp"] = datetime.utcnow().isoformat() + "Z"

    # 3. Direct push to Firestore
    print("Pushing results to Firebase Firestore...")
    await sync_to_firestore(payload)
    
    print("Synchronization complete.")

if __name__ == "__main__":
    asyncio.run(run_sync())
