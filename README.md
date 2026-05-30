# Study Helper Chatbot

AI chatbot per l'aiuto allo studio che fornisce spiegazioni ed esempi, **MAI soluzioni complete**.

## Caratteristiche

- ✅ Spiegazioni chiare di concetti scolastici
- ✅ Esempi pratici per illustrare i metodi
- ✅ Guida al ragionamento passo-passo
- ❌ **NON fornisce soluzioni complete**
- ❌ **Rifiuta richieste fuori contesto scolastico**

## Guardrail Implementati

1. **Contesto Scolastico**: Rifiuta domande su temi non educativi
2. **Nessuna Soluzione Diretta**: Fornisce solo esempi e spiegazioni
3. **Materie Supportate**: Tutte le materie della scuola primaria e secondaria
4. **Pattern di Rifiuto**: Blocca richieste di barare, trucco, lavoro non scolastico

## Stack Tecnologico

- **Backend**: Python 3.12 + FastAPI
- **LLM**: Compatibile OpenAI API (endpoint locale)
- **Container**: Docker
- **Orchestrazione**: OpenShift
- **CI/CD**: GitLab CI

## Struttura del Progetto

```
chatbot-studio-helper/
├── src/
│   └── main.py          # Chatbot con guardrail
├── tests/
│   └── test_guardrails.py
├── k8s/
│   └── deployment.yaml  # Manifest OpenShift
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
oc get route study-helper-chatbot -n homework-bot
```

## API Endpoints

### POST /chat
```json
{
  "message": "Mi aiuti a capire come si risolve un'equazione di secondo grado?",
  "subject": "matematica",
  "grade_level": "secondary"
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
| LLM_MODEL | local-model | Model name to use |

## Testing

```bash
pip install pytest pytest-asyncio
pytest tests/ -v
```

## Sicurezza

- Nessun dato viene memorizzato
- Solo contesto scolastico approvato
- System prompt enforced per prevenire soluzioni dirette
- Pattern matching per rilevare richieste inappropriate
