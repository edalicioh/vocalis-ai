# Plano 3: Modos de Reunião e Suporte a Transcrição Geral (Não Apenas Entrevistas)

## Objetivo
Expandir e ajustar o suporte aos **Modos de Reunião** (`MeetingMode`), introduzindo ou aprimorando o modo **Reunião / Transcrição Geral** (`general` ou `transcription_only`). O objetivo é garantir que, quando o usuário estiver em uma reunião de equipe, conversa casual ou alinhamento comercial, o Copiloto atue primariamente como um **transcritor passivo com sumarização contínua de pontos principais**, em vez de tentar detectar perguntas técnicas e gerar respostas de entrevista de código.

---

## Escopo e Arquivos Afetados
- `packages/shared-types/src/messages.ts`: Definição de `MeetingMode` (garantir suporte completo aos modos `technical_interview`, `system_design`, `code_review`, `general`, `transcription_only`).
- `apps/chrome-extension/src/conversation/context-manager.ts` & `apps/orchestrator/src/services/context-manager.ts`: Prompt do sistema adaptativo para transcrição geral/reunião sem foco em entrevista.
- `apps/chrome-extension/src/detection/question-detector.ts`: Ajustar sensibilidade de auto-trigger no modo geral (desativar geração automática de respostas de código quando no modo transcrição).
- `apps/chrome-extension/src/content/widgets/FunctionBarWidget.tsx`: Seletor rápido de modo no HUD com ícone e rótulo claro para "Transcrição de Reunião".
- `apps/chrome-extension/src/shared/settings-form.tsx`: Opção para selecionar o **Modo Padrão de Reunião** preferido nas configurações globais.

---

## Detalhamento das Alterações

### 1. Atualização dos Tipos Compartilhados (`packages/shared-types/src/messages.ts`)
- Adicionar ou consolidar os modos:
```typescript
export type MeetingMode = 
  | 'technical_interview' // Entrevista Técnica de Programação
  | 'system_design'        // Arquitetura de Sistemas
  | 'code_review'          // Code Review / Pair Programming
  | 'general'              // Transcrição & Notas de Reuniões Gerais
  | 'transcription_only';  // Transcrição Pura sem Sugestões Automáticas
```
- **Nota Importante de Build**: Após alterar `packages/shared-types`, executar obrigatoriamente `npm run build:types` antes dos outros pacotes.

### 2. Configuração de Prompt e Comportamento no `ContextManager`
No `ContextManager`:
- Para `general` / `transcription_only`:
  - **Prompt de Sistema**: "Você é um assistente de reuniões. Seu objetivo é acompanhar a conversa, organizar pontos-chave, decisões tomadas e tarefas (action items). Não assuma o papel de um candidato em entrevista técnica. Seja conciso e direto."
  - Desativar a sugestão proativa automática de algoritmos/código quando o modo for `transcription_only`.

### 3. Ajuste no `QuestionDetector` / `GenerationManager`
- No `QuestionDetector`, se o `meetingMode` for `transcription_only`, pausar o envio automático de perguntas para geração de respostas LLM. As transcrições serão apenas exibidas na widget de transcrição.
- Se o modo for `general`, permitir geração manual sob demanda (quando o usuário clica no botão "Gerar Sugestão" ou usa a tecla de atalho `Alt+C`).

### 4. Interface do Usuário (HUD e Configurações)
- **`FunctionBarWidget.tsx`**: Exibir os chips de modo com rótulos amigáveis:
  - 📝 **Reunião Geral / Transcrição**
  - 🎯 **Entrevista Técnica**
  - 🏗️ **System Design**
  - 💻 **Code Review**
- **`settings-form.tsx`**: Adicionar campo de seleção do "Modo de Reunião Padrão ao Iniciar". O usuário pode salvar `general` como padrão se usa a ferramenta majoritariamente para reuniões de trabalho.

---

## Verificação e Testes

### Testes Automatizados
1. `npm run build:types`
2. `npm test`
3. Atualizar/Adicionar testes em `apps/chrome-extension/src/__tests__/client-orchestration.test.ts` e `apps/orchestrator/src/services/__tests__/meeting-modes.test.ts` validando a alteração de modo e o comportamento do prompt em modo `general` / `transcription_only`.

### Verificação Manual
1. Alterar o modo nas configurações para "Reunião Geral".
2. Iniciar a captura e simular uma conversa comum de reunião ("Vamos alinhar as entregas da sprint e a priorização da task X").
3. Confirmar que o sistema exibe as transcrições limpas sem disparar sugestões de respostas técnicas de entrevista de emprego.
4. Trocar rapidamente de modo na barra HUD para "Entrevista Técnica" e validar o retorno das sugestões automatizadas.
