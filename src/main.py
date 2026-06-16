"""
Study Helper Chatbot
Non fornisce soluzioni, ma esempi e spiegazioni per aiutare nello studio.
Guardrail implementati per prevenire utilizzi impropri.
"""

import json
import logging
import os
import re
from typing import Any, AsyncIterator, Literal, Optional

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src import attachments
from src.attachments import validate_and_process_images

logger = logging.getLogger("study-helper")

app = FastAPI(
    title="Study Helper Chatbot",
    description="AI assistant that helps with homework by providing explanations and examples, NEVER solutions.",
    version="1.0.0",
)

# Configuration
LLM_ENDPOINT = os.getenv("LLM_ENDPOINT", "http://localhost:8000/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "local-model")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "60"))
AUTO_MODEL_PLACEHOLDERS = {"", "local-model"}
_AUTO_MODEL_CACHE: dict[str, str] = {}

DEFAULT_IMAGE_MESSAGE = "Aiutami a capire questo esercizio dall'immagine"
MAX_HISTORY_MESSAGES = 20
MAX_HISTORY_CONTENT_CHARS = 4000

# Safety guardrails
SCHOOL_SUBJECTS = [
    "matematica",
    "italiano",
    "storia",
    "geografia",
    "scienze",
    "fisica",
    "chimica",
    "biologia",
    "arte",
    "musica",
    "educazione fisica",
    "inglese",
    "francese",
    "spagnolo",
    "tedesco",
    "latino",
    "greco",
    "filosofia",
    "informatica",
    "tecnologia",
    "educazione civica",
    "matematica discreta",
    "statistica",
    "economia",
    "diritto",
    "letteratura",
    "mitologia",
]

PRIMARY_GRADE_TOPICS = [
    "tabelline",
    "addizione",
    "sottrazione",
    "moltiplicazione",
    "divisione",
    "frazioni",
    "percentuali",
    "geometria base",
    "lettura",
    "scrittura",
    "grammatica",
    "comprensione",
    "storia italiana",
    "storia mondiale",
    "geografia italia",
    "geografia mondo",
    "scienze naturali",
    "animali",
    "piante",
    "ciclo dell'acqua",
    "sistema solare",
]

SECONDARY_GRADE_TOPICS = [
    "algebra",
    "geometria avanzata",
    "trigonometria",
    "calcolo",
    "funzioni",
    "letteratura italiana",
    "letteratura mondiale",
    "storia antica",
    "storia moderna",
    "storia contemporanea",
    "filosofia",
    "biologia cellulare",
    "genetica",
    "chimica organica",
    "fisica meccanica",
    "fisica elettromagnetismo",
    "programmazione",
    "algoritmi",
    "strutture dati",
]

NON_SCHOOL_PATTERNS = [
    r"\b(lavoro|professionale|lavoro\s+condiviso|side\s+hustle)\b",
    r"\b(fare\s+i\s+soldi|guadagnare|investire|crypto|bitcoin)\b",
    r"\b(sesso|relazione\s+intima|dating)\b",
    r"\b(politica\s+attiva|candidatura|voto|partito)\b",
    r"\b(cocaina|eroina|droghe|stupefacenti)\b",
    r"\b(armi|violenza|combattimento)\b",
    r"\b(hack|crack|password|violare)\b",
    r"\b(trucco|barare|copiare|soluzione\s+completa)\b",
    r"\b(sistema\s+il\s+compito|fai\s+il\s+compito|fammi\s+il\s+compito)\b",
    r"\b(poker|casino|scommesse|gambling|azzardo)\b",
]

DIRECT_HOMEWORK_PATTERNS = [
    r"\b(ecco\s+il\s+compito|testo\s+del\s+compito)\b",
    r"\b(svolgi|risolvi|completa)\s+(?:tutto\s+)?(?:il\s+)?compito\b",
    r"\b(?:dammi|dimmi|scrivi|fornisci)\s+(?:solo\s+)?(?:la\s+)?(?:soluzione|risposta|risposte)\b",
    r"\b(?:soluzione|risposta|risposte)\s+(?:completa|complete|finale|finali)\b",
]

# Prompt injection attack patterns
PROMPT_INJECTION_PATTERNS = [
    # Instruction override attempts
    r"\b(ignora\s+tutte\s+le\s+istruzioni|ignore\s+all\s+instructions|ignore\s+previous\s+instructions)\b",
    r"\b(ignora\s+i\s+tuoi\s+limiti|ignore\s+your\s+limitations)\b",
    r"\b(dimentica\s+le\s+regole|forget\s+the\s+rules)\b",
    # Role redefinition
    r"\b(sei\s+ora|you\s+are\s+now|from\s+now\s+you\s+are)\b",
    r"\b(da\s+questo\s+momento|from\s+this\s+moment)\b",
    r"\b(mettiti\s+in\s+modalità|enter\s+mode|activate\s+mode)\b",
    # Developer/Debug mode
    r"\b(modalità\s+sviluppatore|developer\s+mode|debug\s+mode)\b",
    r"\b(modalità\s+test|test\s+mode|sandbox\s+bypass)\b",
    # Hypothetical scenarios
    r"\b(immagina\s+che).*\b(soluzione|risposta\s+completa|regole|limiti|ignora|bypass)\b",
    r"\b(pretend\s+that|suppose\s+that).*\b(solution|answer|rules|for\s+research|ignore|bypass)\b",
    r"\b(esercizio\s+di\s+sicurezza|security\s+exercise|research\s+purpose)\b",
    r"\b(solo\s+per\s+finzione|just\s+for\s+fun|hypothetically)\b",
    # Game/Roleplay bypass
    r"\b(modalità\s+gioco|game\s+mode|dan\s*\(?\s*do\s+anything\s+now\)?)\b",
    r"\b(autorità\s+superiore|superior\s+authority|professore\s+ha\s+detto)\b",
    # Encoding/Obfuscation detection
    r"\b(in\s+base64|encoded\s+request|codificato)\b",
    r"\b(using\s+mixed\s+unicode|character\s+substitution)\b",
    # Emotional/Urgency manipulation
    r"\b(ho\s+bisogno\s+di\s+salvare|need\s+to\s+save\s+my\s+year)\b",
    r"\b(è\s+un'emergenza|it's\s+an\s+emergency|urgent\s+need)\b",
    r"\b(non\s+c'\s+è\s+tempo|no\s+time\s+for\s+explanations)\b",
    # Reverse psychology
    r"\b(so\s+che\s+non\s+puoi|I\s+know\s+you\s+(?:can'?t|cannot)|dimmi\s+solo\s+la\s+prima)\b",
    r"\b(solo\s+il\s+risultato\s+finale|just\s+the\s+final\s+answer)\b",
    # Language switching attacks
    r"\b(please\s+ignore\s+your\s+rules|give\s+me\s+the\s+complete\s+(?:solution|answer))\b",
    r"\b(bypass\s+your\s+restrictions|override\s+your\s+filters)\b",
]

EDUCATIONAL_KEYWORDS = [
    "spiegami",
    "spiegare",
    "spiegazione",
    "aiutami a capire",
    "come si fa",
    "esempio",
    "esercizio",
    "non capisco",
    "non riesco",
    "guida",
    "metodo",
    "approccio",
    "come si risolve",
    "passaggi",
    "procedimento",
    "teoria",
    "dimmi come",
    "dall'immagine",
    "dalla foto",
    "in foto",
]

SCHOOL_CONTEXT_KEYWORDS = [
    "compito",
    "domanda",
    "quiz",
    "verifica",
    "interrogazione",
    "lezione",
    "studio",
    "classe",
    "professore",
    "maestra",
    "alunno",
    "studente",
    "rispondi",
    "risposta",
    "ragionamento",
    "repubblica",
    "impero",
    "romani",
    "roma",
]


class ChatResponse(BaseModel):
    response: str
    is_helpful: bool
    safety_violation: bool = False
    violation_reason: Optional[str] = None


class ClientDebugEvent(BaseModel):
    event: str
    session_id: Optional[str] = None
    url: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: Optional[str] = None
    details: dict[str, Any] = Field(default_factory=dict)


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


def _contains_any(text: str, values: list[str]) -> bool:
    return any(value in text for value in values)


def _looks_like_student_answer(message_lower: str) -> bool:
    numbered_answer = re.search(r"(?:^|\s)\d+\s*[:.)-]\s*\S+", message_lower)
    multiple_answer_markers = (
        len(re.findall(r"(?:^|\s)\d+\s*[:.)-]", message_lower)) >= 2
    )
    answer_words = re.search(
        r"\b(secondo\s+me|penso\s+che|perch[eé]|quindi)\b", message_lower
    )

    return bool(numbered_answer or multiple_answer_markers or answer_words)


def _looks_like_question(message_lower: str) -> bool:
    question_words = re.search(
        r"\b(come|cosa|che\s+cosa|perch[eé]|quando|dove|quale|quali|chi)\b",
        message_lower,
    )
    return "?" in message_lower or bool(question_words)


def _has_school_context(
    message_lower: str,
    subject: Optional[str] = None,
    history: Optional[list[ChatHistoryMessage]] = None,
) -> bool:
    all_school_topics = SCHOOL_SUBJECTS + PRIMARY_GRADE_TOPICS + SECONDARY_GRADE_TOPICS
    if subject and _contains_any(subject.lower(), all_school_topics):
        return True

    school_terms = all_school_topics + EDUCATIONAL_KEYWORDS + SCHOOL_CONTEXT_KEYWORDS
    if _contains_any(message_lower, school_terms):
        return True

    for history_message in (history or [])[-4:]:
        content_lower = history_message.content.lower()
        if _contains_any(content_lower, school_terms):
            return True

    return False


def check_school_context(
    message: str,
    subject: Optional[str] = None,
    has_images: bool = False,
    history: Optional[list[ChatHistoryMessage]] = None,
) -> tuple[bool, str]:
    """
    Verifica se la richiesta è in contesto scolastico.
    Returns: (is_valid, reason)
    """
    message_lower = message.lower().strip()

    # Check for prompt injection attacks
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, message_lower, re.IGNORECASE):
            return False, "Rilevato tentativo di prompt injection"

    # Check for non-school patterns
    for pattern in NON_SCHOOL_PATTERNS:
        if re.search(pattern, message_lower, re.IGNORECASE):
            return False, "Richiesta fuori dal contesto scolastico"

    for pattern in DIRECT_HOMEWORK_PATTERNS:
        if re.search(pattern, message_lower, re.IGNORECASE):
            return (
                False,
                "Per favore, chiedi spiegazioni o esempi invece di chiedere la soluzione",
            )

    # Check if subject is school-related
    if subject:
        subject_lower = subject.lower()
        all_school_topics = (
            SCHOOL_SUBJECTS + PRIMARY_GRADE_TOPICS + SECONDARY_GRADE_TOPICS
        )
        if not any(topic in subject_lower for topic in all_school_topics):
            return False, f"Materia '{subject}' non riconosciuta come scolastica"

    has_educational_intent = any(
        keyword in message_lower for keyword in EDUCATIONAL_KEYWORDS
    )
    has_school_context = _has_school_context(message_lower, subject, history)
    looks_like_student_answer = _looks_like_student_answer(message_lower)
    looks_like_question = _looks_like_question(message_lower)

    if has_images:
        return True, "Valid"

    if not message_lower:
        return False, "Inserisci una domanda o allega un'immagine del compito"

    if (
        not has_educational_intent
        and len(message) > 50
        and not (
            has_school_context and (looks_like_student_answer or looks_like_question)
        )
    ):
        return (
            False,
            "Per favore, chiedi spiegazioni o esempi invece di inviare direttamente il compito",
        )

    return True, "Valid"


