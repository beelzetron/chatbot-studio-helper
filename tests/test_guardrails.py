"""
Enhanced tests for Study Helper Chatbot
"""
import pytest
from src.main import (
    check_school_context,
    enforce_no_solution_policy,
    NON_SCHOOL_PATTERNS,
    SCHOOL_SUBJECTS,
)


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
    
    def test_valid_history_question(self):
        """Valid history question."""
        message = "Spiegami la differenza tra Impero Romano d'Occidente e d'Oriente"
        is_valid, reason = check_school_context(message, "storia")
        assert is_valid is True
    
    def test_non_school_topic_money(self):
        """Should reject money-making topics."""
        message = "Come posso guadagnare soldi con le crypto?"
        is_valid, reason = check_school_context(message)
        assert is_valid is False
        assert "fuori dal contesto scolastico" in reason
    
    def test_non_school_topic_work(self):
        """Should reject work-related topics."""
        message = "Come si fa un lavoro freelance?"
        is_valid, reason = check_school_context(message)
        assert is_valid is False
    
    def test_copy_paste_homework(self):
        """Should reject direct homework copy-paste."""
        message = "Ecco il compito: [intero testo del compito da svolgere senza domande]"
        is_valid, reason = check_school_context(message)
        assert is_valid is False
    
    def test_invalid_subject_trading(self):
        """Should reject non-school subjects."""
        message = "Come si fa trading azionario?"
        is_valid, reason = check_school_context(message, "trading")
        assert is_valid is False
    
    def test_invalid_subject_gambling(self):
        """Should reject gambling topics."""
        message = "Qual è la strategia migliore per vincere al poker?"
        is_valid, reason = check_school_context(message)
        assert is_valid is False
    
    def test_valid_grammar_question(self):
        """Valid Italian grammar question."""
        message = "Come si usa il congiuntivo in italiano?"
        is_valid, reason = check_school_context(message, "italiano")
        assert is_valid is True
    
    def test_valid_geometry_question(self):
        """Valid geometry question."""
        message = "Come si calcola l'area di un triangolo?"
        is_valid, reason = check_school_context(message, "matematica")
        assert is_valid is True
    
    def test_valid_literature_question(self):
        """Valid literature question."""
        message = "Mi puoi spiegare i temi principali della Divina Commedia?"
        is_valid, reason = check_school_context(message, "letteratura")
        assert is_valid is True
    
    def test_reject_cheating_request(self):
        """Should reject requests to cheat."""
        message = "Come posso barare all'esame?"
        is_valid, reason = check_school_context(message)
        assert is_valid is False
    
    def test_reject_solution_request(self):
        """Should reject direct solution requests."""
        message = "Fammi il compito di matematica al posto mio"
        is_valid, reason = check_school_context(message)
        assert is_valid is False


class TestNoSolutionPolicy:
    """Test that system prompt enforces no-solution policy."""
    
    def test_system_prompt_includes_policy(self):
        """System prompt should contain no-solution instructions."""
        prompt = enforce_no_solution_policy("Help me with math")
        assert "NEVER provide complete solutions" in prompt
        assert "STUDY HELPER" in prompt
        assert "not a homework solver" in prompt
    
    def test_system_prompt_includes_user_request(self):
        """System prompt should include the user's actual request."""
        user_message = "Come si risolve x^2 + 5x + 6 = 0?"
        prompt = enforce_no_solution_policy(user_message)
        assert user_message in prompt
    
    def test_system_prompt_guidance(self):
        """System prompt should provide guidance on how to help."""
        prompt = enforce_no_solution_policy("test")
        assert "Provide clear explanations" in prompt
        assert "Give EXAMPLES" in prompt
        assert "Guide students" in prompt


class TestSubjectList:
    """Test the list of supported school subjects."""
    
    def test_primary_subjects_present(self):
        """All primary school subjects should be in the list."""
        assert "matematica" in SCHOOL_SUBJECTS
        assert "italiano" in SCHOOL_SUBJECTS
        assert "storia" in SCHOOL_SUBJECTS
        assert "scienze" in SCHOOL_SUBJECTS
    
    def test_secondary_subjects_present(self):
        """All secondary school subjects should be in the list."""
        assert "filosofia" in SCHOOL_SUBJECTS
        assert "latino" in SCHOOL_SUBJECTS
        assert "fisica" in SCHOOL_SUBJECTS
        assert "chimica" in SCHOOL_SUBJECTS
    
    def test_foreign_languages_present(self):
        """Foreign languages should be supported."""
        assert "inglese" in SCHOOL_SUBJECTS
        assert "francese" in SCHOOL_SUBJECTS
        assert "spagnolo" in SCHOOL_SUBJECTS
        assert "tedesco" in SCHOOL_SUBJECTS
