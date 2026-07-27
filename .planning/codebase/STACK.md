# Stack Technology Reference — conversation-copilot

> Documento de referência do stack tecnológico, dependências e configurações do monorepo.

---

## Linguagens & Runtimes

| Tecnologia | Versão | Uso / Componente |
|:---|:---|:---|
| **TypeScript** | `~5.3.3` | Orquestrador (`apps/orchestrator`), Extensão (`apps/chrome-extension`), Tipos Compartilhados (`packages/shared-types`) |
| **Node.js** | `>=20.0.0` | Runtime do Orquestrador Fastify |
| **Python** | `>=3.10` | Servidor de transcrição (`apps/transcription-service`) |
| **HTML5 / CSS3** | - | UI da extensão Chrome (React inline CSS + Shadow DOM) |

---

## Monorepo & Workspaces

- **Gerenciador de Pacotes**: `npm` com Workspaces (`packages/*`, `apps/*`)
- **Build order**: `packages/shared-types` -> `apps/orchestrator` / `apps/chrome-extension`

---

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

---

## Infraestrutura & Containerização

- **Docker Compose**: Perfis de execução `gpu`, `cpu` e `dev` (`docker-compose.yml`)
- **CUDA / NVIDIA Container Toolkit**: Suporte a GPU NVIDIA para aceleração de inferência do Whisper no perfil `gpu`
