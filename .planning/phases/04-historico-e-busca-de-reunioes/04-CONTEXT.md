# Phase 4: Histórico & Busca de Reuniões - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase compreende a criação do banco local de armazenamento e interface de busca rápida por palavra-chave para conversas, transcrições e atas de reuniões passadas salvas na Extensão Chrome.
</domain>

<decisions>
## Implementation Decisions

### Interface de Busca e Histórico
- **D-01:** Criar aba dedicada "📚 Histórico" na tela de opções da extensão (`src/options/options.tsx`), permitindo visualizar e pesquisar todas as reuniões armazenadas.
- **D-02:** Adicionar botão de atalho rápido de acesso ao histórico na barra de ferramentas do painel flutuante (`overlay.tsx`).

### Mecanismo de Busca Textual
- **D-03:** Implementar busca por palavra-chave em tempo real (instantânea) que filtra reuniões por correspondência de texto no título, URL da página, falas da transcrição e atas em Markdown.
- **D-04:** Destacar visualmente (*highlight*) as ocorrências das palavras-chave pesquisadas nos resultados da busca.

### Gerenciamento de Dados
- **D-05:** Reutilizar o `conversation-storage.ts` (`chrome.storage.local`) mantendo limite seguro de até 50 reuniões com suporte a exclusão individual e download sob demanda do arquivo `.md`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `apps/chrome-extension/src/shared/conversation-storage.ts` — API de armazenamento `getSavedConversations`, `saveConversation`, `deleteConversation`
- `apps/chrome-extension/src/options/options.tsx` — Interface da página de opções da extensão
- `apps/chrome-extension/src/content/overlay.tsx` — Painel flutuante e atalhos de ferramentas
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getSavedConversations` e `deleteConversation` em `apps/chrome-extension/src/shared/conversation-storage.ts`: MÉTODOS JÁ EXISTENTES para ler e apagar histórico do `chrome.storage.local`.
- `triggerMarkdownDownload` em `apps/chrome-extension/src/shared/conversation-storage.ts`: Exportação para arquivo `.md`.

### Integration Points
- `options.tsx`: Interface React que exibe formulários de configurações e pode ser estendida com abas.
</code_context>

<specifics>
## Specific Ideas

- A busca deve ignorar case (case-insensitive) e ignorar acentuação simples para facilitar a localização durante a digitação rápida.
</specifics>

<deferred>
## Deferred Ideas

- Sincronização em nuvem via Google Drive ou Dropbox.
</deferred>

---
*Phase: 04-historico-e-busca-de-reunioes*
*Context gathered: 2026-07-27*
