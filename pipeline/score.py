from __future__ import annotations


def compute_priority_score(
    flood_likelihood: float,
    exposure: float,
    mangrove_health: float,
) -> float:
    """Weighted risk score in [0,1], where higher is more urgent."""
    score = (0.45 * flood_likelihood) + (0.35 * exposure) + (0.2 * (1.0 - mangrove_health))
    return max(0.0, min(1.0, round(score, 4)))
