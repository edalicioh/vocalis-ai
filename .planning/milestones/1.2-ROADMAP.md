# Project Roadmap — conversation-copilot

> Roadmap de execução em fases para o desenvolvimento do Copiloto de Conversas.

---

## Vision & Milestones

### Milestone v1.2 — Histórico, Busca & Provedores de IA (Fase Atual)

| Phase | Title | Goal | Requirements | Success Criteria |
|:---|:---|:---|:---|:---|
| **Phase 4** | Histórico & Busca de Reuniões | Armazenar histórico de reuniões passadas no banco local e permitir busca rápida por palavra-chave na extensão. | `HIST-01`, `HIST-02` | 2 critérios |
| **Phase 5** | Suporte a Novos Provedores de IA | Adicionar suporte aos provedores OpenAI (GPT-4o), Anthropic (Claude 3.5) e Ollama (local) via `AnswerProvider`. | `AI-04`, `AI-05` | 2 critérios |

---

## Phase Details

### Phase 4: Histórico & Busca de Reuniões
**Goal**: Armazenar histórico de reuniões passadas no banco local e permitir busca rápida por palavra-chave na extensão.
**Requirements**: `HIST-01`, `HIST-02`
**UI Hint**: yes
**Success Criteria**:
1. O usuário pode visualizar a lista de reuniões gravadas anteriormente na tela de opções ou popup da extensão.
2. É possível realizar busca textual por palavra-chave nas transcrições e atas gravadas com filtragem instantânea.

### Phase 5: Suporte a Novos Provedores de IA
**Goal**: Adicionar suporte aos provedores OpenAI (GPT-4o), Anthropic (Claude 3.5) e Ollama (local) via `AnswerProvider`.
**Requirements**: `AI-04`, `AI-05`
**UI Hint**: no
**Success Criteria**:
1. O orquestrador permite selecionar o provedor ativo (Gemini, OpenAI, Anthropic ou Ollama) via configurações.
2. As chamadas em streaming mantêm a mesma interface `AnswerProvider` e suporte a cancelamento por `AbortController`.
