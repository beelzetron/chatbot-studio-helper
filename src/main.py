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
    r"\b(lavoro|professionale|lavoro\s+condiviso|side\s+hustle)\b",
    r"\b(fare\s+i\s+soldi|guadagnare|investire|crypto|bitcoin)\b",
    r"\b(sesso|relazione\s+intima|dating)\b",
    r"\b(politica\s+attiva|candidatura|voto|partito)\b",
    r"\b(cocaina|eroina|droghe|stupefacenti)\b",
    r"\b(armi|violenza|combattimento)\b",
    r"\b(hack|crack|password|violare)\b",
    r"\b(trucco|barare|copiare|soluzione\s+completa)\b",
    r"\b(sistema\s+il\s+compito|fai\s+il\s+compito)\b"
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
    r"\b(immagina\s+che|pretend\s+that|suppose\s+that)\b",
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
    r"\b(so\s+che\s+non\s+puoi|I\s+know\s+you\s+can't|dimmi\s+solo\s+la\s+prima)\b",
    r"\b(solo\s+il\s+risultato\s+finale|just\s+the\s+final\s+answer)\b",
    
    # Language switching attacks
    r"\b(please\s+ignore\s+your\s+rules|give\s+me\s+the\s+complete\s+solution)\b",
    r"\b(bypass\s+your\s+restrictions|override\s+your\s+filters)\b",
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
    
    # Check for prompt injection attacks
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, message_lower):
            return False, "Rilevato tentativo di prompt injection"
    
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
