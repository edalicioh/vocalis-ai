# 🎙️ Copiloto de Conversas e Entrevistas Técnicas

Assistente em tempo real que transcreve reuniões, detecta perguntas e sugere respostas contextuais com IA — tudo rodando localmente.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Instalação Local (Desenvolvimento)](#instalação-local-desenvolvimento)
- [Deploy com Docker (Produção)](#deploy-com-docker-produção)
- [Extensão Chrome](#extensão-chrome)
- [Configuração](#configuração)
- [Uso](#uso)
- [API e Health Checks](#api-e-health-checks)
- [Troubleshooting](#troubleshooting)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Visão Geral

O sistema captura o áudio de uma reunião no Chrome, transcreve localmente com faster-whisper, detecta perguntas automaticamente e gera sugestões contextuais via Google Gemini — exibidas em um painel flutuante sobre a reunião.

```
Chrome (Google Meet/Teams) → Extensão Chrome → WebSocket → Orquestrador Node.js
                                                              ├── Whisper (transcrição local)
                                                              └── API Gemini (sugestões IA)
```

**Prioridades**: baixa latência (<3s), privacidade (áudio local), custo reduzido, respostas curtas.

---

## Arquitetura

| Componente | Tecnologia | Porta | Descrição |
| :--- | :--- | :---: | :--- |
| **Extensão Chrome** | React + TypeScript + Manifest V3 | — | Captura áudio, painel flutuante, TTS |
| **Orquestrador** | Node.js + Fastify + WebSocket | `3001` | Núcleo do sistema: contexto, detecção, IA |
| **Whisper** | Python + FastAPI + faster-whisper | `8000` | Transcrição local com GPU/CPU |
| **API de IA** | Google Gemini (substituível) | externa | Geração de sugestões |

---

## Pré-requisitos

### Para todos os cenários

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/) v2+
- [Google Chrome](https://www.google.com/chrome/) (para a extensão)
- Chave de API do [Google Gemini](https://aistudio.google.com/apikey)

### Para GPU (recomendado)

- GPU NVIDIA com >= 4GB VRAM (testado com RTX 3050 6GB)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- Drivers NVIDIA atualizados

### Para desenvolvimento local (sem Docker)

- Node.js 20+
- Python 3.11+
- CUDA Toolkit 12.x (se usar GPU)

---

## Instalação Local (Desenvolvimento)

### 1. Clone e instale dependências

```bash
git clone https://github.com/seu-usuario/conversation-copilot.git
cd conversation-copilot
npm install
```

### 2. Configure variáveis de ambiente

```bash
cp .env.example .env
# Edite .env e coloque sua GEMINI_API_KEY
```

### 3. Inicie o serviço Whisper (Python)

```bash
cd apps/transcription-service

# Cria ambiente virtual
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

pip install -r requirements.txt

# GPU (recomendado):
WHISPER_DEVICE=cuda WHISPER_COMPUTE=float16 python main.py

# CPU (fallback):
WHISPER_DEVICE=cpu WHISPER_COMPUTE=int8 python main.py
```

O serviço Whisper estará em `ws://localhost:8000/ws/transcribe`.

### 4. Inicie o orquestrador (Node.js)

```bash
# Em outro terminal, na raiz do projeto
npm run build:types
npm run dev:orchestrator
```

O orquestrador estará em `ws://localhost:3001/ws`.

### 5. Build da extensão Chrome

```bash
npm run build:extension
```

A extensão compilada estará em `apps/chrome-extension/dist/`.

---

## Deploy com Docker (Produção)

### Quick Start — GPU

```bash
# 1. Configure o .env
cp .env.example .env
nano .env  # coloque sua GEMINI_API_KEY

# 2. Suba os containers com GPU
docker compose --profile gpu up -d

# 3. Verifique os health checks
docker compose ps
```

### Quick Start — CPU (sem GPU)

```bash
# 1. Configure o .env
cp .env.example .env

# 2. Suba os containers em modo CPU
docker compose --profile cpu up -d
```

### Comandos úteis

```bash
# Ver logs em tempo real
docker compose logs -f

# Logs de um serviço específico
docker compose logs -f orchestrator
docker compose logs -f whisper

# Parar tudo
docker compose --profile gpu down

# Rebuild após mudanças no código
docker compose --profile gpu build --no-cache
docker compose --profile gpu up -d

# Verificar status dos containers
docker compose ps

# Health check manual
curl http://localhost:3001/health
curl http://localhost:8000/health
```

### Configuração do modelo Whisper

| Modelo | VRAM | Velocidade | Qualidade | Recomendação |
| :--- | :---: | :---: | :---: | :--- |
| `tiny` | ~1 GB | ⚡⚡⚡ | ⭐ | Testes rápidos |
| `base` | ~1 GB | ⚡⚡ | ⭐⭐ | Máquinas fracas |
| `small` | ~2 GB | ⚡⚡ | ⭐⭐⭐ | **Recomendado (padrão)** |
| `medium` | ~5 GB | ⚡ | ⭐⭐⭐⭐ | Alta qualidade |
| `large-v3` | ~10 GB | 🐢 | ⭐⭐⭐⭐⭐ | Máxima precisão |

Para trocar o modelo, edite o `.env`:

```env
WHISPER_MODEL=medium
```

### Variáveis de ambiente

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | — | **Obrigatória.** Chave da API do Google Gemini |
| `ORCHESTRATOR_PORT` | `3001` | Porta do orquestrador |
| `WHISPER_PORT` | `8000` | Porta do serviço Whisper |
| `WHISPER_MODEL` | `small` | Modelo do faster-whisper |
| `WHISPER_COMPUTE` | `float16` | Tipo de computação (`float16`, `int8`, `float32`) |

---

## Extensão Chrome

### Instalação (modo desenvolvedor)

1. Abra `chrome://extensions/` no Chrome.
2. Ative o **Modo do desenvolvedor** (toggle no canto superior direito).
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `apps/chrome-extension/dist/`.
5. A extensão aparecerá na barra do Chrome.

### Build da extensão

```bash
npm run build:extension
```

> **Nota:** A extensão roda no Chrome do usuário e se conecta ao servidor local. Ela **não** precisa de Docker.

---

## Configuração

### Pela extensão (Popup)

1. Clique no ícone da extensão na barra do Chrome.
2. Configure:
   - **Chave de API do Gemini** — obrigatória para sugestões de IA.
   - **Perfil profissional** — cargo, habilidades, experiências.
   - **Dados da vaga** — título, requisitos, tecnologias.
3. Clique em **Salvar Configurações**.

### Modos de resposta

| Modo | Descrição | Uso recomendado |
| :--- | :--- | :--- |
| **Palavras-chave** | Apenas tópicos para citar | Conversa rápida |
| **Curto** (padrão) | 30–60 palavras | Entrevistas ao vivo |
| **Completo** | 80–150 palavras | Discussões técnicas |
| **Estruturado** | Abertura → Decisão → Justificativa → Trade-offs → Exemplo | Respostas complexas |

### Modos visuais do painel

| Modo | O que exibe |
| :--- | :--- |
| **Normal** | Transcrição + pergunta + resposta + palavras-chave |
| **Compacto** | Apenas status e palavras-chave |
| **Somente palavras-chave** | Keywords da resposta |
| **Somente transcrição** | Feed de transcrição ao vivo |
| **Oculto** | Botão circular para reabrir |

### Atalhos

| Atalho | Ação |
| :--- | :--- |
| `Alt+S` | Forçar geração de sugestão agora |

---

## Uso

### Fluxo básico

1. **Inicie os servidores** (Docker ou local).
2. **Abra a reunião** no Chrome (Google Meet, Teams, etc.).
3. **Clique no ícone da extensão** → configure se necessário.
4. **Clique em "Iniciar Captura"** no painel flutuante.
5. O painel mostrará:
   - 🟢 Status dos serviços (Whisper, IA).
   - 📝 Transcrição ao vivo da reunião.
   - ❓ Perguntas detectadas automaticamente.
   - 💡 Sugestões contextuais da IA.
   - 🔑 Palavras-chave para citar.
6. **Use `Alt+S`** para forçar uma sugestão a qualquer momento.
7. **Clique em "🗣️ Ler"** para ouvir a sugestão via TTS.
8. **Clique em "Parar"** para encerrar a sessão.

### TTS (Leitura por voz)

- O TTS lê as sugestões em voz usando o sintetizador do Chrome.
- **5 modos**: Desligado, Resposta completa, Somente resumo, Somente palavras-chave, Manual.
- **Controles**: velocidade (padrão 1.25x), volume (padrão 40%), pausar, repetir.
- O TTS é cancelado automaticamente quando surge uma nova pergunta.

---

## API e Health Checks

### Orquestrador (`localhost:3001`)

```bash
# Health check
curl http://localhost:3001/health

# Resposta esperada:
{
  "status": "ok",
  "whisperConnected": true,
  "llmConfigured": true,
  "activeSession": "session-1722060000000",
  "totalQuestions": 5,
  "averageLatency": 2340
}
```

### Whisper (`localhost:8000`)

```bash
# Health check
curl http://localhost:8000/health

# Resposta esperada:
{
  "status": "ok",
  "model": "small",
  "device": "cuda",
  "model_loaded": true
}
```

### Protocolo WebSocket

Os eventos seguem a convenção `dot.notation`:

| Direção | Evento | Descrição |
| :--- | :--- | :--- |
| Extensão → Backend | `session.start` | Inicia sessão |
| Extensão → Backend | `session.stop` | Encerra sessão |
| Extensão → Backend | `audio.chunk` | Bloco de áudio PCM |
| Extensão → Backend | `answer.force` | Forçar geração de sugestão |
| Extensão → Backend | `settings.update` | Atualizar configurações |
| Backend → Extensão | `transcript.partial` | Transcrição parcial |
| Backend → Extensão | `transcript.final` | Transcrição confirmada |
| Backend → Extensão | `question.detected` | Pergunta identificada |
| Backend → Extensão | `answer.started` | Início da geração |
| Backend → Extensão | `answer.delta` | Token parcial da resposta |
| Backend → Extensão | `answer.completed` | Resposta completa |
| Backend → Extensão | `answer.cancelled` | Geração interrompida |
| Backend → Extensão | `status.update` | Estado dos serviços |

---

## Troubleshooting

### O Whisper não conecta

```bash
# Verifique se o container está rodando
docker compose ps

# Verifique logs
docker compose logs whisper

# O modelo demora ~30-60s para carregar na primeira vez
# Verifique o health check
curl http://localhost:8000/health
```

### Erro "GPU not available"

```bash
# Verifique se o NVIDIA Container Toolkit está instalado
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi

# Se não tiver GPU, use o perfil CPU
docker compose --profile cpu up -d
```

### A extensão não conecta ao orquestrador

- Verifique se o orquestrador está rodando na porta 3001.
- A extensão conecta em `ws://localhost:3001/ws`.
- Se os containers estiverem em outra máquina, mapeie a porta correta.

### Latência alta (>3 segundos)

- Use o modelo `small` (padrão) ao invés de `medium` ou `large`.
- Verifique se o Whisper está usando GPU (`WHISPER_DEVICE=cuda`).
- Use `WHISPER_COMPUTE=float16` para melhor performance na GPU.
- Verifique o health check para ver a latência média.

### TTS não funciona

- O TTS usa o sintetizador nativo do Chrome (`speechSynthesis`).
- Verifique se há vozes em Português instaladas: `chrome://settings/accessibility`.
- O TTS só funciona se o painel estiver visível e não mutado.

---

## Estrutura do Projeto

```
conversation-copilot/
├── apps/
│   ├── chrome-extension/       # Extensão Chrome (React + Manifest V3)
│   │   ├── src/
│   │   │   ├── background/     # Service Worker
│   │   │   ├── content/        # Content Script + Overlay (painel flutuante)
│   │   │   ├── offscreen/      # Captura de áudio (Offscreen Document)
│   │   │   ├── popup/          # Popup de configurações
│   │   │   └── tts/            # Gerenciador de TTS
│   │   ├── manifest.json
│   │   └── vite.config.ts
│   ├── orchestrator/           # Orquestrador Node.js (Fastify)
│   │   ├── src/
│   │   │   ├── server.ts       # Servidor principal
│   │   │   └── services/       # Serviços (IA, contexto, detecção, Whisper)
│   │   └── Dockerfile
│   └── transcription-service/  # Serviço Whisper (Python + FastAPI)
│       ├── main.py
│       ├── requirements.txt
│       ├── Dockerfile          # GPU (CUDA)
│       └── Dockerfile.cpu      # CPU only
├── packages/
│   └── shared-types/           # Tipos TypeScript compartilhados
├── context/
│   └── plans/                  # Planos de fase do projeto
├── docker-compose.yml          # Orquestração dos containers
├── .env.example                # Template de variáveis de ambiente
└── package.json                # Workspace root
```

---

## Licença

Projeto privado. Todos os direitos reservados.
