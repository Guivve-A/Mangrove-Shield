from main import _classify_trend, _normalize_score, compute_risk_assessment


def test_normalize_score_clamps_range() -> None:
    assert _normalize_score(0, 1, 5) == 0.0
    assert _normalize_score(3, 1, 5) == 0.5
    assert _normalize_score(10, 1, 5) == 1.0


def test_classify_trend_uses_sensible_delta_bands() -> None:
    assert _classify_trend(None) == "stable"
    assert _classify_trend(0.05) == "improving"
    assert _classify_trend(-0.05) == "declining"
    assert _classify_trend(0.01) == "stable"


def test_risk_assessment_combines_available_signals() -> None:
    weather = {"rain_mm": 22.0, "error": None}
    tide = {"level_m": 1.4, "error": None}
    sar = {"flood_anomaly_fraction": 0.09, "error": None}
    health = {"health_index": 0.38, "anomaly_zscore": -1.8, "error": None}

    result = compute_risk_assessment(weather, tide, sar, health)

    assert result["level"] == "CRITICAL"
    assert result["score"] is not None
    assert result["score"] >= 70
    assert result["confidence"] == 1.0
    assert result["drivers"][0]["key"] in {"sar", "ecosystem", "rain", "tide"}


def test_risk_assessment_degrades_gracefully_when_only_partial_data_exists() -> None:
    weather = {"rain_mm": None, "error": "AWAITING_TRIGGER"}
    tide = {"level_m": None, "error": "AWAITING_TRIGGER"}
    sar = {"flood_anomaly_fraction": 0.02, "error": None}
    health = {"health_index": 0.5, "anomaly_zscore": 0.3, "error": None}

    result = compute_risk_assessment(weather, tide, sar, health)

    assert result["level"] in {"NORMAL", "WARNING", "CRITICAL"}
    assert result["score"] is not None
    assert result["confidence"] == 0.55