def build_system_prompt(
    grade_level: Optional[str] = None,
    has_images: bool = False,
) -> str:
    """
    System prompt that enforces the no-solution policy.
    """
    grade_context = ""
    if grade_level == "primary":
        grade_context = (
            "The student is in primary school (scuola elementare, ages 6-11). "
            "Use simple language and age-appropriate examples.\n"
        )
    elif grade_level == "middle":
        grade_context = (
            "The student is in middle school (scuola media, ages 11-14). "
            "Use clear language with intermediate terminology.\n"
        )
    elif grade_level == "secondary":
        grade_context = (
            "The student is in secondary school (scuola superiore, ages 14-19). "
            "You can use more advanced terminology.\n"
        )

    vision_context = ""
    if has_images:
        vision_context = """
When the student shares an image of homework:
- Identify the topic and concepts shown, but do NOT transcribe or solve the exact exercise in the image
- Explain the underlying method and provide a SIMILAR example with different numbers or content
- Guide the student to apply the method to their own exercise step by step
"""

    return f"""You are a STUDY HELPER, not a homework solver. Your role is to:
- Provide clear explanations of concepts
- Give EXAMPLES that illustrate the method
- Guide students through the thinking process
- Offer similar practice problems

NEVER do these:
- NEVER provide complete solutions to homework problems
- NEVER do the actual assignment for the student
- NEVER give final answers without explanation
- NEVER bypass the learning process
{vision_context}
When a student asks for help:
1. Explain the underlying concept
2. Show a SIMILAR example with different numbers/content
3. Guide them to apply the method themselves
4. Offer to check their work and provide feedback

IMPORTANT: If the request asks for a direct solution, politely explain that you help with learning, \
not doing homework. Say something like: "I can't provide the direct answer, but I can explain the \
concept and show you an example that will help you solve it yourself."

{grade_context}Respond in Italian unless the student writes in another language."""


