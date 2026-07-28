# Copiloto de Conversas e Entrevistas Técnicas

> Assistente local integrado ao navegador que captura áudio de reuniões em tempo real, realiza transcrição via Whisper local, detecta perguntas e gera sugestões contextuais curtas via Gemini/OpenAI/Anthropic/Ollama em 4 widgets HUD flutuantes sobre a conversa.

---

## Core Value

Apresentar sugestões contextuais curtas, precisas e em tempo quase real (com leitura opcional por TTS e baixa latência) durante reuniões ou entrevistas técnicas sem que a interface obstrua a chamada do usuário.

---

## Context

- **Problema**: Acompanhar entrevistas técnicas ou reuniões densas exige lembrar conceitos rapidamente e estruturar respostas sem perder o foco na conversa ao vivo.
- **Solução**: Uma extensão Chrome acoplada a um orquestrador local e serviço Whisper que transcrevem e analisam a fala continuada, sugerindo respostas pontuais e palavras-chave em 4 widgets flutuantes HUD adaptáveis.
- **Restrições Principais**:
  - Processamento de transcrição 100% local com `faster-whisper` (privacidade e latência).
  - Interface injetada via Shadow DOM para evitar conflitos de CSS com Google Meet, Zoom ou Teams.
  - Provedores de IA substituíveis (`AnswerProvider` desacoplado: Gemini, OpenAI, Anthropic, Ollama).
  - Idioma único: Português do Brasil (`pt-BR`).

---

## Current Milestone: v1.3 Chrome Built-in AI, Modos de Reunião & Otimizações de Áudio

**Goal:** Integrar a IA nativa do Chrome (Gemini Nano) para inferência local zero-latency sem API keys, expandir a inteligência de contexto com modos adaptativos de reunião e aprimorar o VAD/latência do áudio Whisper.

**Target features:**
- Provedor nativo Chrome Built-in AI (Prompt API e Writer API) em `AnswerProviderManager`.
- Modos de Reunião Adaptativos (Entrevista Técnica, System Design, Code Review, Alinhamento) com injeção de contexto customizado.
- Otimização do pipeline de áudio & Whisper com Voice Activity Detection (VAD) e controle dinâmico de latência.

---

## Requirements

### Validated (Já existentes na base de código)

- ✓ **CAP-01**: Captura de áudio de abas via Chrome Offscreen Document e Web Audio API — existing
- ✓ **TRANS-01**: Transcrição local em tempo real utilizando `faster-whisper` (GPU/CPU) via WebSocket — existing
- ✓ **ORCH-01**: Servidor Orquestrador Node.js + Fastify gerenciando a sessão e conexões WS — existing
- ✓ **AI-01**: Integração em streaming com a API Google Gemini (`GeminiProvider`) — existing
- ✓ **UI-01**: Painel flutuante injetado no Shadow DOM com suporte a arrasto — existing
- ✓ **TTS-01**: Leitura assistida de respostas usando a API Web Speech Synthesis do navegador — existing
- ✓ **UI-02**: Redimensionamento livre por arrasto (drag-to-resize, limites 280-700px / 200px-90vh) com salvamento em `localStorage` — Validated em Phase 1
- ✓ **UI-03**: Slider visual de ajuste de opacidade/transparência no painel flutuante com persistência — Validated em Phase 1
- ✓ **UI-04**: Atalho rápido para minimizar o painel (duplo clique no header ou atalho de teclado) — Validated em Phase 1
- ✓ **UI-05**: Feedback visual em toast ao copiar o texto das sugestões ("Copiado! ✓") — Validated em Phase 1
- ✓ **AI-02**: Injeção dinâmica do Perfil Profissional e Descrição da Vaga no contexto do prompt — Validated em Phase 2
- ✓ **AI-03**: Suporte a cancelamento imediato de streaming quando nova pergunta for detectada — Validated em Phase 2
- ✓ **DOC-01**: Geração automática de ata em Markdown (Resumo Executivo, Decisões, Action Items e Transcrição) ao parar a captura — Validated em Phase 3
- ✓ **DOC-02**: Download sob demanda e salvamento local de atas em formato `.md` no painel flutuante — Validated em Phase 3
- ✓ **HIST-01**: Armazenar histórico de reuniões passadas no banco local da extensão — Validated em Phase 4
- ✓ **HIST-02**: Busca textual rápida por palavras-chave nas reuniões e atas gravadas — Validated em Phase 4
- ✓ **AI-04**: Suporte ao provedor OpenAI (GPT-4o) e Anthropic (Claude 3.5) via `AnswerProvider` — Validated em Phase 5
- ✓ **AI-05**: Suporte a modelos de IA locais via Ollama (Llama 3 / Mistral) — Validated em Phase 5
- ✓ **UI-01 (v1.2)**: Decomposição do overlay monolítico em 4 widgets HUD flutuantes independentes — Validated em Phase 6
- ✓ **UI-02 (v1.2)**: Arraste livre (`drag-to-move`), minimização e persistência de posições dos 4 widgets em `localStorage` — Validated em Phase 6
- ✓ **UI-03 (v1.2)**: Design System `MASTER.md` (dark OLED glassmorphism, fonte Inter, ícones Lucide SVG) — Validated em Phase 6
- ✓ **UI-04 (v1.2)**: Destaque visual por sentença no TTS e 4 modos de layout visual — Validated em Phase 6

### Active (Milestone v1.3: Chrome Built-in AI, Modos de Reunião & Áudio)

- **AI-06**: Suporte ao provedor nativo Chrome Built-in AI (Gemini Nano) via Prompt API e Writer API no `AnswerProviderManager`
- **CTX-01**: Modos de Reunião Adaptativos (Entrevista Técnica, System Design, Code Review, Alinhamento) com contexto configurável
- **AUDIO-01**: Otimização do pipeline de áudio com Voice Activity Detection (VAD) e refinamento de latência do Whisper

### Out of Scope (Fora do Escopo Inicial)

- Gravação de vídeo da reunião — *Foco exclusivo em áudio/texto para manter performance*
- Reconhecimento facial ou análise emocional — *Fora do propósito de assistência técnica*
- Agente autônomo com execução de código ou busca na web — *Evitar latência e alucinações durante a fala*
- Aplicativo móvel ou suporte a múltiplos navegadores — *Restrito a Google Chrome no MVP*

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Shadow DOM no Content Script | Isolar CSS da extensão das páginas hospedeiras (Meet, Teams) | Injeção via `React.CSSProperties` e `<style>` internas |
| WebSocket com notação de ponto | Padronizar protocolo bidirecional entre extensão, orquestrador e Whisper | Schema unificado em `packages/shared-types` |
| `faster-whisper` local em Docker | Manter privacidade do áudio e reduzir latência de rede | Containers com perfis GPU (CUDA) e CPU |
| Provedores de IA via `AnswerProvider` | Suportar Gemini, OpenAI, Anthropic e Ollama local | Alternância dinâmica no `AnswerProviderManager` |
| Arquitetura HUD de 4 Widgets | Modularizar a experiência visual do copiloto | 4 widgets independentes com Lucide icons e layout configurável |

---

## Evolution

*Last updated: 2026-07-28 após conclusão e arquivamento do Milestone v1.2*
