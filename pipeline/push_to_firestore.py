"""
pipeline/push_to_firestore.py

Push pre-computed pipeline outputs to Firestore WITHOUT re-running GEE.
Use this when you already have health_indices_output.json and gmw_timeline_output.json
and just need to populate Firestore so the API stops using hardcoded fallback data.

Usage:
    cd Mangrove_remote
    python pipeline/push_to_firestore.py

Requirements:
    pip install firebase-admin python-dotenv
"""

from __future__ import annotations

import base64
import json
import logging
import os
import tempfile
from pathlib import Path

# Load .env from backend/ directory
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parents[1] / "backend" / ".env"
    load_dotenv(_env_path)
    print(f"Loaded .env from: {_env_path}")
except ImportError:
    print("python-dotenv not installed; relying on system environment variables")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

PIPELINE_DIR = Path(__file__).resolve().parent


def _init_firebase():
    """Initialize Firebase Admin SDK using FIREBASE_SERVICE_ACCOUNT_B64."""
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        return

    sa_b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_B64", "")
    if not sa_b64:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_B64 is not set. "
            "Check backend/.env or your environment variables."
        )

    raw = base64.b64decode(sa_b64)
    info = json.loads(raw)

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w", encoding="utf-8") as f:
        json.dump(info, f)
        key_path = f.name

    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)
    logger.info("Firebase initialized with project: %s", info.get("project_id", "?"))
    os.unlink(key_path)


def push_health_indices() -> None:
    """Push health_indices_output.json → Firestore api_cache/mangrove_health_indices"""
    from firebase_admin import firestore

    path = PIPELINE_DIR / "health_indices_output.json"
    if not path.exists():
        logger.error("File not found: %s", path)
        return

    with path.open("r", encoding="utf-8") as f:
        records = json.load(f)

    logger.info("Pushing %d health records to Firestore...", len(records))
    db = firestore.client()
    doc_ref = db.collection("api_cache").document("mangrove_health_indices")
    doc_ref.set({"records": records, "updated": firestore.SERVER_TIMESTAMP})
    logger.info("✅ Pushed health indices → api_cache/mangrove_health_indices")


def push_timeline() -> None:
    """Push gmw_timeline_output.json → Firestore api_cache/mangrove_timeline"""
    from firebase_admin import firestore

    path = PIPELINE_DIR / "gmw_timeline_output.json"
    if not path.exists():
        logger.error("File not found: %s", path)
        return

    with path.open("r", encoding="utf-8") as f:
        records = json.load(f)

    logger.info("Pushing %d timeline records to Firestore...", len(records))
    db = firestore.client()
    doc_ref = db.collection("api_cache").document("mangrove_timeline")
    doc_ref.set({"records": records, "updated": firestore.SERVER_TIMESTAMP})
    logger.info("✅ Pushed timeline → api_cache/mangrove_timeline")


def verify() -> None:
    """Read back both documents from Firestore to confirm they exist."""
    from firebase_admin import firestore

    db = firestore.client()

    for doc_id in ["mangrove_health_indices", "mangrove_timeline"]:
        doc = db.collection("api_cache").document(doc_id).get()
        if doc.exists:
            data = doc.to_dict()
            records = data.get("records", [])
            logger.info("✅ Verified api_cache/%s — %d records", doc_id, len(records))
        else:
            logger.error("❌ api_cache/%s does NOT exist after push", doc_id)


if __name__ == "__main__":
    print("\n=== MangroveShield — Firestore Push ===\n")

    _init_firebase()
    push_health_indices()
    push_timeline()

    print("\n--- Verification ---")
    verify()

    print("\n✅ Done. The API will now serve real GEE data instead of fallback values.")
    print("   Reload your production URL to confirm the _source field shows 'firestore'.\n")
