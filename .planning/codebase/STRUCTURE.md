# Structure Reference — conversation-copilot

> Layout de diretórios do repositório, localização de componentes chave e convenções de arquivos.

---

## Estrutura do Monorepo

```text
conversation-copilot/
├── AGENTS.md                          # Diretrizes de IA e regras do projeto
├── README.md                          # Documentação e guia de início rápido
├── UI-SPEC.md                         # Contrato de design e UI do painel flutuante
├── docker-compose.yml                 # Definições de serviços Docker (gpu, cpu, dev)
├── package.json                       # Configuração do monorepo npm workspaces
├── packages/                          # Pacotes compartilhados
│   └── shared-types/                  # Tipos TypeScript compartilhados
│       ├── src/
│       │   ├── index.ts               # Exportações do pacote
│       │   └── messages.ts            # Tipos de eventos WebSocket, settings e métricas
│       └── tsconfig.json
└── apps/                              # Aplicações e serviços do ecossistema
    ├── chrome-extension/              # Extensão Chrome (Manifest V3 + React)
    │   ├── manifest.json              # Configuração Manifest V3 da extensão
    │   ├── vite.config.ts             # Configuração do Vite com plugin customizado IIFE
    │   └── src/
    │       ├── background/            # Service Worker da extensão
    │       │   └── service-worker.ts
    │       ├── content/               # Content Script injetado na página de reunião
    │       │   ├── content-script.ts   # Entry point IIFE
    │       │   ├── overlay.tsx        # UI React do painel flutuante flutuante
    │       │   └── styles-injection.ts # Injeção de estilos no Shadow DOM
    │       ├── offscreen/             # Captura de áudio via AudioWorklet
    │       │   ├── offscreen.html
    │       │   ├── offscreen.ts
    │       │   └── pcm-worklet.js
    │       ├── popup/                 # Toolbar Popup de atalhos rápidos
    │       │   ├── popup.html
    │       │   └── popup.tsx
    │       ├── shared/                # Componentes e utilitários da extensão
    │       │   ├── conversation-storage.ts
    │       │   └── settings-form.tsx  # Formulário de preferências
    │       └── tts/                   # Módulo de sintetizador de voz
    │           └── speech-manager.ts
    ├── orchestrator/                  # Servidor central de orquestração Fastify
    │   ├── Dockerfile                 # Dockerfile de produção do Orquestrador
    │   └── src/
    │       ├── server.ts              # Endpoint Fastify & gerenciador de conexões WS
    │       └── services/              # Serviços de negócio
    │           ├── answer-provider.ts # Interface abstrata do gerador de respostas
    │           ├── context-manager.ts # Gerenciador de histórico e sliding window
    │           ├── gemini.ts          # Integração com API Google Gemini
    │           ├── question-detector.ts # Heurística de detecção de perguntas
    │           └── whisper-client.ts  # Cliente WS para conexão com Whisper
    └── transcription-service/         # Serviço local Python faster-whisper
        ├── Dockerfile                 # Dockerfile GPU (CUDA)
        ├── Dockerfile.cpu             # Dockerfile CPU (fallback)
        ├── main.py                    # Servidor FastAPI com endpoint WebSocket
        └── requirements.txt           # Dependências Python
```

---

## Locais de Arquivos Chave

| Componente / Função | Caminho do Arquivo |
|:---|:---|
| Entrada do Orquestrador | [`apps/orchestrator/src/server.ts`](file:///d:/dev/projetos/Edalicio/conversation-copilot/apps/orchestrator/src/server.ts) |
| Servidor Whisper Python | [`apps/transcription-service/main.py`](file:///d:/dev/projetos/Edalicio/conversation-copilot/apps/transcription-service/main.py) |
| Painel Flutuante UI (React) | [`apps/chrome-extension/src/content/overlay.tsx`](file:///d:/dev/projetos/Edalicio/conversation-copilot/apps/chrome-extension/src/content/overlay.tsx) |
| Content Script Entry Point | [`apps/chrome-extension/src/content/content-script.ts`](file:///d:/dev/projetos/Edalicio/conversation-copilot/apps/chrome-extension/src/content/content-script.ts) |
| Tipos WebSocket Compartilhados | [`packages/shared-types/src/messages.ts`](file:///d:/dev/projetos/Edalicio/conversation-copilot/packages/shared-types/src/messages.ts) |
| Integração Google Gemini | [`apps/orchestrator/src/services/gemini.ts`](file:///d:/dev/projetos/Edalicio/conversation-copilot/apps/orchestrator/src/services/gemini.ts) |
