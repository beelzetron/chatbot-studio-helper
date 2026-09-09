"""Tests for optional API-key auth on the LLM and judge endpoints."""
import json

import httpx
import pytest

import src.main as main
from src.main import _auth_headers, call_llm, judge_request


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class TestAuthHeaders:
    def test_empty_key_means_no_header(self):
        assert _auth_headers("") == {}
        assert _auth_headers("   ") == {}

    def test_key_becomes_bearer_header(self):
        headers = _auth_headers("sk-test-123")
        assert headers == {"Authorization": "Bearer sk-test-123"}


@pytest.mark.anyio
class TestMainLlmAuth:
    @pytest.fixture
    def transport_capturing(self, monkeypatch):
        """Patch only the transport so get_llm_client() runs its real
        constructor logic (including auth headers from LLM_API_KEY)."""
        captured: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return httpx.Response(
                200, json={"choices": [{"message": {"content": "ok"}}]}
            )

        class TransportedClient(httpx.AsyncClient):
            def __init__(self, *args, **kwargs):
                kwargs["transport"] = httpx.MockTransport(handler)
                super().__init__(*args, **kwargs)

        monkeypatch.setattr(main.httpx, "AsyncClient", TransportedClient)
        monkeypatch.setattr(main, "_llm_client", None)
        return captured

    async def test_api_key_sent_as_bearer(self, monkeypatch, transport_capturing):
        monkeypatch.setattr(main, "LLM_API_KEY", "sk-secret-main")

        result = await call_llm("system", "user msg")
        assert result == "ok"
        assert transport_capturing[0].headers["authorization"] == "Bearer sk-secret-main"

    async def test_no_api_key_means_no_auth_header(self, monkeypatch, transport_capturing):
        monkeypatch.setattr(main, "LLM_API_KEY", "")

        await call_llm("system", "user msg")
        assert "authorization" not in transport_capturing[0].headers


@pytest.mark.anyio
class TestJudgeAuth:
    @pytest.fixture
    def judge_transport_capturing(self, monkeypatch):
        """Same trick for the judge: keep its real constructor, swap transport."""
        captured: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            verdict = {"school_related": True, "requests_solution": False,
                       "category": "study_help"}
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": json.dumps(verdict)}}]},
            )

        class TransportedClient(httpx.AsyncClient):
            def __init__(self, *args, **kwargs):
                kwargs["transport"] = httpx.MockTransport(handler)
                super().__init__(*args, **kwargs)

        monkeypatch.setattr(main.httpx, "AsyncClient", TransportedClient)
        monkeypatch.setattr(main, "_judge_client", None)
        monkeypatch.setattr(main, "JUDGE_LLM_ENDPOINT", "http://judge.test/v1")
        return captured

    async def test_judge_api_key_sent_as_bearer(self, monkeypatch, judge_transport_capturing):
        monkeypatch.setattr(main, "JUDGE_LLM_API_KEY", "sk-secret-judge")

        is_valid, _ = await judge_request("Spiegami le frazioni")
        assert is_valid is True
        assert (
            judge_transport_capturing[0].headers["authorization"]
            == "Bearer sk-secret-judge"
        )

    async def test_judge_without_key_sends_no_auth_header(self, monkeypatch, judge_transport_capturing):
        monkeypatch.setattr(main, "JUDGE_LLM_API_KEY", "")

        await judge_request("Spiegami le frazioni")
        assert "authorization" not in judge_transport_capturing[0].headers