def build_user_content(
    user_message: str, images: list[attachments.ProcessedImage]
) -> str | list:
    """Build OpenAI-compatible user message content (text or multimodal)."""
    if not images:
        return user_message

    content: list = [{"type": "text", "text": user_message}]
    for image in images:
        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{image.mime_type};base64,{image.base64_data}"
                },
            }
        )
    return content


def build_llm_payload(
    system_prompt: str,
    user_message: str,
    model_id: str,
    images: Optional[list[attachments.ProcessedImage]] = None,
    history: Optional[list[ChatHistoryMessage]] = None,
    *,
    stream: bool = False,
) -> dict:
    user_content = build_user_content(user_message, images or [])
    messages: list[dict[str, object]] = [{"role": "system", "content": system_prompt}]
    messages.extend(
        {"role": message.role, "content": message.content}
        for message in (history or [])
    )
    messages.append({"role": "user", "content": user_content})

    payload = {
        "model": model_id,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1000,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    if stream:
        payload["stream"] = True
    return payload


SAFETY_VIOLATION_MESSAGE = (
    "Mi dispiace, ma posso aiutarti solo con domande relative allo studio e ai compiti scolastici. "
    "Posso spiegarti concetti, fare esempi e guidarti nel ragionamento, "
    "ma non posso svolgere i compiti al posto tuo."
)


def sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _configured_llm_model() -> str:
    return (LLM_MODEL or "").strip()


def _extract_model_ids(models_payload: object) -> list[str]:
    if not isinstance(models_payload, dict):
        return []

    models = models_payload.get("data")
    if not isinstance(models, list):
        return []

    model_ids: list[str] = []
    for model in models:
        if not isinstance(model, dict):
            continue
        model_id = model.get("id")
        if isinstance(model_id, str) and model_id.strip():
            model_ids.append(model_id.strip())
    return model_ids


def parse_chat_history(history: Optional[str]) -> list[ChatHistoryMessage]:
    if not history:
        return []

    try:
        raw_history = json.loads(history)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="Cronologia chat non valida"
        ) from exc

    if not isinstance(raw_history, list):
        raise HTTPException(status_code=400, detail="Cronologia chat non valida")

    parsed: list[ChatHistoryMessage] = []
    for item in raw_history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")
        if role not in {"user", "assistant"} or not isinstance(content, str):
            continue

        content = content.strip()
        if not content:
            continue

        parsed.append(
            ChatHistoryMessage(
                role=role,
                content=content[:MAX_HISTORY_CONTENT_CHARS],
            )
        )

    return parsed


