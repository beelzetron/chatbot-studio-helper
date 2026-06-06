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
- **CI/CD**: GitHub Actions → GHCR

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
│   ├── nginx.conf.template  # Proxy /api → backend (envsubst)
│   └── Dockerfile
├── k8s/
│   ├── deployment.yaml      # Backend manifest
│   └── frontend-deployment.yaml
├── .github/workflows/
│   ├── test.yml             # Reusable test jobs
│   ├── ci.yml               # PR/push to main
│   └── release.yml          # v* tags → semver images + GitHub Release
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

## CI/CD

GitHub Actions runs on every PR and push to `main`:

| Job | Description |
|-----|-------------|
| `lint-internal` | Fails if private IPs or internal registry domains appear in source |
| `test-backend` | pytest |
| `test-frontend` | vitest |
| `code-quality` | pip-audit, flake8, black, isort, mypy |

On push to `main`, after tests pass, images are published to GHCR:

| Image | Tags |
|-------|------|
| `ghcr.io/beelzetron/chatbot-studio-helper-backend` | `latest`, commit SHA |
| `ghcr.io/beelzetron/chatbot-studio-helper-frontend` | `latest`, commit SHA |

### Release

Cut a release by pushing a semver tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The release workflow runs tests, publishes semver tags (`1.0.0`, `1.0`, `1`, `latest`) to GHCR, and creates a GitHub Release with auto-generated notes.

## Deployment su OpenShift

```bash
# Login
oc login --token=<TOKEN> --server=<SERVER>

# Apply manifests
oc apply -f k8s/ -n homework-bot

# Override LLM config (manifests use placeholders only)
oc patch configmap study-helper-config -n homework-bot \
  --type merge -p '{"data":{"LLM_ENDPOINT":"http://YOUR_LLM_HOST:8000/v1","LLM_MODEL":"your-model"}}'

# If the LLM endpoint exposes exactly one model at /models, LLM_MODEL can stay local-model for auto-detect.

# Check status
oc get pods -n homework-bot
oc get route study-helper-frontend -n homework-bot
oc get route study-helper-chatbot -n homework-bot
```

Il frontend nginx fa proxy di `/api/*` verso il backend, rimuovendo il prefisso `/api`.

### GHCR pull access

GHCR packages are private by default. Either make both packages public (Settings → Package → Change visibility), or create a pull secret:

```bash
kubectl create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=<github-user> \
  --docker-password=<PAT with read:packages> \
  -n homework-bot
```

Then add `imagePullSecrets: [{ name: ghcr-pull }]` to both Deployments, or use a ServiceAccount.

For reproducible deploys, pin images to a release tag (e.g. `ghcr.io/beelzetron/chatbot-studio-helper-backend:1.0.0`) instead of `latest`.

Copy `.env.example` to `.env` for local development; never commit real LLM endpoints.

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
| LLM_ENDPOINT | http://localhost:8000/v1 | LLM API endpoint |
| LLM_MODEL | local-model | Model name to use. Blank or `local-model` auto-detects the sole `/models` id; set explicitly when multiple models are available. |
| LLM_TIMEOUT | 60 | Timeout in seconds for LLM requests |
| MAX_IMAGE_COUNT | 3 | Max images per chat message |
| MAX_IMAGE_BYTES | 5242880 | Max bytes per image (5 MB) |
| MAX_IMAGE_DIMENSION | 2048 | Max width/height in pixels (downscaled if larger) |

See [`.env.example`](.env.example) for a local template.

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

CI build jobs use `docker/build-push-action` with UBI base images from `registry.access.redhat.com`.

## Sviluppo Locale

```bash
# Backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn src.main:app --host 0.0.0.0 --port 8080

# Frontend (proxy /api → localhost:8080)
cd frontend && npm install && npm run dev
```

See [LOCALEXECUTION.md](LOCALEXECUTION.md) for Podman/Docker container runs.

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
