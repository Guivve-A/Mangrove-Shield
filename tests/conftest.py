from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / 'api'
PIPELINE_ROOT = ROOT / 'pipeline'

for candidate in [API_ROOT, PIPELINE_ROOT]:
    if str(candidate) not in sys.path:
        sys.path.insert(0, str(candidate))