async def resolve_llm_model(client: httpx.AsyncClient) -> str:
    """Return the explicit model or auto-detect the sole model exposed by the LLM server."""
    configured_model = _configured_llm_model()
    if configured_model not in AUTO_MODEL_PLACEHOLDERS:
        return configured_model

    if LLM_ENDPOINT in _AUTO_MODEL_CACHE:
        return _AUTO_MODEL_CACHE[LLM_ENDPOINT]

    try:
        response = await client.get(f"{LLM_ENDPOINT}/models")
        response.raise_for_status()
        model_ids = _extract_model_ids(response.json())
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to auto-detect LLM model from /models: {str(exc)}",
        ) from exc

    if len(model_ids) != 1:
        raise HTTPException(
            status_code=503,
            detail=(
                "Unable to auto-detect LLM model: configure LLM_MODEL when "
                "the LLM server exposes zero or multiple models"
            ),
        )

    _AUTO_MODEL_CACHE[LLM_ENDPOINT] = model_ids[0]
    return model_ids[0]


async def stream_llm(
    system_prompt: str,
    user_message: str,
    images: Optional[list[attachments.ProcessedImage]] = None,
    history: Optional[list[ChatHistoryMessage]] = None,
) -> AsyncIterator[str]:
    """Stream text tokens from the local OpenAI-compatible LLM."""
    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            model_id = await resolve_llm_model(client)
            payload = build_llm_payload(
                system_prompt, user_message, model_id, images, history, stream=True
            )
            async with client.stream(
                "POST",
                f"{LLM_ENDPOINT}/chat/completions",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        yield content
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=503, detail=f"LLM service unavailable: {str(e)}"
        )


