"""
Basic tests for Study Helper Chatbot
"""
import pytest
from src.main import check_school_context, enforce_no_solution_policy


class TestSchoolContextValidation:
    """Test school context validation guardrails."""
    
    def test_valid_math_question(self):
        """Valid math homework help request."""
        message = "Mi aiuti a capire come si risolve questa equazione di secondo grado?"
        is_valid, reason = check_school_context(message, "matematica")
        assert is_valid is True
        assert reason == "Valid"
    
    def test_valid_science_question(self):
        """Valid science question."""
        message = "Posso avere un esempio sul ciclo dell'acqua per le elementari?"
        is_valid, reason = check_school_context(message, "scienze")
        assert is_valid is True
    
    def test_non_school_topic(self):
        """Should reject non-school topics."""
        message = "Come posso guadagnare soldi con le crypto?"
        is_valid, reason = check_school_context(message)
        assert is_valid is False
        assert "fuori dal contesto scolastico" in reason
    
    def test_copy_paste_homework(self):
        """Should reject direct homework copy-paste."""
        message = "Ecco il compito: [intero testo del compito da svolgere senza domande]"
        is_valid, reason = check_school_context(message)
        assert is_valid is False
    
    def test_invalid_subject(self):
        """Should reject non-school subjects."""
        message = "Come si fa trading azionario?"
        is_valid, reason = check_school_context(message, "trading")
        assert is_valid is False


class TestNoSolutionPolicy:
    """Test that system prompt enforces no-solution policy."""
    
    def test_system_prompt_includes_policy(self):
        """System prompt should contain no-solution instructions."""
        prompt = enforce_no_solution_policy("Help me with math")
        assert "NEVER provide complete solutions" in prompt
        assert "STUDY HELPER" in prompt
        assert "not a homework solver" in prompt
