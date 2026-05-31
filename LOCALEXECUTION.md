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

### Avviare il Backend

```bash
podman run -d \
  --name chatbot-backend \
  -p 8080:8080 \
  -e LLM_ENDPOINT=http://192.168.11.36:8000/v1 \
  -e LLM_MODEL=local-model \
  -e LLM_TIMEOUT=60 \
  -e MAX_IMAGE_COUNT=3 \
  -e MAX_IMAGE_BYTES=5242880 \
  -e MAX_IMAGE_DIMENSION=2048 \
  study-helper-backend
```

### Avviare il Frontend

```bash
podman run -d \
  --name chatbot-frontend \
  -p 3000:8080 \
  study-helper-frontend
```

### Accesso

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/health

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
      - LLM_ENDPOINT=http://192.168.11.36:8000/v1
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
    depends_on:
      - backend
    restart: unless-stopped
```

### Avviare tutti i servizi

```bash
# Con Podman
podman-compose up -d

# Oppure con Docker
docker-compose up -d
```

### Fermare i servizi

```bash
# Con Podman
podman-compose down

# Oppure con Docker
docker-compose down
```

## Verifica del Funzionamento

### Test Health Check

```bash
curl http://localhost:8080/health
```

### Test API Chat

```bash
curl -X POST http://localhost:8080/chat \
  -F "message=Spiegami come si risolve questo esercizio" \
  -F "subject=matematica" \
  -F "grade_level=secondary"
```

### Test con Immagine

```bash
curl -X POST http://localhost:8080/chat \
  -F "message=Spiegami questo esercizio" \
  -F "subject=matematica" \
  -F "grade_level=secondary" \
  -F "images=@homework.jpg"
```

## Environment Variables

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `LLM_ENDPOINT` | http://192.168.11.36:8000/v1 | Endpoint API LLM |
| `LLM_MODEL` | local-model | Nome del modello da usare |
| `LLM_TIMEOUT` | 60 | Timeout in secondi per le richieste LLM |
| `MAX_IMAGE_COUNT` | 3 | Numero massimo di immagini per messaggio |
| `MAX_IMAGE_BYTES` | 5242880 | Massimo byte per immagine (5 MB) |
| `MAX_IMAGE_DIMENSION` | 2048 | Massimo width/height in pixel |

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

1. **Endpoint LLM**: Il chatbot richiede un endpoint LLM funzionante. Modifica `LLM_ENDPOINT` secondo la tua configurazione.

2. **Port Mapping**: Il frontend usa la porta 8080 internamente, quindi mappalo su una porta diversa (es. 3000) per evitare conflitti.

3. **Sicurezza**: I container UBI 9 python-312 e nginx-124 eseguono il processo come utente non-root (UID 1001).

4. **Immagini**: Le immagini caricate vengono elaborate in memoria e **non vengono salvate** sul server.

5. **Podman vs Docker**: Podman è consigliato su macOS/Linux per non richiedere un daemon in background.
