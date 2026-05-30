FROM registry.access.redhat.com/ubi9/python-312:latest

USER root

# Native deps for Pillow
RUN dnf install -y gcc python3-devel libjpeg-turbo-devel zlib-devel && \
    dnf clean all

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

RUN chown -R 1001:0 /app && \
    chmod -R g+rwX /app

USER 1001

ENV PYTHONPATH=/app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
