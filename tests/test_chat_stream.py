"""Tests for the /chat/stream SSE endpoint."""
import json

import httpx
import pytest

from src.main import SAFETY_VIOLATION_MESSAGE, app


def _sse_events(text: str) -> list[dict]:
    """Parse the SSE body into a list of event dicts."""
    events = []
    for chunk in text.split("\n\n"):
        chunk = chunk.strip()
        if not chunk.startswith("data: "):
            continue
        events.append(json.loads(chunk[len("data: "):]))
    return events


def _sse_tokens(text: str) -> list[str]:
    return [
        event["content"]
        for event in _sse_events(text)
        if event.get("type") == "token"
    ]


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def llm_transport(monkeypatch):
    """Install a fake LLM at the httpx.AsyncClient level.

    The app creates its own httpx.AsyncClient, so patching that class is
    the only way to intercept the outbound LLM call in-process.
    """
    state = {"mode": "ok", "last_payload": None}

    def handler(request: httpx.Request) -> httpx.Response:
        if not request.content:
            return httpx.Response(500, text="empty request body")

        payload = json.loads(request.content.decode())
        state["last_payload"] = payload
        is_stream = bool(payload.get("stream"))

        def sse_lines() -> str:
            lines = [
                'data: {"choices":[{"delta":{"content":"on"}}]}',
                'data: {"choices":[{"delta":{"content":"ta"}}]}',
                'data: {"choices":[]}',
                'data: {"choices":[{"delta":{"content":"!"}}]}',
                'data: [DONE]',
            ]
            return "\n".join(lines) + "\n"

        if state["mode"] == "ok":
            if is_stream:
                return httpx.Response(200, content=sse_lines().encode())
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": "onta!"}}]},
            )
        return httpx.Response(500, text="boom")

    fake_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr("src.main._llm_client", fake_client)
    return state


@pytest.mark.anyio
class TestChatStream:
    async def _post(self, llm_transport, **form):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/chat/stream",
                data={"message": form.get("message", ""), **form},
            )
        return response

    async def test_stream_happy_path(self, llm_transport):
        response = await self._post(llm_transport, message="Spiegami le frazioni")

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers["x-accel-buffering"] == "no"

        tokens = _sse_tokens(response.text)
        assert tokens == ["on", "ta", "!"]

        events = _sse_events(response.text)
        assert events[-1] == {"type": "done", "is_helpful": True}

    async def test_stream_violation_short_circuits_llm(self, llm_transport):
        llm_transport["mode"] = "error"
        response = await self._post(
            llm_transport, message="Come posso guadagnare soldi con le crypto?"
        )

        assert response.status_code == 200  # SSE endpoint never 4xx/5xx's
        events = _sse_events(response.text)
        assert events[0]["type"] == "token"
        assert events[0]["content"] == SAFETY_VIOLATION_MESSAGE
        assert events[1]["type"] == "done"
        assert events[1]["safety_violation"] is True
        assert "fuori dal contesto scolastico" in events[1]["violation_reason"]

    async def test_stream_empty_message_rejected(self, llm_transport):
        response = await self._post(llm_transport, message="")
        assert response.status_code == 400
        assert "Messaggio o immagine richiesti" in response.json()["detail"]

    async def test_stream_llm_error_surfaced_as_sse_error_event(self, llm_transport):
        llm_transport["mode"] = "error"
        response = await self._post(llm_transport, message="Spiegami il teorema di Pitagora")

        assert response.status_code == 200
        events = _sse_events(response.text)
        assert events[-1]["type"] == "error"
        assert "LLM service unavailable" in events[-1]["detail"]

    async def test_stream_sends_system_prompt_and_user_message(self, llm_transport):
        await self._post(llm_transport, message="Spiegami le frazioni")

        payload = llm_transport["last_payload"]
        roles = [m["role"] for m in payload["messages"]]
        assert roles == ["system", "user"]
        assert "NEVER provide complete solutions" in payload["messages"][0]["content"]
        assert payload["messages"][1]["content"] == "Spiegami le frazioni"
        assert payload["stream"] is True
