# ============================================================
# Dockerfile — Serviço de Transcrição Whisper (CUDA + CPU)
# Suporte a GPU NVIDIA via CUDA ou fallback para CPU
# ============================================================

# --- Base com CUDA (para GPU) ---
# Trocar por python:3.11-slim para build somente CPU
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Instala Python 3.11
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python

WORKDIR /app

# --- Stage: Dependencies ---
FROM base AS deps

COPY apps/transcription-service/requirements.txt .

# Instala dependências Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# --- Stage: Production ---
FROM deps AS production

# Copia o código da aplicação
COPY apps/transcription-service/main.py .

# Variáveis de ambiente com defaults
ENV WHISPER_MODEL=small
ENV WHISPER_DEVICE=cuda
ENV WHISPER_COMPUTE=float16

# Para fallback CPU, use:
# ENV WHISPER_DEVICE=cpu
# ENV WHISPER_COMPUTE=int8

# Pre-download do modelo na build (opcional — descomente para incluir no image)
# RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

EXPOSE 8000

# Usuário não-root
RUN groupadd -r copilot && useradd -r -g copilot copilot
# O modelo Whisper precisa de escrita em cache — cria dir com permissão
RUN mkdir -p /home/copilot/.cache && chown -R copilot:copilot /home/copilot
USER copilot

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
