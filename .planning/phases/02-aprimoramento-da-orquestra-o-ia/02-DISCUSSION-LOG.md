# Phase 2: Aprimoramento da Orquestração & IA - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 02-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 02-aprimoramento-da-orquestra-o-ia
**Areas discussed:** Estrutura do Prompt, Cancelamento de Streaming, Janela de Histórico

---

## Formatação do Prompt (Perfil & Vaga)

| Option | Description | Selected |
|--------|-------------|----------|
| `systemInstruction` em Markdown estruturado | Injetar perfil do candidato e detalhes da vaga via `systemInstruction` do SDK Gemini em blocos `[PERFIL DO CANDIDATO]` e `[DETALHES DA VAGA]` | ✓ |
| Mensagem de contexto no início da conversa | Anexar dados de vaga/perfil como primeira mensagem de usuário no histórico | |

**User's choice:** `systemInstruction` em Markdown estruturado

---

## Cancelamento de Streaming

| Option | Description | Selected |
|--------|-------------|----------|
| `AbortController` + evento `answer.cancelled` | Abortar a chamada HTTP via `AbortController`, emitir `answer.cancelled` via WS e zerar a sugestão ativa no painel | ✓ |
| Ignorar deltas sem cancelar requisição | Manter a chamada Gemini rodando no servidor e apenas descartar pacotes recebidos | |

**User's choice:** Abortar via `AbortController` + emitir evento WS `answer.cancelled` + limpar sugestão no painel
