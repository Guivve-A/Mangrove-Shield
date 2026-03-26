import httpx
import json
import os

import os
REFRESH_TOKEN = os.environ.get('GOOGLE_OAUTH_REFRESH_TOKEN', '')
CLIENT_ID = os.environ.get('GOOGLE_OAUTH_CLIENT_ID', '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com')
PROJECT_ID = os.environ.get('GCP_PROJECT_ID', 'studio-8904974087-7cc0a')
if not REFRESH_TOKEN:
    raise SystemExit("ERROR: Missing GOOGLE_OAUTH_REFRESH_TOKEN environment variable. Set it before running this script.")

def sync():
    # 1. Get Access Token
    print("Refreshing access token...")
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "grant_type": "refresh_token",
        "client_id": CLIENT_ID,
        "refresh_token": REFRESH_TOKEN
    }
    r = httpx.post(token_url, data=token_data)
    r.raise_for_status()
    access_token = r.json()["access_token"]
    
    # 2. Prepare Data
    cache_path = "frontend/public/data/api_cache.json"
    with open(cache_path, "r") as f:
        data = json.load(f)
        
    # Firestore REST expects 'fields' map with typed values
    firestore_doc = {
        "fields": {
            "weather": {"mapValue": {"fields": {
                "rain_mm": {"doubleValue": data["weather"]["rain_mm"]},
                "temp_c": {"doubleValue": data["weather"]["temp_c"]},
                "source": {"stringValue": data["weather"]["source"]}
            }}},
            "tide": {"mapValue": {"fields": {
                "level_m": {"doubleValue": data["tide"]["level_m"]},
                "source": {"stringValue": data["tide"]["source"]}
            }}},
            "risk_assessment": {"mapValue": {"fields": {
                "level": {"stringValue": data["risk_assessment"]["level"]},
                "score": {"doubleValue": data["risk_assessment"]["score"]}
            }}},
            "sar_data": {"mapValue": {"fields": {
                "tile_url": {"stringValue": data["sar_data"]["tile_url"]},
                "date_acquired": {"stringValue": data["sar_data"]["date_acquired"]},
                "flood_anomaly_fraction": {"doubleValue": data["sar_data"]["flood_anomaly_fraction"]}
            }}},
            "ecosystem_health": {"mapValue": {"fields": {
                "health_index": {"doubleValue": data["ecosystem_health"]["health_index"]},
                "classification": {"stringValue": data["ecosystem_health"]["classification"]},
                "date_acquired": {"stringValue": data["ecosystem_health"]["date_acquired"]}
            }}}
        }
    }
    
    # 3. PATCH Firestore
    print(f"Syncing to Firestore project {PROJECT_ID}...")
    db_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/api_cache/flood_status"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    # Use updateMask to ensure we replace the whole document fields correctly
    params = {"updateMask.fieldPaths": ["weather", "tide", "risk_assessment", "sar_data", "ecosystem_health"]}
    
    r = httpx.patch(db_url, headers=headers, params=params, json=firestore_doc)
    
    if r.status_code == 200:
        print("✅ SUCCESS: MangroveShield is now LIVE with real-time data!")
    else:
        print(f"❌ FAILED: {r.status_code}")
        print(r.text)

if __name__ == "__main__":
    sync()
