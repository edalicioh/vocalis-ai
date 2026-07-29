# Referência de Variáveis de Ambiente — Vocalis AI

Todas as configurações do **Vocalis AI** podem ser ajustadas através de variáveis de ambiente definidas no arquivo `.env` na raiz do repositório ou injetadas no ambiente de execução.

---

## 1. Provedores de Inteligência Artificial (LLM)

| Variável | Tipo | Valor Padrão | Descrição |
|:---|:---|:---|:---|
| `GEMINI_API_KEY` | `string` | *(Nenhum)* | Chave de API oficial do Google Gemini (obrigatória caso use Gemini). |
| `OPENAI_BASE_URL` | `string` | `https://api.openai.com/v1` | Endpoint base da API da OpenAI. |
| `OLLAMA_ENDPOINT` | `string` | `http://localhost:11434` | URL base do servidor Ollama rodando localmente. |
| `CUSTOM_PROXY_ENDPOINT` | `string` | `https://api.deepseek.com/v1/chat/completions` | Endpoint para provedores compatíveis com a API OpenAI (DeepSeek, Groq, OpenRouter). |

---

## 2. Orquestrador & Comunicação WebSocket

| Variável | Tipo | Valor Padrão | Descrição |
|:---|:---|:---|:---|
| `ORCHESTRATOR_PORT` | `number` | `3001` | Porta do servidor HTTP e WebSocket do Orquestrador Fastify. |
| `WHISPER_WS_URL` | `string` | `ws://localhost:8000/ws/transcribe` | Endpoint WebSocket do serviço de transcrição Whisper Python. |
| `VITE_ORCHESTRATOR_WS_URL` | `string` | `ws://localhost:3001/ws` | URL WebSocket utilizada pela Extensão Chrome para conectar ao Orquestrador. |
| `VITE_ORCHESTRATOR_HTTP_URL` | `string` | `http://localhost:3001` | URL HTTP base para consulta de modelos e health checks. |

---

## 3. Serviço de Transcrição Whisper

| Variável | Tipo | Valor Padrão | Descrição |
|:---|:---|:---|:---|
| `WHISPER_PORT` | `number` | `8000` | Porta do servidor FastAPI do serviço Whisper. |
| `WHISPER_MODEL` | `string` | `small` | Tamanho do modelo Whisper (`tiny`, `base`, `small`, `medium`, `large-v2`, `large-v3`). |
| `WHISPER_DEVICE` | `string` | `cuda` (ou `cpu`) | Dispositivo de inferência do PyTorch/CTranslate2. |
| `WHISPER_COMPUTE` | `string` | `float16` | Tipo de computação (`float16` para GPU, `int8` para CPU). |

---

## 4. Exemplo de Arquivo `.env` Completo

```env
# --- Gemini API ---
GEMINI_API_KEY=sua_chave_gemini_aqui

# --- Portas ---
ORCHESTRATOR_PORT=3001
WHISPER_PORT=8000

# --- Extension Client URLs (Vite) ---
VITE_ORCHESTRATOR_WS_URL=ws://localhost:3001/ws
VITE_ORCHESTRATOR_HTTP_URL=http://localhost:3001

# --- Whisper & Orchestrator Services ---
WHISPER_WS_URL=ws://localhost:8000/ws/transcribe

# --- LLM Endpoints ---
OLLAMA_ENDPOINT=http://localhost:11434
CUSTOM_PROXY_ENDPOINT=https://api.deepseek.com/v1/chat/completions
OPENAI_BASE_URL=https://api.openai.com/v1

# --- Whisper Model ---
WHISPER_MODEL=small
WHISPER_COMPUTE=float16
```
