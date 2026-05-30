"""
Study Helper Chatbot
Non fornisce soluzioni, ma esempi e spiegazioni per aiutare nello studio.
Guardrail implementati per prevenire utilizzi impropri.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import re
import os

app = FastAPI(
    title="Study Helper Chatbot",
    description="AI assistant that helps with homework by providing explanations and examples, NEVER solutions.",
    version="1.0.0"
)

# Configuration
LLM_ENDPOINT = os.getenv("LLM_ENDPOINT", "http://192.168.11.36:8000/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "local-model")

# Safety guardrails
SCHOOL_SUBJECTS = [
    "matematica", "italiano", "storia", "geografia", "scienze", "fisica",
    "chimica", "biologia", "arte", "musica", "educazione fisica", "inglese",
    "francese", "spagnolo", "tedesco", "latino", "greco", "filosofia",
    "informatica", "tecnologia", "educazione civica", "matematica discreta",
    "statistica", "economia", "diritto", "letteratura", "mitologia"
]

PRIMARY_GRADE_TOPICS = [
    "tabelline", "addizione", "sottrazione", "moltiplicazione", "divisione",
    "frazioni", "percentuali", "geometria base", "lettura", "scrittura",
    "grammatica", "comprensione", "storia italiana", "storia mondiale",
    "geografia italia", "geografia mondo", "scienze naturali", "animali",
    "piante", "ciclo dell'acqua", "sistema solare"
]

SECONDARY_GRADE_TOPICS = [
    "algebra", "geometria avanzata", "trigonometria", "calcolo", "funzioni",
    "letteratura italiana", "letteratura mondiale", "storia antica",
    "storia moderna", "storia contemporanea", "filosofia", "biologia cellulare",
    "genetica", "chimica organica", "fisica meccanica", "fisica elettromagnetismo",
    "programmazione", "algoritmi", "strutture dati"
]

NON_SCHOOL_PATTERNS = [
    r"(lavoro|professionale|lavoro\s+condiviso|side\s+hustle)",
    r"(fare\s+i\s+soldi|guadagnare|investire|crypto|bitcoin)",
    r"(sesso|relazione\s+intima|dating)",
    r"(politica\s+attiva|candidatura|voto|partito)",
    r"(cocaina|eroina|droghe|stupefacenti)",
    r"(armi|violenza|combattimento)",
    r"(hack|crack|password|violare)",
    r"(trucco|barare|copiare|soluzione\s+completa)",
    r"(sistema\s+il\s+compito|fai\s+il\s+compito)"
]

class ChatRequest(BaseModel):
    message: str
    subject: str = None
    grade_level: str = None  # primary, secondary

class ChatResponse(BaseModel):
    response: str
    is_helpful: bool
    safety_violation: bool = False
    violation_reason: str = None


def check_school_context(message: str, subject: str = None) -> tuple[bool, str]:
    """
    Verifica se la richiesta è in contesto scolastico.
    Returns: (is_valid, reason)
    """
    message_lower = message.lower()
    
    # Check for non-school patterns
    for pattern in NON_SCHOOL_PATTERNS:
        if re.search(pattern, message_lower):
            return False, "Richiesta fuori dal contesto scolastico"
    
    # Check if subject is school-related
    if subject:
        subject_lower = subject.lower()
        all_school_topics = SCHOOL_SUBJECTS + PRIMARY_GRADE_TOPICS + SECONDARY_GRADE_TOPICS
        if not any(topic in subject_lower for topic in all_school_topics):
            return False, f"Materia '{subject}' non riconosciuta come scolastica"
    
    # Verify the message contains educational intent
    educational_keywords = [
        "spiegami", "aiutami a capire", "come si fa", "esempio", "esercizio",
        "non capisco", "non riesco", "guida", "metodo", "approccio",
        "come si risolve", "passaggi", "procedimento", "teoria"
    ]
    
    has_educational_intent = any(keyword in message_lower for keyword in educational_keywords)
    
    if not has_educational_intent and len(message) > 50:
        # Long messages without educational keywords might be copy-paste of assignment
        return False, "Per favore, chiedi spiegazioni o esempi invece di inviare direttamente il compito"
    
    return True, "Valid"


def enforce_no_solution_policy(message: str) -> str:
    """
    Aggiunge un system prompt che impone il divieto di fornire soluzioni complete.
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

When a student asks for help:
1. Explain the underlying concept
2. Show a SIMILAR example with different numbers/content
3. Guide them to apply the method themselves
4. Offer to check their work and provide feedback

IMPORTANT: If the request asks for a direct solution, politely explain that you help with learning, not doing homework. Say something like: "I can't provide the direct answer, but I can explain the concept and show you an example that will help you solve it yourself."

Student's request: {message}"""


async def call_llm(system_prompt: str, user_message: str) -> str:
    """
    Chiamata all'LLM locale via API compatibile OpenAI.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{LLM_ENDPOINT}/chat/completions",
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1000
                }
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"LLM service unavailable: {str(e)}")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint with safety guardrails.
    """
    # Safety check 1: School context validation
    is_valid, reason = check_school_context(request.message, request.subject)
    
    if not is_valid:
        return ChatResponse(
            response="Mi dispiace, ma posso aiutarti solo con domande relative allo studio e ai compiti scolastici. Posso spiegarti concetti, fare esempi e guidarti nel ragionamento, ma non posso svolgere i compiti al posto tuo.",
            is_helpful=False,
            safety_violation=True,
            violation_reason=reason
        )
    
    # Safety check 2: Enforce no-solution policy via system prompt
    system_prompt = enforce_no_solution_policy(request.message)
    
    # Call LLM
    response_text = await call_llm(system_prompt, request.message)
    
    return ChatResponse(
        response=response_text,
        is_helpful=True
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "study-helper-chatbot"}


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
            "Primary and secondary education subjects",
            "Explanations and examples only"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
