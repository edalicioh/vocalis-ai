# Copiloto de Conversas e Entrevistas Técnicas

> Assistente local integrado ao navegador que captura áudio de reuniões em tempo real, realiza transcrição via Whisper local, detecta perguntas e gera sugestões contextuais curtas via Gemini em um painel flutuante sobre a conversa.

---

## Core Value

Apresentar sugestões contextuais curtas, precisas e em tempo quase real (com leitura opcional por TTS e baixa latência) durante reuniões ou entrevistas técnicas sem que a interface obstrua a chamada do usuário.

---

## Context

- **Problema**: Acompanhar entrevistas técnicas ou reuniões densas exige lembrar conceitos rapidamente e estruturar respostas sem perder o foco na conversa ao vivo.
- **Solução**: Uma extensão Chrome acoplada a um orquestrador local e serviço Whisper que transcrevem e analisam a fala continuada, sugerindo respostas pontuais e palavras-chave em um painel flutuante adaptável.
- **Restrições Principais**:
  - Processamento de transcrição 100% local com `faster-whisper` (privacidade e latência).
  - Interface injetada via Shadow DOM para evitar conflitos de CSS com Google Meet, Zoom ou Teams.
  - Provedor de IA substituível (`AnswerProvider` desacoplado).
  - Idioma único: Português do Brasil (`pt-BR`).

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

### Active (Milestone v1.2 — Histórico, Busca & Provedores de IA)

- [ ] **AI-04**: Suporte ao provedor OpenAI (GPT-4o) e Anthropic (Claude 3.5) via `AnswerProvider`
- [ ] **AI-05**: Suporte a modelos de IA locais via Ollama (Llama 3 / Mistral)

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
| Provedor de IA com interface `AnswerProvider` | Permitir alternar entre Gemini e outros provedores de LLM | `gemini.ts` implementa a interface abstrata |

---

## Evolution

Este documento evolui a cada transição de fase ou marco concluído.

**Após cada transição de fase** (via `/gsd-transition`):
1. Requisitos validados? → Mover de Active para Validated
2. Novos requisitos emergiram? → Adicionar a Active
3. Decisões tomadas? → Adicionar a Key Decisions

---
*Last updated: 2026-07-27 após inicialização do projeto GSD*
