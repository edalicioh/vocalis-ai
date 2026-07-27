# ============================================================
# Dockerfile — Orquestrador Node.js (apps/orchestrator)
# Multi-stage build para imagem de produção enxuta
# ============================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copia configs de workspace e dependências
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-types/tsconfig.json packages/shared-types/
COPY packages/shared-types/src/ packages/shared-types/src/
COPY apps/orchestrator/package.json apps/orchestrator/
COPY apps/orchestrator/tsconfig.json apps/orchestrator/

# Instala dependências
RUN npm ci --workspace=packages/shared-types --workspace=apps/orchestrator

# Copia o código fonte
COPY apps/orchestrator/src/ apps/orchestrator/src/

# Build shared-types e orquestrador
RUN npm run build:types && npm run build:orchestrator

# --- Stage 2: Production ---
FROM node:20-alpine AS production

WORKDIR /app

# Copia apenas o necessário para produção
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/shared-types/package.json packages/shared-types/
COPY --from=builder /app/packages/shared-types/dist/ packages/shared-types/dist/
COPY --from=builder /app/apps/orchestrator/package.json apps/orchestrator/
COPY --from=builder /app/apps/orchestrator/dist/ apps/orchestrator/dist/

# Instala apenas dependências de produção
RUN npm ci --workspace=packages/shared-types --workspace=apps/orchestrator --omit=dev

# Variáveis de ambiente com defaults seguros
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV WHISPER_WS_URL=ws://whisper:8000/ws/transcribe

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3001/health || exit 1

EXPOSE 3001

# Usuário não-root por segurança
RUN addgroup -S copilot && adduser -S copilot -G copilot
USER copilot

CMD ["node", "apps/orchestrator/dist/server.js"]
