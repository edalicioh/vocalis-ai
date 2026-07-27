# Concerns Reference — conversation-copilot

> Débitos técnicos, pontos de atenção, fragilidades de segurança e riscos de performance identificados na base de código.

---

## Áreas Frágeis & Pontos de Atenção

### 1. Tempo de Carregamento Inicial do Modelo Whisper
- **Impacto**: O container `whisper` levará de 30 a 90 segundos para inicializar no primeiro boot ou após reinicialização devido ao download/carregamento do modelo `small` no CTranslate2.
- **Risco**: O Orquestrador e a Extensão Chrome podem falhar ao tentar conectar via WebSocket antes do serviço estar completamente pronto (`start_period: 90s` no healthcheck do docker-compose).

### 2. Tratamento de API Keys e Arquivo `.env`
- **Risco de Segurança**: A variável `GEMINI_API_KEY` é necessária no arquivo `.env` na raiz do repositório.
- **Mitigação**: Garantir que o `.env` nunca seja commitado no repositório Git (registrado em `.gitignore`).

### 3. Isolamento CSS no Shadow DOM da Extensão Chrome
- **Ponto de Atenção**: O `content-script` é injetado no DOM das páginas de reuniões (Google Meet, Zoom, Teams). Embora o Shadow DOM isole a maior parte dos estilos, elementos modais ou fontes externas não empacotadas podem falhar ao carregar se tentarem acessar recursos de rede bloqueados por CSP (Content Security Policy) da página hospedeira.
- **Solução Atual**: Uso estrito de `system-ui` para tipografia e estilos inline/injetados diretamente no Shadow DOM.

### 4. Notação de Ordem de Build dos Pacotes do Monorepo
- **Dependência Crítica**: Executar `npm run dev:orchestrator` ou `npm run build:extension` sem antes rodar `npm run build:types` resultará em erro de módulo não encontrado para `@conversation-copilot/shared-types`.

### 5. Latência de Streaming e Estabilidade de Conexão WebSocket
- **Risco de UX**: Em conexões instáveis, o streaming de respostas da IA pode ser interrompido ou o buffer de áudio pode acumular.
- **Mecanismo Existente**: O orquestrador envia atualizações de status e cancelamento (`answer.cancelled`) e limita o histórico mantido no `ContextManager`.
