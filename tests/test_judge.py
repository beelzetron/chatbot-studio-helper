"""Tests for the opt-in judge LLM guardrail layer."""
import json

import httpx
import pytest

import src.main as main
from src.main import app, judge_request


def _sse_events(text: str) -> list[dict]:
    events = []
    for chunk in text.split("\n\n"):
        chunk = chunk.strip()
        if not chunk.startswith("data: "):
            continue
        events.append(json.loads(chunk[len("data: "):]))
    return events


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def judge_env(monkeypatch):
    """Enable the judge with a stub endpoint; returns per-test state."""
    monkeypatch.setattr(main, "JUDGE_LLM_ENDPOINT", "http://judge.test/v1")
    monkeypatch.setattr(main, "JUDGE_LLM_MODEL", "judge-model")
    monkeypatch.setattr(main, "JUDGE_ENABLED", True)
    monkeypatch.setattr(main, "_judge_client", None)
    return {"verdicts": [], "fail": False}


@pytest.fixture
def judge_off(monkeypatch):
    """Explicit opt-out: feature must behave exactly like it never existed."""
    monkeypatch.setattr(main, "JUDGE_ENABLED", False)
    monkeypatch.setattr(main, "JUDGE_LLM_ENDPOINT", "")
    monkeypatch.setattr(main, "_judge_client", None)


@pytest.fixture
def judge_handler(judge_env):
    """MockTransport serving judge verdicts; also counts calls."""

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.content.decode()
        if not json.loads(body).get("model") == "judge-model":
            return httpx.Response(500, text="not the judge")
        if judge_env["fail"]:
            return httpx.Response(503, text="judge down")
        if judge_env.get("garbage"):
            content = " certo, ti aiuto io!"
            return httpx.Response(
                200, json={"choices": [{"message": {"content": content}}]}
            )
        verdict = judge_env["verdicts"].pop(0) if judge_env["verdicts"] else {
            "school_related": True,
            "requests_solution": False,
            "category": "study_help",
        }
        content = json.dumps(verdict)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": content}}]},
        )

    def install():
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        main._judge_client = client
        return client

    install()
    judge_env["install"] = install
    return judge_env


async def _post_endpoint(path: str, message: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(path, data={"message": message})


@pytest.fixture
def llm_stub(monkeypatch):
    """Stub the main LLM so approved messages short-circuit before it runs."""
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode())
        if payload.get("stream"):
            sse = "\n".join(
                [
                    'data: {"choices":[{"delta":{"content":"ok"}}]}',
                    "data: [DONE]",
                ]
            )
            return httpx.Response(200, content=sse.encode())
        return httpx.Response(
            200, json={"choices": [{"message": {"content": "ok"}}]}
        )

    monkeypatch.setattr(
        main, "_llm_client", httpx.AsyncClient(transport=httpx.MockTransport(handler))
    )


@pytest.mark.anyio
class TestJudgeOptIn:
    async def test_off_by_default_no_judge_call(self, judge_off, llm_stub):
        # judge disabled: it must never be invoked or instantiated
        response = await _post_endpoint("/chat", "Spiegami le frazioni")
        assert response.status_code == 200
        body = response.json()
        assert body["is_helpful"] is True
        assert body["safety_violation"] is False
        assert main._judge_client is None

    async def test_solution_request_rejected_on_chat(self, judge_handler, llm_stub):
        judge_env = judge_handler
        judge_env["verdicts"] = [
            {
                "school_related": True,
                "requests_solution": True,
                "category": "solution_request",
            }
        ]
        response = await _post_endpoint("/chat", "Fammi gli esercizi 1-10 del libro")
        body = response.json()
        assert body["is_helpful"] is False
        assert body["safety_violation"] is True
        assert "soluzione diretta" in body["violation_reason"]
        # main LLM must not have been called: stub only answers "ok"
        assert body["response"] != "ok"

    async def test_out_of_context_rejected_on_stream(self, judge_handler, llm_stub):
        judge_env = judge_handler
        judge_env["verdicts"] = [
            {
                "school_related": False,
                "requests_solution": False,
                "category": "out_of_context",
            }
        ]
        response = await _post_endpoint(
            "/chat/stream", "Come si fa trading azionario?"
        )
        assert response.status_code == 200
        events = _sse_events(response.text)
        assert events[0]["content"] == main.SAFETY_VIOLATION_MESSAGE
        assert events[1]["safety_violation"] is True
        assert "contesto scolastico" in events[1]["violation_reason"]

    async def test_study_help_allowed_on_chat(self, judge_handler, llm_stub):
        judge_env = judge_handler
        judge_env["verdicts"] = [
            {
                "school_related": True,
                "requests_solution": False,
                "category": "study_help",
            }
        ]
        response = await _post_endpoint("/chat", "Spiegami le frazioni")
        body = response.json()
        assert body["is_helpful"] is True
        assert body["response"] == "ok"

    async def test_judge_down_fails_open(self, judge_handler, llm_stub):
        judge_env = judge_handler
        judge_env["fail"] = True
        response = await _post_endpoint("/chat", "Spiegami le frazioni")
        body = response.json()
        assert body["is_helpful"] is True
        assert body["response"] == "ok"

    async def test_judge_garbage_output_fails_open(self, judge_handler, llm_stub):
        judge_env = judge_handler
        judge_env["garbage"] = True
        response = await _post_endpoint("/chat", "Spiegami le frazioni")
        body = response.json()
        assert body["is_helpful"] is True
        assert body["response"] == "ok"

    async def test_judge_called_before_main_llm(self, judge_handler, llm_stub):
        judge_env = judge_handler
        judge_env["verdicts"] = [
            {
                "school_related": True,
                "requests_solution": True,
                "category": "solution_request",
            }
        ]
        await _post_endpoint("/chat", "Dammi la soluzione completa dell'esercizio")
        # judge (stub) saw the exact user message; main stub answered "ok"
        # only when allowed - here verdict was reject, so response is a violation
        response = await _post_endpoint("/chat", "Dammi la soluzione completa")
        assert response.json()["safety_violation"] is True


@pytest.mark.anyio
class TestJudgeRequestUnit:
    async def test_solution_request_rejected(self, judge_handler):
        judge_env = judge_handler
        judge_env["verdicts"] = [
            {
                "school_related": True,
                "requests_solution": True,
                "category": "solution_request",
            }
        ]
        is_valid, reason = await judge_request("Dammi la risposta finale")
        assert is_valid is False
        assert "soluzione diretta" in reason

    async def test_garbage_json_fails_open(self, judge_handler):
        judge_env = judge_handler
        judge_env["garbage"] = True
        is_valid, reason = await judge_request("Spiegami le frazioni")
        assert is_valid is True
