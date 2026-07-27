<!-- GSD:project-start source:PROJECT.md -->
## Project

**Copiloto de Conversas e Entrevistas Técnicas**

**Core Value:** Apresentar sugestões contextuais curtas, precisas e em tempo quase real (com leitura opcional por TTS e baixa latência) durante reuniões ou entrevistas técnicas sem que a interface obstrua a chamada do usuário.

---
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Linguagens & Runtimes
| Tecnologia | Versão | Uso / Componente |
|:---|:---|:---|
| **TypeScript** | `~5.3.3` | Orquestrador (`apps/orchestrator`), Extensão (`apps/chrome-extension`), Tipos Compartilhados (`packages/shared-types`) |
| **Node.js** | `>=20.0.0` | Runtime do Orquestrador Fastify |
| **Python** | `>=3.10` | Servidor de transcrição (`apps/transcription-service`) |
| **HTML5 / CSS3** | - | UI da extensão Chrome (React inline CSS + Shadow DOM) |
## Monorepo & Workspaces
- **Gerenciador de Pacotes**: `npm` com Workspaces (`packages/*`, `apps/*`)
- **Build order**: `packages/shared-types` -> `apps/orchestrator` / `apps/chrome-extension`
## Frameworks & Bibliotecas Principais
### Orquestrador (`apps/orchestrator`)
- **Fastify** (`^4.26.1`): Web server HTTP e WebSocket (`@fastify/websocket ^10.0.1`, `@fastify/cors ^9.0.1`)
- **@google/generative-ai** (`^0.21.0`): SDK oficial da Google para integração com a API Gemini
- **ws** (`^8.16.0`): Cliente WebSocket para comunicação bidirecional com o serviço Whisper
- **zod** (`^3.22.4`): Validação de esquemas e payload de mensagens
- **dotenv** (`^16.4.5`): Carregamento de variáveis de ambiente
- **tsx** (`^4.7.1`): Executor TypeScript em ambiente de desenvolvimento (`tsx watch`)
### Extensão Chrome (`apps/chrome-extension`)
- **React** (`^18.2.0`): Biblioteca de UI para painel flutuante, popup e opções
- **React DOM** (`^18.2.0`): Renderizador React no Shadow DOM do content script e páginas de extensão
- **Vite** (`^5.1.3`): Bundler rápido com plugin `@vitejs/plugin-react` + compilador IIFE customizado para content-script
- **lucide-react** (`^0.330.0`): Biblioteca de ícones SVG
- **@types/chrome** (`^0.0.260`): Definições de tipo da API Chrome Extension Manifest V3
### Serviço de Transcrição (`apps/transcription-service`)
- **FastAPI** (`>=0.109.0`): Framework web assíncrono Python com suporte nativo a WebSockets
- **uvicorn** (`>=0.27.0`): Servidor ASGI de alta performance
- **faster-whisper** (`>=0.10.0`): Re-implementação do OpenAI Whisper utilizando CTranslate2 (suporte GPU/CUDA e CPU)
- **pydantic** (`>=2.0.0`): Validação de dados e dados estruturados
- **numpy** (`>=1.24.0`): Processamento numérico de buffers de áudio PCM
## Infraestrutura & Containerização
- **Docker Compose**: Perfis de execução `gpu`, `cpu` e `dev` (`docker-compose.yml`)
- **CUDA / NVIDIA Container Toolkit**: Suporte a GPU NVIDIA para aceleração de inferência do Whisper no perfil `gpu`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Idioma Padrão
- **Obrigatoriedade**: Todo texto de interface do usuário, comentários de código, especificações e documentação técnica deve ser estritamente em **Português do Brasil (`pt-BR`)**.
## Nomenclatura e Estilo de Código
### 1. Nomenclatura de Arquivos e Pastas
- **Arquivos TypeScript/React**: Kebab-case para scripts e utilitários (`context-manager.ts`, `question-detector.ts`); PascalCase para componentes React quando aplicável (`CopilotOverlay` em `overlay.tsx`).
- **Protocolo de Mensagens WebSocket**: Notação de ponto minúscula (`dot.notation`) em `type` (ex: `session.start`, `transcript.final`, `answer.delta`, `question.detected`).
### 2. Estilização da Extensão Chrome (Shadow DOM)
- O `content-script.ts` injeta a interface do painel flutuante dentro de um container isolado em **Shadow DOM** (`open`).
- **Regra de Estilo**: Usar estilos inline React (`React.CSSProperties`) combinados com a injeção de `<style>` dentro do Shadow DOM para pseudo-classes (ex: `:hover`, scrollbars, animações keyframes).
- **Proibição**: Não utilizar frameworks CSS runtime (Tailwind ou CSS-in-JS pesado) no content-script que dependam de loaders adicionais em tempo de execução ou afetem a página hospedeira da reunião.
## Padrões de Arquitetura e Código TypeScript
### 1. Resolução de Importações e Módulos
- Módulos no ecossistema usam ES Modules. No Orquestrador e pacotes TypeScript, importações de arquivos locais requerem a extensão `.js` explicita (ex: `import { GeminiProvider } from './services/gemini.js';`).
- O pacote `@conversation-copilot/shared-types` deve ser compilado via `npm run build:types` antes que os outros pacotes do monorepo resolvam suas referências.
### 2. Tratamento de Erros e Resiliência
- **Streams e Conexões WS**: Todas as escutas e manipulações de mensagens WebSocket devem implementar blocos `try/catch` seguros, tratando desconexões inesperadas sem crashar a aplicação.
- **Failovers e Timeouts**: Requisições de IA (Gemini) possuem tratadores de timeout e emitem eventos de `answer.failed` ou `answer.cancelled` para atualizar o estado do cliente no painel.
## Persistência de Preferências do Usuário (Navegador)
- Configurações do painel na extensão Chrome utilizam `localStorage` (com fallback seguro):
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Diagrama da Arquitetura
```
| Chrome Extension (Manifest V3)                                                   |
|                                                                                  |
| +-------------------------+   +-------------------+   +------------------------+ |
| | Offscreen Document      |   | Content Script    |   | SpeechManager          | |
| | (AudioContext PCM 16k)  |   | (Overlay UI React)|   | (Web Speech Synthesis) | |
| +------------+------------+   +---------+---------+   +-----------^------------+ |
|              |                          |                         |              |
| Orchestrator (Node.js + Fastify)                                  |              |
|                                                                   |              |
| +--------------------+  +----------------------+  +---------------|------------+ |
| | WhisperClient      |  | QuestionDetector     |  | ContextManager|            | |
| | (ws client)        |  | (Regex/Heuristic)    |  | (Window 10min/Sliding)     | |
| +----------+---------+  +----------+-----------+  +---------------+------------+ |
|            |                       |                          |                  |
|            |                       +------------+-------------+                  |
|            |                                    |                                |
|            |                                    v                                |
|            |                         +--------------------+                      |
|            |                         | AnswerProvider     |                      |
|            |                         | (GeminiProvider)   |                      |
|            |                         +----------+---------+                      |
| Transcription Service  |             | Google Gemini API  |
| (Python + FastAPI)     |             | (LLM Engine)       |
| faster-whisper CTrans  |             +--------------------+
```
## Camadas e Responsabilidades
### 1. Extensão Chrome (`apps/chrome-extension`)
- **Captura de Áudio (`src/offscreen/`)**: O Offscreen Document utiliza `chrome.tabCapture` / `getUserMedia` para capturar áudio da aba da reunião em tempo real, processando via AudioWorklet/PCM Worklet a 16kHz e enviando blocos binários/PCM ao Orquestrador.
- **Interface Flutuante (`src/content/overlay.tsx`)**: Injetada via Shadow DOM no Content Script para evitar conflitos de estilo com a página da reunião (ex: Google Meet, Zoom, Teams). Suporta redimensionamento livre (drag-to-resize), ajuste de opacidade, minimização e cópia com toast.
- **Gerenciador de Leitura de Voz (`src/tts/speech-manager.ts`)**: Controla a síntese de voz (TTS) nativa do navegador para leitura em áudio das sugestões geradas.
### 2. Orquestrador (`apps/orchestrator`)
- **Servidor Fastify (`src/server.ts`)**: Ponto central de sincronização WebSocket (`/ws`) com a extensão.
- **Gerenciador de Contexto (`src/services/context-manager.ts`)**: Mantém a janela deslizante de transcrições recentes (últimos 10 minutos ou buffer ajustável) e constrói o prompt contextualizado para a IA.
- **Detector de Perguntas (`src/services/question-detector.ts`)**: Analisa sentenças transcritas e aplica regras heurísticas para identificar perguntas direcionadas ao candidato/usuário.
- **Provedor de Respostas Abstrato (`src/services/answer-provider.ts`)**: Interface `AnswerProvider` que desacopla o backend de IA da regra de negócio, permitindo trocar o provedor Gemini por outro modelo.
- **Provedor Gemini (`src/services/gemini.ts`)**: Implementação concreta da interface `AnswerProvider` integrada com o SDK da Google Gemini.
### 3. Serviço de Transcrição (`apps/transcription-service`)
- **FastAPI / Uvicorn (`main.py`)**: Endpoints `/health` e `/ws/transcribe`. Recebe o fluxo de bytes PCM de áudio e executa a transcrição incremental usando `faster-whisper`.
## Principais Abstrações de Código
- **`AnswerProvider`**: Interface TypeScript em `apps/orchestrator/src/services/answer-provider.ts`. Define o contrato com emissão de eventos em streaming (`started`, `delta`, `completed`, `failed`, `cancelled`).
- **`ContextManager`**: Classe em `apps/orchestrator/src/services/context-manager.ts`. Responsável pela limpeza de histórico antigo, deduplicação de transcrições parciais e formatação do histórico da conversa.
- **`SpeechManager`**: Classe em `apps/chrome-extension/src/tts/speech-manager.ts`. Abstrai a `window.speechSynthesis` do navegador com callbacks para sentenças e estado de reprodução.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.agent/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
