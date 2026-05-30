# Study Helper Chatbot

AI chatbot per l'aiuto allo studio che fornisce spiegazioni ed esempi, **MAI soluzioni complete**.

## Caratteristiche

- ✅ Spiegazioni chiare di concetti scolastici
- ✅ Esempi pratici per illustrare i metodi
- ✅ Guida al ragionamento passo-passo
- ✅ Carica foto dei compiti o scatta una foto per chiedere aiuto
- ❌ **NON fornisce soluzioni complete**
- ❌ **Rifiuta richieste fuori contesto scolastico**

## Guardrail Implementati

1. **Contesto Scolastico**: Rifiuta domande su temi non educativi
2. **Nessuna Soluzione Diretta**: Fornisce solo esempi e spiegazioni
3. **Materie Supportate**: Tutte le materie della scuola primaria e secondaria
4. **Pattern di Rifiuto**: Blocca richieste di barare, trucco, lavoro non scolastico

## Stack Tecnologico

- **Backend**: Python 3.12 + FastAPI
- **Frontend**: React + Vite + Tailwind CSS
- **LLM**: Compatibile OpenAI API (endpoint locale)
- **Container**: Red Hat UBI 9 (`python-312`, `nodejs-20`, `nginx-124`)
- **Orchestrazione**: OpenShift
- **CI/CD**: GitLab CI

## Struttura del Progetto

```
chatbot-studio-helper/
├── src/
│   ├── main.py              # Chatbot con guardrail
│   └── attachments.py       # Validazione immagini homework
├── tests/
│   ├── test_guardrails.py
│   └── test_attachments.py
├── frontend/
│   ├── src/                 # React UI
│   ├── nginx.conf           # Proxy /api → backend
│   └── Dockerfile
├── k8s/
│   ├── deployment.yaml      # Backend manifest
│   └── frontend-deployment.yaml
├── Dockerfile
├── requirements.txt
├── .gitlab-ci.yml
└── README.md
```

## Deployment su OpenShift

```bash
# Login
oc login --token=<TOKEN> --server=<SERVER>

# Apply manifests
oc apply -f k8s/ -n homework-bot

# Check status
oc get pods -n homework-bot
oc get route study-helper-frontend -n homework-bot
oc get route study-helper-chatbot -n homework-bot
```

Il frontend nginx fa proxy di `/api/*` verso il backend, rimuovendo il prefisso `/api`.

## API Endpoints

### POST /chat

Accetta `multipart/form-data` con campi opzionali e fino a 3 immagini.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `message` | string | Domanda dello studente (opzionale se c'è almeno un'immagine) |
| `subject` | string | Materia scolastica (opzionale) |
| `grade_level` | string | `primary` o `secondary` (opzionale) |
| `images` | file[] | JPEG, PNG o WebP — max 5 MB ciascuna |

```bash
curl -X POST http://localhost:8080/chat \
  -F "message=Spiegami come si risolve questo esercizio" \
  -F "subject=matematica" \
  -F "grade_level=secondary" \
  -F "images=@homework.jpg"
```

Le immagini vengono elaborate in memoria e inviate al modello vision; **non vengono salvate** sul server.

Risposta JSON:
```json
{
  "response": "...",
  "is_helpful": true,
  "safety_violation": false
}
```

### GET /health
Health check endpoint.

### GET /info
Service information and guardrails documentation.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| LLM_ENDPOINT | http://192.168.11.36:8000/v1 | LLM API endpoint |
| LLM_MODEL | local-model | Model name to use (must support vision for image uploads) |
| LLM_TIMEOUT | 60 | Timeout in seconds for LLM requests |
| MAX_IMAGE_COUNT | 3 | Max images per chat message |
| MAX_IMAGE_BYTES | 5242880 | Max bytes per image (5 MB) |
| MAX_IMAGE_DIMENSION | 2048 | Max width/height in pixels (downscaled if larger) |

## Container Images (UBI 9)

Images are based on [Red Hat Universal Base Images](https://catalog.redhat.com/software/base-images):

| Component | Base image | Port |
|-----------|------------|------|
| Backend | `registry.access.redhat.com/ubi9/python-312` | 8080 |
| Frontend build | `registry.access.redhat.com/ubi9/nodejs-20` | — |
| Frontend serve | `registry.access.redhat.com/ubi9/nginx-124` | 8080 |

Both containers run as non-root (UID 1001) and are compatible with OpenShift arbitrary UID assignment.

```bash
# Build with podman
podman build -t study-helper-backend .
podman build -t study-helper-frontend ./frontend

# Smoke test
podman run --rm -p 8080:8080 study-helper-backend
podman run --rm -p 8080:8080 study-helper-frontend
```

CI test jobs use the same UBI base images. Build jobs pull UBI layers from `registry.access.redhat.com` (no subscription required for UBI).

## Sviluppo Locale

```bash
# Backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn src.main:app --host 0.0.0.0 --port 8080

# Frontend (proxy /api → localhost:8080)
cd frontend && npm install && npm run dev
```

## Testing

```bash
# Backend
pip install -r requirements.txt pytest pytest-asyncio
PYTHONPATH=. pytest tests/ -v

# Frontend
cd frontend && npm ci && npm run test -- --run
```

## Sicurezza

- Nessun dato viene memorizzato (inclusi upload immagini, elaborati in memoria)
- Solo contesto scolastico approvato
- System prompt enforced per prevenire soluzioni dirette
- Pattern matching per rilevare richieste inappropriate
- Con immagini: il modello spiega concetti ma non risolve l'esercizio fotografato
