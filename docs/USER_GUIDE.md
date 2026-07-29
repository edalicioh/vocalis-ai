# Guia do Usuário — Vocalis AI

🌐 **[Português (Brasil)](USER_GUIDE.md)** | **[English](USER_GUIDE.en.md)**

Este guia explica como instalar, configurar e utilizar o **Vocalis AI** durante suas reuniões e entrevistas técnicas.

---

## 1. Pré-requisitos

- **Navegador**: Google Chrome 120+ (ou navegador baseado em Chromium)
- **Node.js**: Versão 20+ (para executar o Orquestrador local)
- **Python**: Versão 3.10+ (opcional se utilizar Docker para a transcrição Whisper)
- **Chave de API**: Google Gemini (ou OpenAI, Anthropic, DeepSeek, ou servidor Ollama local)

---

## 2. Instalação Passo a Passo

### Passo 1: Clonar o Repositório e Instalar Dependências
```bash
git clone https://github.com/seu-usuario/vocalis-ai.git
cd vocalis-ai
npm install
```

### Passo 2: Configurar o Arquivo de Ambiente `.env`
Copie o exemplo de `.env` e adicione sua chave API:
```bash
cp ".env copy.example" .env
```
Edite o arquivo `.env`:
```env
GEMINI_API_KEY=sua_chave_gemini_aqui
```

### Passo 3: Compilar o Projeto
```bash
npm run build:types
npm run build:extension
npm run build:orchestrator
```

### Passo 4: Carregar a Extensão no Google Chrome
1. Abra o Chrome e navegue até `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** no canto superior direito.
3. Clique em **Carregar sem compactação** (*Load unpacked*).
4. Selecione a pasta `apps/chrome-extension/dist`.

---

## 3. Inicialização dos Serviços

### Opção A: Execução via Docker (Recomendado)
```bash
# Para ambiente com placa de vídeo NVIDIA (GPU)
docker compose --profile gpu up -d

# Para ambiente usando apenas CPU
docker compose --profile cpu up -d
```

### Opção B: Execução Manual em Desenvolvimento
```bash
# Terminal 1: Iniciar o Orquestrador Fastify
npm run dev:orchestrator

# Terminal 2: Iniciar o Serviço de Transcrição Whisper (Python)
cd apps/transcription-service
uvicorn main:app --port 8000
```

---

## 4. Como Usar Durante uma Reunião

1. Entre na reunião no Google Meet, Zoom Web ou Microsoft Teams.
2. Clique no ícone da extensão **Vocalis AI** no Chrome.
3. Clique no botão **Iniciar Captura**.
4. O **HUD Flutuante** e o **Painel de Respostas** aparecerão sobre a tela da chamada.
5. As perguntas detectadas durante a conversa serão exibidas automaticamente no painel com sugestões técnicas objetivas em tempo real.

---

## 5. Recursos & Configurações da Interface

### Detecção de Perguntas e Tom
A página de Opções oferece dois modos:
- **Local (padrão)**: perguntas e tom são classificados no orquestrador local, sem chamadas externas de classificação.
- **Híbrido**: perguntas ambíguas podem ser validadas pelo provedor configurado, e o tom pode ser refinado periodicamente em segundo plano.

No modo híbrido, são enviados somente o resumo acumulado, as oito falas finais mais recentes e o modo da reunião. Perguntas claras continuam sendo detectadas imediatamente no processamento local. Se a validação externa exceder o tempo limite ou falhar, o resultado local é mantido.

Essa configuração controla a detecção de perguntas e tom. A geração de respostas e atas continua seguindo o provedor de IA escolhido nas configurações.

### Modos de Reunião Adaptativos
Você pode alterar o modo a qualquer momento no HUD:
- **🎯 Entrevista Técnica**: Foco em conceitos de programação, algoritmos e boas práticas.
- **📦 System Design**: Foco em arquitetura de sistemas, escalabilidade e banco de dados.
- **💻 Code Review**: Foco em qualidade de código, refatoração e testes.
- **📄 Geral / Livre**: Suporte conversacional abrangente para reuniões do dia a dia.

### Seleção de Idioma (i18n)
Acesse a página de Opções da extensão ou a engrenagem no HUD para alternar entre:
- 🇧🇷 **Português (Brasil)**
- 🇺🇸 **English**

### Reescrita Instantânea (Gemini Nano Local)
Use os botões de ação rápida no painel de respostas:
- ✂️ **Encurtar / Shorten**: Reduz a resposta para 1-2 frases diretas.
- 💼 **Formal**: Formata em tom executivo/corporativo.
- 💻 **Técnico / Technical**: Adiciona terminologias avançadas de engenharia.
- 📝 **Expandir / Expand**: Detalha a resposta com exemplos práticos.
- ↩️ **Desfazer / Undo**: Retorna ao texto original.
