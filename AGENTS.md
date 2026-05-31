# AGENTS.md – High‑Signal Quickstart for OpenCode Sessions

## Local Development
- **Backend**: `pip install -r requirements-dev.txt` then `PYTHONPATH=. uvicorn src.main:app --host 0.0.0.0 --port 8080`
- **Frontend**: `cd frontend && npm install && npm run dev` (proxy `/api/*` → backend)
- **Run tests**: `pip install -r requirements-dev.txt` then `PYTHONPATH=. pytest tests/ -v`
- **Frontend tests**: `cd frontend && npm ci && npm run test -- --run`

## Linting & Type‑checking
- `flake8 src/ tests/` (max‑line‑len 120, ignore E203, W503)
- `black --check src/`
- `isort --check-only src/`
- `mypy src/` (python 3.12, strict=False, ignore_missing_imports)

## Security / Quality
- `pip-audit -r requirements.txt` (runs in CI)

## Formatting
- Keep lines ≤120 chars; ignore E203/W503

## CI Pipeline
- All checks (`test-backend`, `test-frontend`, `code-quality`) run **in parallel** in the `test` stage
- Code-quality requires `requirements-dev.txt` - install it locally to match CI

## Deployment (OpenShift)
- Ensure `$OPENSHIFT_TOKEN` and `$OPENSHIFT_SERVER` are set
- `oc login --token=$OPENSHIFT_TOKEN --server=$OPENSHIFT_SERVER`
- `oc apply -f k8s/ -n homework-bot`
- Verify rollout: `oc rollout status deployment/study-helper-chatbot -n homework-bot`
- `oc rollout status deployment/study-helper-frontend -n homework-bot`

## Docker Builds
- **Backend**: `docker build -t study-helper-backend .` (or `podman build -t study-helper-backend .`)
- **Frontend**: `docker build -t study-helper-frontend ./frontend` (or `podman build -t study-helper-frontend ./frontend`)

## Environment Variables (defaults)
- `LLM_ENDPOINT` → `http://192.168.11.36:8000/v1`
- `LLM_MODEL` → `local-model`
- `LLM_TIMEOUT` → `60`
- `MAX_IMAGE_COUNT` → `3`
- `MAX_IMAGE_BYTES` → `5242880` (5 MiB)
- `MAX_IMAGE_DIMENSION` → `2048`

## Image Handling
- Images are processed **in memory only**; they are **not persisted** to disk.

## Guardrails
- System‑prompt enforcement prevents direct solution delivery.
- Refusal pattern applied to out‑of‑context or non‑educational requests.
