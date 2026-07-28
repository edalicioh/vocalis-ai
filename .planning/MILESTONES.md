# Milestones

## 1.2 v1.2 Histórico, Busca, IA & Redesign UX/UI (Shipped: 2026-07-28)

**Phases completed:** 3 phases (Phase 4, Phase 5, Phase 6), 3 plans, 8 requirements (`HIST-01`, `HIST-02`, `AI-04`, `AI-05`, `UI-01`, `UI-02`, `UI-03`, `UI-04`)

**Key accomplishments:**

- Interface na aba de opções com pesquisa textual em tempo real nas reuniões salvas localmente e exportação em Markdown (`HIST-01`, `HIST-02`).
- Integração com múltiplos provedores de IA: OpenAI (GPT-4o), Anthropic (Claude 3.5) e Ollama (inferência 100% offline) via `AnswerProviderManager` com troca dinâmica (`AI-04`, `AI-05`).
- Decomposição do overlay monolítico em 4 widgets HUD independentes (Barra de Funções, Resposta, Transcrição, Status) em Shadow DOM com arraste livre (`drag-to-move`) e salvamento de estado em `localStorage` (`UI-01`, `UI-02`).
- Adoção completa do Design System `MASTER.md` com estética dark OLED glassmorphism, ícones Lucide SVG, destaque visual de frase em tempo real durante leitura por TTS e 4 modos de layout visual (`UI-03`, `UI-04`).

---

## 1.1 v1.1 Resumo Automático da Reunião (Shipped: 2026-07-27)

**Phases completed:** 1 phase (Phase 3), 1 plan

**Key accomplishments:**

- Geração automática de atas e resumos estruturados ao encerrar reuniões.

---

## 1.0 v1.0 MVP (Shipped: 2026-07-27)

**Phases completed:** 2 phases (Phase 1, Phase 2)

**Key accomplishments:**

- Captura de áudio via Offscreen Document, transcrição Whisper local e geração de sugestões em tempo real com Gemini em painel flutuante.

---
