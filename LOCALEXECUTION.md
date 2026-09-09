# Chatbot Studio Helper - Guida per l'Esecuzione Locale con Podman/Docker

Questa guida spiega come eseguire il Chatbot Studio Helper localmente usando Podman o Docker.

## Prerequisiti

- **Podman** (consigliato su macOS/Linux) o **Docker**
- Per testare il chatbot funzionalmente, è necessario un endpoint LLM che supporti l'API OpenAI

## Opzione 1: Esecuzione Separata (Sviluppo)

### Build delle Immagini

```bash
# Backend
podman build -t study-helper-backend .

# Frontend
podman build -t study-helper-frontend ./frontend
```

O con Docker:

```bash
# Backend
docker build -t study-helper-backend .

# Frontend
docker build -t study-helper-frontend ./frontend
```

### Rete Condivisa

Il frontend nginx fa proxy verso il backend usando `BACKEND_HOST` e `BACKEND_PORT`. I container devono potersi raggiungere a vicenda: crea una rete condivisa (una sola volta):

```bash
podman network create chatbot-net
```

Con Docker:

```bash
docker network create chatbot-net
```

### Avviare il Backend

```bash
podman run -d \
  --name chatbot-backend \
  --network chatbot-net \
  -p 8080:8080 \
  -e LLM_ENDPOINT=http://localhost:8000/v1 \
  -e LLM_MODEL=local-model \
  -e LLM_TIMEOUT=60 \
  -e MAX_IMAGE_COUNT=3 \
  -e MAX_IMAGE_BYTES=5242880 \
  -e MAX_IMAGE_DIMENSION=2048 \
  study-helper-backend
```

### Avviare il Frontend

Il frontend genera la configurazione nginx da `nginx.conf.template` sostituendo `BACKEND_HOST` e `BACKEND_PORT`. Entrambe le variabili sono obbligatorie.

**Rete condivisa** (consigliato su Linux; funziona anche su macOS):

```bash
podman run -d \
  --name chatbot-frontend \
  --network chatbot-net \
  -p 3000:8080 \
  -e BACKEND_HOST=chatbot-backend \
  -e BACKEND_PORT=8080 \
  study-helper-frontend
```

**Alternativa su macOS (Podman/Docker Desktop)** — senza rete condivisa, il frontend raggiunge il backend tramite la porta pubblicata sull'host:

```bash
podman run -d \
  --name chatbot-frontend \
  -p 3000:8080 \
  -e BACKEND_HOST=host.containers.internal \
  -e BACKEND_PORT=8080 \
  study-helper-frontend
```

> Su Linux con Podman, se `host.containers.internal` non è disponibile, usa `--network chatbot-net` come sopra oppure aggiungi `--add-host=host.containers.internal:host-gateway` al comando `podman run`.

### Accesso

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Health Check (backend)**: http://localhost:8080/health
- **Health Check (via frontend proxy)**: http://localhost:3000/api/health

## Opzione 2: Esecuzione con Docker Compose

Crea un file `docker-compose.yml` nella root del progetto:

```yaml
version: '3.8'

services:
  backend:
    image: study-helper-backend:latest
    container_name: chatbot-backend
    ports:
      - "8080:8080"
    environment:
      - LLM_ENDPOINT=http://localhost:8000/v1
      - LLM_MODEL=local-model
      - LLM_TIMEOUT=60
      - MAX_IMAGE_COUNT=3
      - MAX_IMAGE_BYTES=5242880
      - MAX_IMAGE_DIMENSION=2048
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s

  frontend:
    image: study-helper-frontend:latest
    container_name: chatbot-frontend
    ports:
      - "3000:8080"
    environment:
      - BACKEND_HOST=backend
      - BACKEND_PORT=8080
    depends_on:
      - backend
    restart: unless-stopped
```

> In Compose i servizi si raggiungono per **nome del servizio** (`backend`), non per `container_name`.

### Avviare tutti i servizi

```bash
# Con Podman (richiede podman-compose)
podman-compose up -d

# Oppure con Docker
docker compose up -d
```

### Fermare i servizi

```bash
# Con Podman
podman-compose down

# Oppure con Docker
docker compose down
```

## Verifica del Funzionamento

### Test Health Check

```bash
curl http://localhost:8080/health
curl http://localhost:3000/api/health
```

### Test API Chat

```bash
curl -X POST http://localhost:8080/chat \
  -F "message=Spiegami come si risolve questo esercizio" \
  -F "subject=matematica" \
  -F "grade_level=secondary"
```

### Test con Immagine

Sostituisci `percorso/alla/tua-immagine.jpg` con un file JPEG o PNG locale:

```bash
curl -X POST http://localhost:8080/chat \
  -F "message=Spiegami questo esercizio" \
  -F "subject=matematica" \
  -F "grade_level=secondary" \
  -F "images=@percorso/alla/tua-immagine.jpg"
```

## Environment Variables

### Backend

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `LLM_ENDPOINT` | http://localhost:8000/v1 | Endpoint API LLM |
| `LLM_MODEL` | local-model | Nome del modello da usare. Vuoto o `local-model` auto-rileva l'unico id da `/models`; impostalo esplicitamente se il server espone più modelli. |
| `LLM_TIMEOUT` | 60 | Timeout in secondi per le richieste LLM |
| `MAX_IMAGE_COUNT` | 3 | Numero massimo di immagini per messaggio |
| `MAX_IMAGE_BYTES` | 5242880 | Massimo byte per immagine (5 MB) |
| `MAX_IMAGE_DIMENSION` | 2048 | Massimo width/height in pixel |

### Frontend

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `BACKEND_HOST` | *(obbligatorio)* | Hostname del backend (es. `chatbot-backend`, `backend`, `host.containers.internal`) |
| `BACKEND_PORT` | *(obbligatorio)* | Porta del backend (es. `8080`) |

## Rimuovere i Container

```bash
# Ferma e rimuovi i container
podman stop chatbot-backend chatbot-frontend
podman rm chatbot-backend chatbot-frontend

# Oppure con Docker
docker stop chatbot-backend chatbot-frontend
docker rm chatbot-backend chatbot-frontend
```

## Pulizia delle Immagini

```bash
# Rimuovi le immagini build
podman rmi study-helper-backend study-helper-frontend

# Oppure con Docker
docker rmi study-helper-backend study-helper-frontend
```

## Note Importanti

1. **Endpoint LLM**: Il chatbot richiede un endpoint LLM funzionante. Modifica `LLM_ENDPOINT` secondo la tua configurazione. Se l'endpoint non è raggiungibile, `/health` risponde comunque OK ma `/chat` restituisce un errore di servizio LLM.

2. **Proxy frontend**: Il frontend espone l'API sotto `/api/*` e inoltra le richieste al backend. Senza `BACKEND_HOST` e `BACKEND_PORT` nginx non si avvia.

3. **Port Mapping**: Il frontend usa la porta 8080 internamente, quindi mappalo su una porta diversa (es. 3000) per evitare conflitti con il backend.

4. **Sicurezza**: I container UBI 9 python-312 e nginx-124 eseguono il processo come utente non-root (UID 1001).

5. **Immagini**: Le immagini caricate vengono elaborate in memoria e **non vengono salvate** sul server.

6. **Podman vs Docker**: Podman è consigliato su macOS/Linux per non richiedere un daemon in background. Per Compose con Podman installa `podman-compose` oppure usa `docker compose`.
