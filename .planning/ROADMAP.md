# Project Roadmap — conversation-copilot

> Roadmap de execução em fases para o desenvolvimento do Copiloto de Conversas.

---

## Past Milestones

- [Milestone v1.2 — Histórico, Busca, IA & Redesign UX/UI](milestones/v1.2-ROADMAP.md) — 3 fases (Phases 4-6), 8 requisitos concluídos (Shipped: 2026-07-28).
- [Milestone v1.1 — Resumo Automático da Reunião](milestones/1.1-ROADMAP.md) — 1 fase (Phase 3) (Shipped: 2026-07-27).
- [Milestone v1.0 — MVP](milestones/1.0-ROADMAP.md) — 2 fases (Phases 1-2) (Shipped: 2026-07-27).

---

## Current Milestone: v1.3 Chrome Built-in AI Pré-processador, Modos de Reunião & Áudio

### Phase 7: Chrome Built-in AI como Pré-processador Inteligente Local
**Goal:** Implementar o módulo `ChromeBuiltInAIProcessor` (Prompt API) para correção de jargões técnicos da transcrição Whisper, sumarização incremental da conversa e classificação de categoria on-device sem custo ou latência de nuvem.
**Requirements:** `CHROME-01`, `CHROME-02`, `CHROME-03`
**Plans:** 3 plans

Plans:
- [x] 07-01-PLAN.md — Tipos & Protocolo do Pré-processador Local
- [x] 07-02-PLAN.md — Módulo ChromeBuiltInAIProcessor no Offscreen Document
- [x] 07-03-PLAN.md — UI de Status de Fallback, Background Integration & Testes Unitários

---

### Phase 8: Modos de Reunião Adaptativos & Contexto Customizado
**Goal:** Implementar os 4 modos de reunião (Entrevista Técnica, System Design, Code Review, Geral), seletores visuais na UI (HUD/Popup), notas de apoio em Markdown por modo e Prompts de Sistema especializados no Orquestrador.
**Requirements:** `MODE-01`, `MODE-02`, `MODE-03`
**Plans:** 3 plans

Plans:
- [x] 08-01-PLAN.md — Tipos & Protocolo WebSocket para Modos de Reunião
- [x] 08-02-PLAN.md — Prompts de Sistema Adaptativos no Orquestrador
- [x] 08-03-PLAN.md — UI do Seletor de Modo & Notas de Apoio

---

### Phase 9: Pipeline de Áudio & Silero VAD / Otimização de Latência
**Goal:** Integrar o Silero VAD no serviço de transcrição Python (`faster-whisper`) e o RMS Energy Gate no Offscreen AudioWorklet para desconsiderar silêncio/ruídos e otimizar latência e consumo de CPU.
**Requirements:** `AUDIO-01`, `AUDIO-02`
**Plans:** 0 plans

Plans:
- [ ] TBD (gerado via `/gsd-plan-phase 9`)


---

## Backlog

### Phase 999.1: Integração com Chrome Built-in AI / Gemini Nano (BACKLOG)

**Goal:** Suportar inferência local no navegador via Chrome Built-in AI APIs (Prompt API, Writer API / Rewriter API) integradas ao Gemini Nano no Chrome, em conformidade com as diretrizes e políticas de uso do Google Generative AI.
**Context & References:**
- [Chrome Built-in AI Documentation](https://developer.chrome.com/docs/ai/built-in?hl=pt-br)
- [Google Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy)
- Writer API / Prompt API em Gemini Nano para redação e respostas sem depender do servidor local/remoto.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promover com /gsd-review-backlog quando pronto)

