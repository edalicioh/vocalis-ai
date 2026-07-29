# Registro de Alterações (Changelog) - Vocalis AI

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.0.0] - 2026-07-29

### Adicionado
- **Orquestrador Fastify & WebSocket**: Servidor central em TypeScript com suporte a protocolo bidirecional por mensagens em notação de ponto (`dot.notation`).
- **Serviço de Transcrição Whisper Local**: Servidor Python com FastAPI e `faster-whisper` integrado com Silero VAD (`vad_filter=True`).
- **Extensão Chrome (Manifest V3)**:
  - Painel flutuante em React injetado via Shadow DOM com suporte a redimensionamento dinâmico (*drag-to-resize*), controle de opacidade, minimização por duplo clique e suporte a cópia com toast visual.
  - Processamento de áudio offscreen a 16kHz com detector de áudio ativo (RMS Energy Gate) economizando tráfego WebSocket.
  - Suporte a leitura de áudio por TTS (Web Speech Synthesis API).
- **Processamento de IA On-Device (Chrome Built-in AI)**:
  - `ChromeBuiltInAIProcessor`: Correção ortográfica passiva e silenciosa de jargões de TI usando Prompt API (`window.ai.languageModel`).
  - `ChromeRewriterProcessor`: Reescrita instantânea on-device em 100-300ms via Rewriter API com chips de ação rápida (*Encurtar*, *Formal*, *Técnico*, *Expandir*) e suporte a desfazer.
- **Modos de Reunião Adaptativos**:
  - 4 modos nativos: `technical_interview`, `system_design`, `code_review` e `general`.
  - Prompts de sistema customizados e suporte a notas de apoio Markdown (`modeNotes`).
- **Provedores de IA Flexíveis**:
  - SDK Google Gemini nativo + suporte a OpenAI, Anthropic, Ollama e `CustomProxyProvider` (OpenRouter, Groq, DeepSeek).
- **Suíte de Testes & Qualidade**:
  - 107 testes unitários e de integração com Vitest.
  - Testes E2E completos no navegador Chromium via Playwright cobrindo Overlay, Opções, Popup e Histórico.
- **Licenciamento & Identidade**:
  - Licença GNU General Public License v2.0 (`GPL-2.0-only`).
  - Identidade visual **Vocalis AI** com marca 3D Glassmorphism e documentação completa em `BRAND_BRIEF.md`.
