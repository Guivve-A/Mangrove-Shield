from score import compute_priority_score


def test_priority_score_balanced_case() -> None:
    score = compute_priority_score(0.8, 0.7, 0.5)
    assert score == 0.705


def test_priority_score_clamped_range() -> None:
    assert compute_priority_score(3.0, 2.0, -1.0) == 1.0
    assert compute_priority_score(-2.0, -1.0, 3.0) == 0.0
