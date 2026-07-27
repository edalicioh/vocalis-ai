# Conventions Reference — conversation-copilot

> Padrões de código, estilo, nomenclatura, tratamento de erros e convenções do projeto.

---

## Idioma Padrão
- **Obrigatoriedade**: Todo texto de interface do usuário, comentários de código, especificações e documentação técnica deve ser estritamente em **Português do Brasil (`pt-BR`)**.

---

## Nomenclatura e Estilo de Código

### 1. Nomenclatura de Arquivos e Pastas
- **Arquivos TypeScript/React**: Kebab-case para scripts e utilitários (`context-manager.ts`, `question-detector.ts`); PascalCase para componentes React quando aplicável (`CopilotOverlay` em `overlay.tsx`).
- **Protocolo de Mensagens WebSocket**: Notação de ponto minúscula (`dot.notation`) em `type` (ex: `session.start`, `transcript.final`, `answer.delta`, `question.detected`).

### 2. Estilização da Extensão Chrome (Shadow DOM)
- O `content-script.ts` injeta a interface do painel flutuante dentro de um container isolado em **Shadow DOM** (`open`).
- **Regra de Estilo**: Usar estilos inline React (`React.CSSProperties`) combinados com a injeção de `<style>` dentro do Shadow DOM para pseudo-classes (ex: `:hover`, scrollbars, animações keyframes).
- **Proibição**: Não utilizar frameworks CSS runtime (Tailwind ou CSS-in-JS pesado) no content-script que dependam de loaders adicionais em tempo de execução ou afetem a página hospedeira da reunião.

---

## Padrões de Arquitetura e Código TypeScript

### 1. Resolução de Importações e Módulos
- Módulos no ecossistema usam ES Modules. No Orquestrador e pacotes TypeScript, importações de arquivos locais requerem a extensão `.js` explicita (ex: `import { GeminiProvider } from './services/gemini.js';`).
- O pacote `@conversation-copilot/shared-types` deve ser compilado via `npm run build:types` antes que os outros pacotes do monorepo resolvam suas referências.

### 2. Tratamento de Erros e Resiliência
- **Streams e Conexões WS**: Todas as escutas e manipulações de mensagens WebSocket devem implementar blocos `try/catch` seguros, tratando desconexões inesperadas sem crashar a aplicação.
- **Failovers e Timeouts**: Requisições de IA (Gemini) possuem tratadores de timeout e emitem eventos de `answer.failed` ou `answer.cancelled` para atualizar o estado do cliente no painel.

---

## Persistência de Preferências do Usuário (Navegador)
- Configurações do painel na extensão Chrome utilizam `localStorage` (com fallback seguro):
  - `copilotPosition`: Posição X e Y do painel no viewport
  - `copilotDimensions`: Largura e altura ajustadas pelo usuário
  - `copilotOpacity`: Nível de transparência do painel
  - `copilotPanelMode`: Modo de exibição (`normal`, `compact`, `keywords-only`, `transcription-only`)
