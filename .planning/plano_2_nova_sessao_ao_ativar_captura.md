# Plano 2: Nova Sessão ao Ativar a Captura

## Objetivo
Garantir que sempre que a captura de áudio for ativada pelo usuário (transição de `isCapturing: false` para `true`), uma **nova sessão isolada** seja gerada com um ID de sessão inédito (`sessionId`), limpando o contexto, as transcrições e as sugestões anteriores para evitar a contaminação do histórico de chamadas passadas.

---

## Escopo e Arquivos Afetados
- `apps/chrome-extension/src/content/content-script.ts`: Função auxiliar para renovação dinâmica de `TAB_SESSION_ID`.
- `apps/chrome-extension/src/content/overlay.tsx`: Disparar `createNewSession()` ao iniciar a captura e resetar os estados da UI.
- `apps/chrome-extension/src/background/service-worker.ts`: Registrar e associar a nova sessão da aba no background.
- `apps/chrome-extension/src/conversation/context-manager.ts`: Limpar o histórico da janela deslizante e contexto anterior na troca de sessão.
- `apps/chrome-extension/src/__tests__/client-orchestration.test.ts`: Adicionar testes para validação de reset de sessão.

---

## Detalhamento das Alterações

### 1. Geração Dinâmica de ID de Sessão em `content-script.ts`
- Substituir a constante estática `TAB_SESSION_ID` por uma variável mutável ou getter/função `createSessionId()`.
- Ao receber o evento de solicitação de nova sessão ou comando `START_CAPTURE`, gerar uma nova chave única:
  `session-tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`.

```typescript
let currentTabSessionId = generateSessionId();

export function generateSessionId(): string {
  return 'session-tab-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

export function resetTabSessionId(): string {
  currentTabSessionId = generateSessionId();
  return currentTabSessionId;
}
```

### 2. Reinicialização de Estado no `CopilotOverlay` (`overlay.tsx`)
No manipulador `handleToggleCapture()` ao mudar para `isCapturing = true`:
1. Chamar `resetTabSessionId()` para obter o novo `sessionId`.
2. Resetar todos os estados locais da interface:
   - `setTranscriptions([])`
   - `setCompletedSuggestions([])`
   - `setActiveSuggestion(null)`
   - `setDetectedQuestion(null)`
   - `setPartialTranscript('')`
3. Enviar mensagem de registro para o `service-worker`:
   `chrome.runtime.sendMessage({ type: 'REGISTER_TAB_SESSION', sessionId: newSessionId })`.
4. Enviar mensagem `session.start` com o novo `sessionId` via WebSocket ao `ContextManager` / backend.

### 3. Associação e Limpeza no Backend / ContextManager
- Garantir que a recepção de `session.start` com um novo `sessionId` execute `contextManager.clearContext()` ou recrie a instância do gerenciador de contexto associada à aba.
- Garantir que pacotes de áudio ou mensagens de transcrição anteriores associados ao `sessionId` antigo sejam descartados ou finalizados na sessão arquivada.

---

## Verificação e Testes

### Testes Automatizados
- Executar `npm test`.
- Criar teste em `client-orchestration.test.ts` verificando que a chamada a `startSession()` ou alternância de captura gera um novo ID de sessão e limpa as listas de transcrições e sugestões acumuladas.

### Verificação Manual
1. Iniciar a captura de áudio em uma reunião e gerar algumas transcrições e sugestões.
2. Clicar em "Parar captura".
3. Clicar em "Iniciar captura" novamente.
4. Verificar se a interface e o painel de transcrição limparam todo o histórico anterior e iniciaram com uma contagem/sessão zerada.
5. Inspecionar o console do navegador e do serviço de transcrição para confirmar a recepção de `session.start` com o novo `sessionId`.
