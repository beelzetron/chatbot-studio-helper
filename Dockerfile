# Builder stage
FROM registry.access.redhat.com/ubi9/python-312:latest AS builder

USER root

# Install build dependencies (only needed for compiling Pillow etc)
RUN dnf install -y gcc python3-devel libjpeg-turbo-devel zlib-devel && \
    dnf clean all

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Prepare for non-root runtime
RUN chown -R 1001:0 /app && \
    chmod -R g+rwX /app

# Runtime stage
FROM registry.access.redhat.com/ubi9/python-312:latest AS runtime

# Copy application code and installed packages from builder
COPY --from=builder /app /app
COPY --from=builder /opt/app-root/lib64/python3.12/site-packages /opt/app-root/lib64/python3.12/site-packages
COPY --from=builder /opt/app-root/bin /opt/app-root/bin

# Run as non-root user
USER 1001

# Environment for unbuffered output
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