async def call_llm(
    system_prompt: str,
    user_message: str,
    images: Optional[list[attachments.ProcessedImage]] = None,
    history: Optional[list[ChatHistoryMessage]] = None,
) -> str:
    """
    Chiamata all'LLM locale via API compatibile OpenAI.
    """
    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            model_id = await resolve_llm_model(client)
            response = await client.post(
                f"{LLM_ENDPOINT}/chat/completions",
                json=build_llm_payload(
                    system_prompt,
                    user_message,
                    model_id,
                    images,
                    history,
                ),
            )
            response.raise_for_status()
            data = response.json()
            choices = data.get("choices")
            if not choices:
                raise HTTPException(
                    status_code=502, detail="Invalid LLM response: no choices"
                )
            return choices[0]["message"]["content"]
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=503, detail=f"LLM service unavailable: {str(e)}"
        )


async def prepare_chat_request(
    message: str,
    subject: Optional[str],
    images: list[UploadFile],
    history: Optional[list[ChatHistoryMessage]] = None,
) -> tuple[str, bool, list[attachments.ProcessedImage], tuple[bool, str]]:
    processed_images = await validate_and_process_images(images)
    has_images = len(processed_images) > 0

    user_message = message.strip()
    if not user_message and has_images:
        user_message = DEFAULT_IMAGE_MESSAGE

    if not user_message and not has_images:
        raise HTTPException(status_code=400, detail="Messaggio o immagine richiesti")

    is_valid, reason = check_school_context(
        user_message, subject, has_images=has_images, history=history
    )
    return user_message, has_images, processed_images, (is_valid, reason)


