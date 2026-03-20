# Mayler LiveKit Voice Agent — Production Dockerfile
# syntax=docker/dockerfile:1
ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim

ENV PYTHONUNBUFFERED=1

# Create non-root user
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/home/appuser" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

USER appuser
RUN mkdir -p /home/appuser/.cache
WORKDIR /home/appuser

# Install Python dependencies
COPY requirements.txt .
RUN python -m pip install --user --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Download plugin models at build time (VAD, turn detector, etc.)
RUN python agent.py download-files

# Expose health check port
EXPOSE 8081

# Run in production mode
CMD ["python", "agent.py", "start"]
