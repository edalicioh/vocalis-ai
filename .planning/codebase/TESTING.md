# Testing Reference — conversation-copilot

> Estratégia de testes, saúde do ambiente e procedimentos de verificação do projeto.

---

## Estado Atual dos Testes Automáticos

> [!NOTE]
> Atualmente não há framework de testes automatizados (como Jest, Vitest ou PyTest) ou linters configurados na raiz deste repositório.

A validação de funcionalidades do ecossistema é realizada por meio de **Health Checks de serviços** e **Verificação Manual Interativa (UAT)**.

---

## Health Checks de Infraestrutura & Serviços

Cada serviço do repositório oferece endpoints de saúde monitorados pelo Docker Compose:

### 1. Orquestrador (`apps/orchestrator`)
- **Endpoint HTTP**: `http://localhost:3001/health`
- **Comando de Teste**:
  ```bash
  curl http://localhost:3001/health
  ```
- **Critério de Sucesso**: Retorna código `200 OK` indicando que o servidor Fastify e as rotas WebSocket estão ativas.

### 2. Serviço de Transcrição Whisper (`apps/transcription-service`)
- **Endpoint HTTP**: `http://localhost:8000/health`
- **Comando de Teste**:
  ```bash
  curl http://localhost:8000/health
  ```
- **Tempo de Inicialização**: O serviço leva de 30 a 90 segundos no primeiro boot enquanto o modelo Whisper (ex: `small`) é carregado na memória GPU/CPU. O healthcheck aguarda este período.

---

## Procedimentos de Validação e Build (Smoke Testing)

Para garantir que as alterações no código não quebraram as dependências ou compilação:

### 1. Validação dos Tipos Compartilhados
```bash
npm run build:types
```
*Verifica se `packages/shared-types` compila sem erros TypeScript em `packages/shared-types/dist/`.*

### 2. Validação da Extensão Chrome
```bash
npm run build:extension
```
*Gera o bundle final da extensão em `apps/chrome-extension/dist/`, incluindo a compilação do `content-script.js` em formato IIFE.*

### 3. Validação do Orquestrador
```bash
npm run build:orchestrator
```
*Verifica se o TypeScript do orquestrador em `apps/orchestrator/src` compila sem erros.*

---

## Recomendações para Suporte Futuro a Testes
- Adicionar **Vitest** em `packages/shared-types` e `apps/orchestrator` para testes unitários das regras de heurística de perguntas (`QuestionDetector`) e gerenciamento de contexto (`ContextManager`).
- Implementar mocks para as APIs do `chrome.*` no frontend para permitir testes unitários no React com React Testing Library.