@app.post("/chat", response_model=ChatResponse)
async def chat(
    message: str = Form(""),
    subject: Optional[str] = Form(None),
    grade_level: Optional[str] = Form(None),
    history: Optional[str] = Form(None),
    images: list[UploadFile] = File(default=[]),
):
    """
    Main chat endpoint with safety guardrails. Accepts multipart form data with optional images.
    """
    chat_history = parse_chat_history(history)
    user_message, has_images, processed_images, (is_valid, reason) = (
        await prepare_chat_request(message, subject, images, chat_history)
    )

    if not is_valid:
        return ChatResponse(
            response=SAFETY_VIOLATION_MESSAGE,
            is_helpful=False,
            safety_violation=True,
            violation_reason=reason,
        )

    system_prompt = build_system_prompt(grade_level, has_images=has_images)
    response_text = await call_llm(
        system_prompt, user_message, processed_images, chat_history
    )

    return ChatResponse(
        response=response_text,
        is_helpful=True,
    )


@app.post("/chat/stream")
async def chat_stream(
    message: str = Form(""),
    subject: Optional[str] = Form(None),
    grade_level: Optional[str] = Form(None),
    history: Optional[str] = Form(None),
    images: list[UploadFile] = File(default=[]),
):
    """Stream chat response tokens via Server-Sent Events."""
    user_message, has_images, processed_images, (is_valid, reason) = (
        await prepare_chat_request(message, subject, images)
    )
    chat_history = parse_chat_history(history)

    async def event_generator() -> AsyncIterator[str]:
        if not is_valid:
            yield sse_event({"type": "token", "content": SAFETY_VIOLATION_MESSAGE})
            yield sse_event(
                {
                    "type": "done",
                    "is_helpful": False,
                    "safety_violation": True,
                    "violation_reason": reason,
                }
            )
            return

        system_prompt = build_system_prompt(grade_level, has_images=has_images)
        try:
            async for token in stream_llm(
                system_prompt, user_message, processed_images, chat_history
            ):
                yield sse_event({"type": "token", "content": token})
            yield sse_event({"type": "done", "is_helpful": True})
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            yield sse_event({"type": "error", "detail": detail})
        except httpx.HTTPError as exc:
            yield sse_event(
                {"type": "error", "detail": f"LLM service unavailable: {str(exc)}"}
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "study-helper-chatbot"}


@app.post("/debug/client-event")
async def client_debug_event(event: ClientDebugEvent):
    """Log browser-side breadcrumbs for diagnosing device-specific crashes."""
    logger.warning(
        "client_debug event=%s session=%s url=%s user_agent=%s details=%s",
        event.event,
        event.session_id,
        event.url,
        event.user_agent,
        event.details,
    )
    return {"ok": True}


@app.get("/debug/client-event")
async def client_debug_event_get(
    event: str = Query(...),
    session_id: Optional[str] = Query(None),
    details: Optional[str] = Query(None),
):
    """GET-based debug breadcrumb for old browsers where sendBeacon is unreliable."""
    logger.warning(
        "client_debug_get event=%s session=%s details=%s",
        event,
        session_id,
        details,
    )
    return {"ok": True}


@app.get("/info")
async def info():
    """Service information."""
    return {
        "name": "Study Helper Chatbot",
        "version": "1.0.0",
        "description": "AI assistant for homework help - provides explanations and examples, never solutions",
        "guardrails": [
            "No complete homework solutions",
            "School context only",
            "Primary, middle, and secondary education subjects",
            "Explanations and examples only",
            "Homework images processed in memory only, never stored",
        ],
        "uploads": {
            "max_images": int(os.getenv("MAX_IMAGE_COUNT", "3")),
            "max_bytes_per_image": int(
                os.getenv("MAX_IMAGE_BYTES", str(5 * 1024 * 1024))
            ),
            "max_pixels_per_image": attachments.MAX_IMAGE_PIXELS,
            "allowed_types": ["image/jpeg", "image/png", "image/webp"],
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
