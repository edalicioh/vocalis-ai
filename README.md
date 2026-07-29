<p align="center">
  <img src="assets/logo.png" alt="Vocalis AI Logo" width="160" />
</p>

# 🎙️ Vocalis AI — Copiloto de Conversas e Entrevistas Técnicas

🌐 **[Português (Brasil)](README.md)** | **[English](README.en.md)**

[![Versão](https://img.shields.io/badge/vers%C3%A3o-v1.0.0-blue.svg)](CHANGELOG.md)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-GPL--2.0-green.svg)](LICENSE)
[![Brand Brief](https://img.shields.io/badge/marca-Brand%20Brief-purple.svg)](BRAND_BRIEF.md)
[![Documentação](https://img.shields.io/badge/docs-Documenta%C3%A7%C3%A3o-orange.svg)](docs/USER_GUIDE.md)

Assistente em tempo real que transcreve reuniões, detecta perguntas e sugere respostas contextuais com IA — tudo rodando com baixa latência, internacionalização (`pt-BR`/`en`) e suporte a IA local on-device.

---

## 📚 Central de Documentação

- 📘 [**Guia do Usuário**](docs/USER_GUIDE.md): Instruções passo a passo de instalação, uso e configurações.
- 🏗️ [**Arquitetura Técnica**](docs/ARCHITECTURE.md): Diagramas do sistema, pipeline de áudio PCM, Chrome Built-in AI e motor i18n.
- ⚙️ [**Variáveis de Ambiente**](docs/ENVIRONMENT_VARIABLES.md): Referência completa de configuração do `.env`.
- 🎨 [**Brand Briefing**](BRAND_BRIEF.md): Guia de identidade visual, logotipo 3D, cores e tom de voz do Vocalis AI.
- 📜 [**Licença Open-Source**](LICENSE): Texto oficial da licença GNU General Public License v2.0 (GPLv2).
- 🏷️ [**Registro de Alterações**](CHANGELOG.md): Histórico de versão `v1.0.0`.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Instalação Local (Desenvolvimento)](#instalação-local-desenvolvimento)
- [Deploy com Docker (Produção)](#deploy-com-docker-produção)
- [Extensão Chrome](#extensão-chrome)
- [Configuração](#configuração)
- [Testes Automatizados](#testes-automatizados)
- [Uso](#uso)
- [API e Health Checks](#api-e-health-checks)
- [Troubleshooting](#troubleshooting)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Visão Geral

O sistema captura o áudio de uma reunião no Chrome, filtra o silêncio localmente via RMS Energy Gate, transcreve com faster-whisper + Silero VAD, pré-processa jargões técnicos via **Chrome Built-in AI (Gemini Nano on-device)**, detecta perguntas automaticamente e gera sugestões contextuais adaptadas ao modo de reunião ativo — exibidas em um painel flutuante sobre a reunião com opção de reescrita instantânea local.

```
Chrome (Meet/Teams) → Extensão Chrome (Shadow DOM + Gemini Nano Local) → WebSocket → Orquestrador Node.js
                                                                                        ├── Whisper (Silero VAD)
                                                                                        └── LLM (Gemini / Claude / Ollama)
```

**Prioridades**: baixa latência (<3s), privacidade (áudio e pré-processamento local), otimização de banda/CPU (VAD RMS), respostas curtas e adaptativas.

---

## Arquitetura

| Componente | Tecnologia | Porta | Descrição |
| :--- | :--- | :---: | :--- |
| **Extensão Chrome** | React + TypeScript + Manifest V3 | — | Captura áudio PCM 16kHz, HUD em Shadow DOM, TTS, E2E Playwright |
| **Chrome AI (Gemini Nano)** | Prompt API + Rewriter API (`window.ai`) | local | Pré-processador on-device: correção ortográfica, sumarização e reescrita instantânea |
| **Orquestrador** | Node.js + Fastify + WebSocket | `3001` | Núcleo do sistema: gerenciador de contexto, detecção, modos de reunião e IA |
| **Whisper (VAD)** | Python + FastAPI + faster-whisper | `8000` | Transcrição local com GPU/CPU e Silero VAD (`vad_filter=True`) |
| **API de IA** | Gemini, OpenAI, Anthropic, Ollama ou Proxy Customizado (DeepSeek, Groq) | externa / local | Geração de sugestões contextuais |

---

## Recursos Principais

### 🧠 Chrome Built-in AI (Gemini Nano On-Device)
- **Correção Ortográfica de Jargões (`CHROME-01`)**: Correção silenciosa de termos de TI truncados (ex: Larabel -> Laravel, Vites -> Vitest, Fast-ify -> Fastify) via Prompt API antes de atingir o LLM.
- **Sumarização Incremental Contínua (`CHROME-02`)**: Síntese do contexto da reunião a cada 5 frases ou 60s para compressão de tokens.
- **Reescrita Instantânea no HUD (`CHROME-04`)**: Chips de ação rápida `[✂️ Encurtar]`, `[💼 Formal]`, `[💻 Técnico]` e `[📝 Expandir]` executados on-device em 100-300ms via Rewriter API / Prompt API com opção de `[↩️ Desfazer]`.

### 🎯 Modos de Reunião Adaptativos & Contexto Customizado
- **4 Modos Especializados (`MODE-01` & `MODE-02`)**:
  - 🎯 **Entrevista Técnica**: Respostas diretas e objetivas em até 30s.
  - 🏗️ **System Design**: Requisitos funcionais/não-funcionais, escalabilidade e diagramas Mermaid.
  - 💻 **Code Review**: Padrões de projeto, qualidade de código, complexidade $O(N)$ e prevenção de bugs.
  - 📝 **Reunião Geral**: Síntese de discussões, decisões tomadas e Action Items.
- **Notas de Apoio em Markdown por Modo (`MODE-03`)**: Espaço dedicado para colar requisitos da vaga, regras de arquitetura ou diretrizes da empresa injetadas no prompt do LLM.

### 🎙️ Pipeline de Áudio & Silero VAD / RMS Energy Gate
- **Silero VAD Nativo (`AUDIO-01`)**: Filtro VAD nativo no `faster-whisper` (`min_silence_duration_ms=500, speech_pad_ms=400`) para descartar silêncios e ruídos de fundo antes do reconhecimento de fala.
- **RMS Energy Gate Local (`AUDIO-02`)**: O AudioWorklet (`pcm-worklet.js`) mede a energia RMS de cada bloco PCM 16kHz e descarta pacotes silenciosos localmente, economizando **80% de tráfego de rede e CPU**.
- **Indicador VAD no HUD**: Botão "Ouvindo" pulsa em verde radiante (`#22c55e`) durante a fala ativa e azul suave (`#818cf8`) em silêncio.
- **Controle de Sensibilidade**: Opções de limiar RMS nas configurações: Baixa (0.02), Média (0.01 - Padrão), Alta (0.005) e Desativado (0.0).

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

### Provedores de IA Suportados

O Orquestrador utiliza uma abstração desacoplada (`AnswerProvider`) que permite chavear facilmente entre múltiplos provedores de inteligência artificial:

| Provedor | Tipo | Requisitos | Exemplo de Uso |
| :--- | :--- | :--- | :--- |
| **✨ Google Gemini** | Nuvem | `GEMINI_API_KEY` | Gemini 1.5 Flash / Pro (padrão) |
| **🤖 OpenAI** | Nuvem | `openaiApiKey` | GPT-4o, GPT-4o-mini |
| **🧠 Anthropic** | Nuvem | `anthropicApiKey` | Claude 3.5 Sonnet, Claude 3 Haiku |
| **🏠 Ollama Local** | Local | `ollamaEndpoint` | Llama 3, Mistral, Codestral (100% offline) |
| **🌐 Proxy Agnóstico / API Customizada** | Nuvem / Local | `customProxyEndpoint`, `customProxyApiKey` | DeepSeek (`deepseek-chat`), Groq, OpenRouter, LM Studio |

### Modos de resposta

| Modo | Descrição | Uso recomendado |
| :--- | :--- | :--- |
| **Palavras-chave** | Apenas tópicos para citar | Conversa rápida |
| **Curto** (padrão) | 30–60 palavras | Entrevistas ao vivo |
| **Completo** | 80–150 palavras | Discussões técnicas |
| **Estruturado** | Abertura → Decisão → Justificativa → Trade-offs → Exemplo | Respostas complexas |

### Detecção de perguntas e tom

| Modo | Comportamento | Dados enviados para classificação externa |
| :--- | :--- | :--- |
| **Local** (padrão) | Perguntas e tom são classificados no orquestrador local | Nenhum |
| **Híbrido** | Valida perguntas ambíguas e refina o tom periodicamente | Resumo acumulado, oito falas finais recentes e modo da reunião |

Perguntas claras são sempre resolvidas localmente para preservar a baixa latência. A análise externa é assíncrona, possui timeout e não é iniciada enquanto uma resposta está sendo gerada. Essa opção controla somente a classificação de pergunta e tom; respostas e atas seguem o provedor configurado.

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

## Testes Automatizados

O projeto utiliza duas ferramentas de testes automatizados para garantir qualidade, resiliência e ausência de regressões:

### 1. Testes Unitários e de Integração (Vitest)

Testam os componentes do Orquestrador (`WhisperClient`, `ContextManager`, `QuestionDetector`, `ToneAnalyzer`, `ExternalConversationAnalyzer`, `AnswerProviderManager`, `meeting-modes.test.ts`, servidores Fastify WS/HTTP), os processadores locais Chrome AI, a medição de áudio VAD e o estado dos widgets (**134 testes aprovados**).

```bash
# Executa a suíte de testes unitários e de integração
npm test

# Modo de observação (watch)
npm run test:watch
```

### 2. Testes End-to-End — E2E (Playwright)

Carregam a extensão Chrome Manifest V3 compilada (`apps/chrome-extension/dist`) em uma instância real do Chromium com perfis isolados.

```bash
# Executa o build da extensão primeiro (obrigatório)
npm run build:extension

# Executa a suíte de testes E2E do Playwright
npm run test:e2e
```

**Cenários cobertos pelos testes E2E**:
- `overlay.spec.ts`: Injeção do container Shadow DOM (`#conversation-copilot-host`), barra de ferramentas HUD e disparo de eventos.
- `popup.spec.ts`: Interface de atalho e status de ativação da aba.
- `options.spec.ts`: Formulário de Perfil do Candidato (`SettingsForm`), dados da vaga e persistência no storage.
- `storage-history.spec.ts`: Listagem de reuniões salvas no `chrome.storage.local` e busca por palavra-chave.

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
│   │   ├── e2e/                # Suíte de testes End-to-End (Playwright)
│   │   ├── public/             # Asset estático do pcm-worklet.js
│   │   ├── src/
│   │   │   ├── background/     # Service Worker (roteamento de mensagens)
│   │   │   ├── content/        # Content Script + Overlay (Shadow DOM)
│   │   │   │   ├── widgets/    # Widgets React (FunctionBar, ResponsePanel, etc)
│   │   │   │   └── __tests__/  # Testes de widget e VAD meter
│   │   │   ├── offscreen/      # Captura de áudio, AudioWorklet e Chrome AI
│   │   │   │   ├── chrome-ai-processor.ts       # Correction & Summarization
│   │   │   │   ├── chrome-rewriter-processor.ts # Quick Rewrite Engine
│   │   │   │   └── pcm-worklet.js               # RMS Energy Gate Worklet
│   │   │   ├── options/        # Página de opções e histórico
│   │   │   ├── popup/          # Popup de configurações rápidas
│   │   │   └── shared/         # Componente SettingsForm com seletores
│   │   ├── manifest.json
│   │   └── vite.config.ts
│   ├── orchestrator/           # Orquestrador Node.js (Fastify)
│   │   ├── src/
│   │   │   ├── server.ts       # Servidor principal Fastify / WS
│   │   │   └── services/       # Serviços (ContextManager, QuestionDetector, Gemini, OpenAI, Anthropic, Ollama, CustomProxy, Whisper)
│   │   └── Dockerfile
│   └── transcription-service/  # Serviço Whisper (Python + FastAPI)
│       ├── main.py             # FastAPI + faster-whisper (Silero VAD=True)
│       └── Dockerfile          # GPU / CPU
├── packages/
│   └── shared-types/           # Tipos TypeScript compartilhados
├── docker-compose.yml          # Orquestração dos containers
├── .env.example                # Template de variáveis de ambiente
├── playwright.config.ts        # Configuração dos testes E2E Playwright
├── vitest.config.ts            # Configuração dos testes unitários Vitest
└── package.json                # Workspace root
```

---

## Licença

Projeto privado. Todos os direitos reservados.
