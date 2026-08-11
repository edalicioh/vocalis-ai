# Plano 1: Captura Desativada e Painel Fechado por Padrão

## Objetivo
Garantir que ao carregar qualquer página (mesmo páginas de reunião como Google Meet ou Teams), a captura de áudio esteja **estritamente desativada** por padrão (`isCapturing = false`) e os painéis flutuantes (resposta e transcrição) estejam **fechados/ocultos por padrão**, sem que a extensão inicie escuta indesejada ou abra widgets na tela sem a ação explícita do usuário.

---

## Escopo e Arquivos Afetados
- `apps/chrome-extension/src/content/widget-state.ts`: Ajustar estados padrão dos widgets.
- `apps/chrome-extension/src/content/overlay.tsx`: Ajustar a inicialização do estado de captura e de visibilidade inicial.
- `apps/chrome-extension/src/popup/popup.tsx`: Garantir exibição correta do estado desativado.
- `apps/chrome-extension/src/__tests__/client-orchestration.test.ts`: Adicionar/atualizar testes unitários para inicialização passiva.

---

## Detalhamento das Alterações

### 1. Ajuste em `widget-state.ts`
- Modificar `getDefaultStates()` para assegurar que todos os widgets flutuantes de conteúdo (`response`, `transcription`, `status`) sejam inicializados com `visible: false`.
- Apenas a barra de funções (`functionBar`) pode permanecer visível de forma discreta/minimizada ou ser exibida como um gatilho fechado (ou botão de ativação), enquanto a captura não for ativada pelo usuário.

```typescript
export function getDefaultStates(): WidgetStatesMap {
  return {
    functionBar: { visible: true, minimized: false },
    status: { visible: false, minimized: false },
    response: { visible: false, minimized: false },
    transcription: { visible: false, minimized: false }
  };
}
```

### 2. Comportamento no `CopilotOverlay` (`overlay.tsx`)
- Garantir que `isCapturing` inicie como `false`.
- Ao carregar a página, não abrir automaticamente os painéis de `response` e `transcription`, independente dos valores anteriormente salvos em `localStorage` para a sessão anterior, a menos que a captura esteja ativada.
- Quando o usuário clicar em **"Iniciar captura"** (seja no `FunctionBarWidget` ou no `popup.tsx`), o manipulador `handleToggleCapture()` deve:
  1. Alterar `isCapturing` para `true`.
  2. Expandir/tornar visíveis os widgets `transcription` e `response`.
- Ao clicar em **"Parar captura"**, ocultar/fechar os painéis de transcrição e resposta, voltando ao estado fechado padrão.

### 3. Validação no `popup.tsx`
- Garantir que a UI do Popup exiba o estado **"Captura desativada"** e o botão com rótulo "Iniciar captura" por padrão.
- Não executar chamadas automáticas de `START_CAPTURE` sem a ação explícita do usuário.

---

## Verificação e Testes

### Testes Automatizados
- Executar `npm test` para validar que a inicialização do estado dos widgets e da orquestração do cliente se mantêm consistentes.
- Criar/Atualizar teste em `apps/chrome-extension/src/__tests__/client-orchestration.test.ts` verificando que o estado inicial de `isCapturing` é `false` e que `getDefaultStates()` retorna os painéis ocultos por padrão.

### Verificação Manual
1. Abrir uma reunião no Google Meet (`https://meet.google.com/xyz`).
2. Confirmar que o painel do Copiloto é injetado, porém a captura de áudio permanece **desativada** e os painéis de resposta/transcrição **permanecem fechados**.
3. Clicar no botão de ativação de captura (no HUD ou no Popup).
4. Verificar que os painéis de transcrição e resposta se abrem automaticamente ao iniciar a captura.
5. Clicar em "Parar captura" e verificar que a captura encerra e os painéis retornam ao estado fechado.
