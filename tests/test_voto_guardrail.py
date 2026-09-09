"""Regression tests for the 'voto' false positive in NON_SCHOOL_PATTERNS.

'voto' alone is a normal school word; only clearly political/electoral
contexts should be rejected.
"""
from src.main import check_school_context


class TestVotoNotFalsePositive:
    def test_school_grade_word_is_allowed(self):
        message = "Spiegami come si calcola la media dei voti in matematica"
        is_valid, reason = check_school_context(message, "matematica")
        assert is_valid is True
        assert reason == "Valid"

    def test_political_election_words_are_rejected(self):
        for message in [
            "Mi spieghi come funzionano le elezioni e la candidatura al parlamento?",
            "Fammi un tema sul partito politico di fase del gioco",
        ]:
            is_valid, _ = check_school_context(message)
            assert is_valid is False
