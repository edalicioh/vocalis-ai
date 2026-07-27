# Levantamento de Requisitos — Copiloto de Conversas e Entrevistas Técnicas

## 1. Visão geral

O sistema será um assistente local integrado ao navegador, capaz de:

1. Capturar o áudio de uma reunião realizada no navegador.
2. Transcrever as falas em tempo quase real.
3. Identificar perguntas e assuntos relevantes.
4. Enviar o contexto para um modelo de linguagem.
5. Gerar sugestões curtas e úteis.
6. Exibir as sugestões em um painel flutuante.
7. Ler as sugestões por meio de TTS para auxiliar o acompanhamento visual.
8. Manter um resumo da conversa sem enviar todo o histórico a cada requisição.

O sistema deverá priorizar:

* baixa latência;
* privacidade;
* funcionamento local sempre que possível;
* custo reduzido;
* respostas curtas;
* facilidade de instalação;
* tolerância a erros de transcrição;
* possibilidade de trocar o provedor de IA.

---

# 2. Objetivo do produto

## 2.1 Objetivo principal

Criar um copiloto de conversação que ajude o usuário a acompanhar reuniões e entrevistas técnicas, apresentando sugestões contextuais em texto e áudio.

O sistema não deve tentar controlar a conversa. Sua função será auxiliar o usuário com:

* entendimento da pergunta;
* organização da resposta;
* recuperação de conceitos;
* palavras-chave;
* estrutura lógica da resposta;
* leitura assistida por áudio.

## 2.2 Objetivos secundários

O sistema também poderá:

* mostrar a transcrição ao vivo;
* resumir partes anteriores da conversa;
* identificar tópicos técnicos;
* relacionar a pergunta com o perfil profissional do usuário;
* sugerir perguntas de esclarecimento;
* armazenar uma sessão para revisão posterior;
* permitir diferentes modos de resposta.

---

# 3. Escopo

## 3.1 Incluído no escopo

A primeira versão deverá conter:

* extensão para Chrome;
* captura do áudio da aba;
* transmissão do áudio para um servidor local;
* transcrição com faster-whisper;
* detecção de pausas e perguntas;
* integração direta com uma API de LLM;
* resposta textual em streaming;
* painel flutuante sobre a reunião;
* TTS utilizando recursos do navegador ou sistema operacional;
* configuração de perfil profissional;
* configuração da descrição da vaga;
* histórico curto da conversa;
* cancelamento de respostas antigas;
* registro básico de métricas e erros.

## 3.2 Fora do escopo inicial

Não deverão fazer parte do primeiro MVP:

* gravação de vídeo;
* reconhecimento facial;
* leitura automática de expressões corporais;
* análise emocional;
* execução automática de código;
* busca automática na internet;
* agente autônomo com ferramentas;
* integração com vários navegadores;
* aplicativo móvel;
* treinamento de modelo próprio;
* identificação perfeita de cada participante;
* funcionamento totalmente offline com respostas complexas.

Esses itens poderão ser avaliados em fases futuras.

---

# 4. Arquitetura geral

A arquitetura recomendada será:

```text
Google Meet, Teams ou outra reunião no Chrome
                     ↓
              Extensão Chrome
                     ↓
                 WebSocket
                     ↓
          Orquestrador local Fastify
              ├── Gerenciador de sessão
              ├── Buffer de áudio
              ├── Detector de fala
              ├── Detector de pergunta
              ├── Gerenciador de contexto
              ├── Cliente Whisper
              ├── Cliente de IA
              └── Gerenciador de eventos
                     ↓
          faster-whisper local
                     ↓
              Transcrição parcial
                     ↓
             API externa de IA
                     ↓
            Resposta em streaming
                     ↓
            Extensão Chrome
              ├── Texto
              ├── Palavras-chave
              └── TTS
```

O sistema será dividido em três aplicações principais:

1. Extensão Chrome.
2. Orquestrador local.
3. Serviço de transcrição.

A API de inteligência artificial será uma dependência externa substituível.

---

# 5. Divisão do projeto

## 5.1 Aplicação 1 — Extensão Chrome

### Responsabilidades

A extensão será responsável por:

* iniciar e encerrar uma sessão;
* capturar o áudio da aba;
* enviar áudio ao servidor local;
* receber transcrições;
* receber respostas;
* mostrar o painel flutuante;
* controlar o TTS;
* exibir o estado da aplicação;
* permitir atalhos;
* configurar o comportamento visual.

### Tecnologias sugeridas

* TypeScript;
* React;
* Vite;
* Manifest V3;
* WebSocket;
* Chrome Tab Capture;
* Chrome Offscreen Document;
* Web Speech Synthesis API.

### Estrutura sugerida

```text
apps/chrome-extension/
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   ├── overlay.tsx
│   │   └── content-script.ts
│   ├── offscreen/
│   │   ├── audio-capture.ts
│   │   └── offscreen.html
│   ├── popup/
│   │   ├── popup.tsx
│   │   └── settings.tsx
│   ├── audio/
│   │   ├── audio-processor.ts
│   │   └── audio-encoder.ts
│   ├── websocket/
│   │   └── local-client.ts
│   ├── tts/
│   │   └── speech-manager.ts
│   └── protocol/
│       └── messages.ts
└── manifest.json
```

---

## 5.2 Aplicação 2 — Orquestrador local

### Responsabilidades

O orquestrador será o núcleo do sistema.

Ele deverá:

* aceitar conexões da extensão;
* criar uma sessão;
* receber blocos de áudio;
* encaminhar áudio ao Whisper;
* receber transcrições parciais e finais;
* organizar os trechos transcritos;
* detectar perguntas;
* controlar o contexto;
* chamar a API de IA;
* transmitir a resposta em streaming;
* cancelar respostas ultrapassadas;
* registrar latência;
* tratar falhas.

### Tecnologias sugeridas

* Node.js;
* TypeScript;
* Fastify;
* WebSocket;
* Zod ou TypeBox;
* SQLite para configurações e sessões;
* Pino para logs.

### Estrutura sugerida

```text
apps/orchestrator/
├── src/
│   ├── server.ts
│   ├── config/
│   │   └── environment.ts
│   ├── websocket/
│   │   ├── audio.gateway.ts
│   │   └── events.gateway.ts
│   ├── session/
│   │   ├── session-manager.ts
│   │   └── interview-session.ts
│   ├── transcription/
│   │   ├── whisper-client.ts
│   │   ├── transcript-buffer.ts
│   │   └── transcript-normalizer.ts
│   ├── detection/
│   │   ├── voice-activity-detector.ts
│   │   ├── pause-detector.ts
│   │   └── question-detector.ts
│   ├── context/
│   │   ├── context-manager.ts
│   │   └── conversation-summary.ts
│   ├── ai/
│   │   ├── answer-provider.ts
│   │   ├── prompt-builder.ts
│   │   ├── response-parser.ts
│   │   └── providers/
│   ├── metrics/
│   │   └── latency-tracker.ts
│   └── storage/
│       ├── database.ts
│       └── repositories/
└── package.json
```

---

## 5.3 Aplicação 3 — Serviço Whisper

### Responsabilidades

O serviço de transcrição deverá:

* carregar o modelo apenas uma vez;
* receber blocos de áudio;
* transcrever continuamente;
* retornar resultados parciais;
* retornar resultados finais;
* identificar idioma;
* aplicar VAD;
* aproveitar GPU quando disponível;
* lidar com reconexão.

### Tecnologias sugeridas

* Python;
* faster-whisper;
* CUDA;
* FastAPI ou WebSocket;
* Silero VAD, caso necessário.

### Configuração inicial sugerida

```text
Modelo: Whisper Small
Dispositivo: CUDA
Compute type: float16
Idioma inicial: português
Tamanho de bloco: entre 500 ms e 1,5 s
```

### Estrutura sugerida

```text
services/whisper/
├── app/
│   ├── main.py
│   ├── model.py
│   ├── transcriber.py
│   ├── vad.py
│   ├── session.py
│   └── schemas.py
├── requirements.txt
└── Dockerfile
```

---

# 6. Requisitos funcionais

## RF-001 — Iniciar sessão

O usuário deverá poder iniciar uma sessão pelo popup da extensão.

Ao iniciar:

1. A extensão deverá verificar se o servidor local está ativo.
2. A extensão deverá solicitar permissão para capturar o áudio da aba.
3. O servidor deverá criar um identificador de sessão.
4. O Whisper deverá estar carregado.
5. O painel flutuante deverá ser exibido.

### Critério de aceitação

A sessão deverá estar pronta para transcrição em até poucos segundos após o clique.

---

## RF-002 — Encerrar sessão

O usuário deverá poder encerrar a sessão.

Ao encerrar:

* a captura de áudio deverá parar;
* o WebSocket deverá ser fechado;
* o TTS deverá ser cancelado;
* gerações de IA pendentes deverão ser canceladas;
* o resumo final poderá ser salvo;
* o painel deverá ser ocultado.

---

## RF-003 — Capturar áudio da aba

A extensão deverá capturar o áudio da aba onde ocorre a reunião.

O áudio deverá:

* continuar sendo reproduzido para o usuário;
* ser convertido para um formato aceito pelo backend;
* ser enviado em blocos;
* conter timestamps;
* não ser enviado para serviços externos de transcrição.

### Formato sugerido

* PCM mono;
* 16 kHz;
* 16 bits;
* blocos entre 500 ms e 1 segundo.

---

## RF-004 — Transcrever áudio

O serviço Whisper deverá produzir:

* transcrição parcial;
* transcrição final;
* timestamp inicial;
* timestamp final;
* confiança estimada;
* idioma detectado, quando necessário.

Exemplo:

```json
{
  "type": "transcript.final",
  "sessionId": "abc123",
  "text": "Como você escalaria uma aplicação Laravel?",
  "start": 42.1,
  "end": 46.8,
  "confidence": 0.91
}
```

---

## RF-005 — Mostrar transcrição em tempo real

O painel deverá mostrar as últimas falas.

A transcrição parcial deverá ter aparência diferente da final.

Exemplo:

```text
Parcial:
Como você escalaria uma aplicação...

Final:
Como você escalaria uma aplicação Laravel?
```

O sistema deverá manter apenas uma quantidade limitada de texto visível.

---

## RF-006 — Detectar silêncio e final de fala

O sistema deverá identificar quando uma fala provavelmente terminou.

A detecção poderá considerar:

* duração da pausa;
* pontuação;
* estabilidade do texto parcial;
* duração total da fala;
* presença de expressão interrogativa.

Configuração inicial:

```text
Pausa curta: 400 ms
Pausa provável: 700 ms
Final confirmado: 1.000 a 1.300 ms
```

O envio à IA poderá ocorrer antes do final confirmado quando a pergunta estiver suficientemente clara.

---

## RF-007 — Detectar perguntas

A primeira versão deverá usar uma combinação de regras.

Exemplos de padrões:

* “como você faria”;
* “qual é”;
* “qual a diferença”;
* “por que”;
* “o que acontece”;
* “me explique”;
* “conte uma situação”;
* “como resolveria”;
* “já trabalhou com”;
* “pode dar um exemplo”.

O detector deverá atribuir uma pontuação:

```json
{
  "isQuestion": true,
  "score": 0.87,
  "reason": [
    "expressão interrogativa",
    "pausa longa",
    "entonação ou pontuação provável"
  ]
}
```

Não deverá existir um LLM local obrigatório antes da chamada principal, para evitar aumento de latência.

---

## RF-008 — Montar contexto

O sistema não deverá enviar toda a conversa a cada pergunta.

O contexto deverá ser montado com:

* perfil profissional resumido;
* descrição resumida da vaga;
* instruções de resposta;
* resumo acumulado da conversa;
* últimas falas;
* pergunta atual;
* idioma da conversa.

Exemplo:

```json
{
  "candidateProfile": "Desenvolvedor PHP e Laravel...",
  "jobContext": "Vaga sênior com foco em APIs...",
  "conversationSummary": "A conversa está focada em escalabilidade...",
  "recentTranscript": [
    "Entrevistador: Como você monitora uma API?",
    "Usuário: Eu utilizaria métricas e logs..."
  ],
  "currentQuestion": "Como você escalaria essa aplicação?"
}
```

---

## RF-009 — Gerar resposta com IA

O servidor deverá enviar a pergunta para uma API de modelo de linguagem.

O modelo deverá retornar:

* entendimento resumido da pergunta;
* frase inicial;
* resposta principal;
* palavras-chave;
* possível pergunta de esclarecimento;
* dica curta para áudio.

Formato esperado:

```json
{
  "questionSummary": "Escalabilidade de uma aplicação Laravel",
  "opening": "Eu começaria identificando o gargalo atual.",
  "answer": "Depois avaliaria banco de dados, cache...",
  "keyPoints": [
    "Métricas",
    "Banco de dados",
    "Redis",
    "Filas",
    "Escala horizontal"
  ],
  "clarifyingQuestion": "O gargalo está no banco ou na aplicação?",
  "audioHint": "Comece pelo gargalo. Banco, cache, filas e escala horizontal."
}
```

---

## RF-010 — Resposta em streaming

A aplicação não deverá aguardar a resposta completa para mostrar conteúdo.

Assim que uma frase estiver disponível:

* ela deverá aparecer no painel;
* poderá entrar na fila do TTS;
* o usuário deverá conseguir começar a acompanhar a resposta.

Eventos possíveis:

```text
answer.started
answer.delta
answer.section.completed
answer.completed
answer.cancelled
answer.failed
```

---

## RF-011 — Cancelar resposta antiga

Se uma nova pergunta for detectada enquanto uma resposta anterior estiver sendo produzida:

1. A geração anterior deverá ser cancelada.
2. O TTS anterior deverá parar.
3. A interface deverá marcar a resposta como interrompida.
4. A nova pergunta deverá receber prioridade.

Essa regra é essencial para impedir que o sistema fique atrasado em relação à conversa.

---

## RF-012 — Exibir painel flutuante

O painel deverá ser exibido sobre a reunião sem bloquear controles importantes.

O painel deverá conter:

* status da sessão;
* transcrição atual;
* pergunta detectada;
* resposta sugerida;
* palavras-chave;
* estado do TTS;
* botão para minimizar;
* botão para mover;
* botão para redimensionar;
* botão para fechar.

Modos visuais:

```text
Compacto
Normal
Somente palavras-chave
Somente transcrição
Oculto
```

---

## RF-013 — TTS para auxiliar a leitura

O TTS deverá complementar o texto, não substituir completamente a leitura.

O sistema deverá:

* começar após a primeira frase completa;
* ler a resposta exibida;
* destacar a frase atual;
* permitir velocidade ajustável;
* permitir volume ajustável;
* permitir pausa;
* permitir repetição;
* cancelar a fala quando uma nova pergunta surgir.

Configuração inicial sugerida:

```text
Velocidade: 1,25x
Volume: 40%
Modo: ler por frases
Limite por trecho: aproximadamente 5 segundos
```

Modos disponíveis:

```text
Desligado
Ler resposta completa
Ler somente resumo
Ler somente palavras-chave
Manual
```

No modo manual, o TTS só deverá iniciar quando o usuário pressionar um atalho.

---

## RF-014 — Destacar trecho lido

A frase atualmente lida deverá receber destaque visual.

Exemplo:

```text
Eu começaria avaliando as métricas atuais.

[Depois analisaria banco, cache e filas.]

Por fim, avaliaria escalabilidade horizontal.
```

Após a leitura, o destaque deverá avançar para a próxima frase.

---

## RF-015 — Configurar perfil profissional

O usuário deverá cadastrar:

* nome opcional;
* cargo;
* senioridade;
* principais tecnologias;
* experiências relevantes;
* exemplos de projetos;
* pontos fortes;
* assuntos que não domina;
* estilo preferido de resposta.

O perfil poderá ser armazenado localmente em JSON ou SQLite.

---

## RF-016 — Configurar vaga

O sistema deverá permitir inserir:

* título da vaga;
* descrição;
* requisitos obrigatórios;
* diferenciais;
* empresa;
* tecnologias;
* observações.

O sistema deverá gerar uma versão resumida para o prompt.

---

## RF-017 — Modos de resposta

O usuário deverá escolher o modo de resposta.

### Modo palavras-chave

Retorna apenas tópicos:

```text
Métricas
Índices
Redis
Queues
Escala horizontal
```

### Modo curto

Resposta de aproximadamente 30 a 60 palavras.

### Modo completo

Resposta de aproximadamente 80 a 150 palavras.

### Modo estruturado

Formato:

```text
Abertura
Decisão
Justificativa
Trade-offs
Exemplo
```

Para entrevistas ao vivo, o modo curto deverá ser o padrão.

---

## RF-018 — Resumo de conversa

O sistema deverá atualizar periodicamente um resumo.

O resumo deverá conter:

* temas discutidos;
* perguntas anteriores;
* respostas já apresentadas;
* informações citadas pelo usuário;
* tecnologias mencionadas;
* contexto necessário para a próxima pergunta.

A atualização poderá ser executada:

* a cada cinco falas finais;
* após uma resposta concluída;
* durante períodos de silêncio;
* depois da pergunta principal, sem bloquear a resposta.

---

## RF-019 — Salvar sessão

Opcionalmente, o usuário poderá salvar:

* transcrição;
* perguntas;
* respostas sugeridas;
* resumo;
* métricas de latência.

A gravação de áudio deverá ser desabilitada por padrão.

O usuário deverá escolher explicitamente caso queira armazenar o áudio.

---

## RF-020 — Revisar sessão

Uma tela futura poderá apresentar:

* perguntas realizadas;
* respostas sugeridas;
* tempo de resposta;
* tópicos recorrentes;
* pontos para estudar;
* falhas de transcrição.

---

# 7. Requisitos não funcionais

## RNF-001 — Latência

Meta principal:

```text
Pergunta concluída
→ primeira sugestão útil
em até 3 segundos
```

Meta ideal:

```text
1 a 2 segundos
```

Distribuição estimada:

```text
Detecção de pausa: 400 a 900 ms
Finalização do Whisper: 200 a 600 ms
Envio à API: 50 a 200 ms
Primeiro token da API: 300 ms a 1,5 s
Renderização: abaixo de 50 ms
TTS: início abaixo de 300 ms após frase pronta
```

---

## RNF-002 — Desempenho local

O sistema deverá funcionar em um computador com:

```text
GPU: RTX 3050 6 GB
RAM: mínimo 16 GB recomendado
CPU: processador moderno com pelo menos 6 núcleos
```

O Whisper deverá utilizar GPU.

O orquestrador deverá consumir poucos recursos.

Não deverá existir um modelo 2B obrigatório no caminho crítico da resposta.

---

## RNF-003 — Disponibilidade

Se a API de IA falhar:

* a transcrição deverá continuar;
* o painel deverá mostrar o erro;
* o usuário poderá tentar novamente;
* palavras-chave simples poderão ser geradas por regras;
* a sessão não deverá ser encerrada.

Se o Whisper falhar:

* o backend deverá tentar reconectar;
* a extensão deverá mostrar “Transcrição indisponível”;
* o áudio não deverá ser acumulado indefinidamente.

---

## RNF-004 — Privacidade

Por padrão:

* áudio deverá permanecer local;
* apenas texto será enviado ao provedor de IA;
* gravação de áudio deverá estar desligada;
* chaves de API deverão ficar no backend;
* a extensão não deverá possuir a chave da API;
* logs não deverão registrar textos sensíveis sem configuração explícita.

O uso deverá respeitar consentimento, regras da plataforma e legislação aplicável.

---

## RNF-005 — Segurança

O servidor local deverá:

* aceitar conexões somente de `127.0.0.1`;
* utilizar token temporário entre extensão e backend;
* validar todas as mensagens;
* limitar tamanho de áudio;
* limitar quantidade de requisições;
* proteger a chave da API;
* impedir execução de comandos arbitrários;
* não expor endpoints na rede local por padrão.

---

## RNF-006 — Manutenibilidade

Os componentes deverão possuir interfaces independentes.

Exemplo:

```typescript
interface TranscriptionProvider {
  startSession(sessionId: string): Promise<void>;
  sendAudio(sessionId: string, chunk: Buffer): Promise<void>;
  stopSession(sessionId: string): Promise<void>;
}

interface AnswerProvider {
  generate(input: AnswerInput): AsyncIterable<AnswerEvent>;
  cancel(requestId: string): Promise<void>;
}

interface SpeechProvider {
  speak(text: string): Promise<void>;
  cancel(): void;
}
```

Isso permitirá trocar:

* Whisper por outro transcritor;
* Gemini por OpenAI ou outro provedor;
* TTS do Chrome por Piper ou serviço externo;
* armazenamento local por outro banco.

---

## RNF-007 — Observabilidade

O sistema deverá registrar:

* tempo até transcrição parcial;
* tempo até transcrição final;
* tempo de detecção de pergunta;
* tempo até primeiro token;
* tempo total da resposta;
* quantidade de cancelamentos;
* erros de conexão;
* uso estimado de tokens;
* custo estimado por sessão.

Exemplo:

```json
{
  "questionId": "q-15",
  "speechEnd": 1000,
  "transcriptFinal": 1420,
  "requestStarted": 1460,
  "firstToken": 2180,
  "completed": 3020
}
```

---

# 8. Regras de negócio

## RN-001

Uma resposta não deverá ser gerada para toda frase transcrita.

## RN-002

Uma nova pergunta sempre terá prioridade sobre uma resposta anterior.

## RN-003

O modelo deverá produzir respostas curtas por padrão.

## RN-004

O modelo não deverá inventar experiências profissionais do usuário.

## RN-005

Quando faltar contexto, o modelo deverá sugerir uma pergunta de esclarecimento.

## RN-006

Informações do currículo deverão ser usadas apenas quando relacionadas à pergunta.

## RN-007

A descrição da vaga deverá influenciar os exemplos e tecnologias mencionados.

## RN-008

O TTS deverá ser interrompido quando:

* houver nova pergunta;
* o usuário pressionar parar;
* o painel for ocultado;
* a sessão terminar;
* o texto ficar desatualizado.

## RN-009

A transcrição parcial não deverá ser usada como pergunta final sem um nível mínimo de confiança.

## RN-010

O resumo da conversa não deverá bloquear a chamada principal da IA.

## RN-011

Processamentos secundários deverão ocorrer em paralelo ou durante o silêncio.

## RN-012

O sistema não deverá enviar áudio para a API de LLM.

---

# 9. Fluxo principal

## 9.1 Inicialização

```text
Usuário abre a reunião
→ abre a extensão
→ seleciona perfil e vaga
→ clica em iniciar
→ extensão conecta ao backend
→ backend confirma Whisper carregado
→ captura de áudio começa
→ painel aparece
```

## 9.2 Transcrição

```text
Áudio da aba
→ conversão para PCM
→ envio por WebSocket
→ Whisper processa
→ backend recebe parcial
→ painel mostra parcial
→ Whisper confirma final
→ backend salva trecho final
```

## 9.3 Detecção da pergunta

```text
Trecho final
→ detector verifica padrões
→ detector avalia pausa
→ detector calcula confiança
→ pergunta é confirmada
```

## 9.4 Resposta

```text
Pergunta confirmada
→ backend cancela geração anterior
→ monta contexto
→ envia para API
→ recebe streaming
→ mostra primeira frase
→ inicia TTS
→ mostra palavras-chave
→ finaliza resposta
```

## 9.5 Atualização do contexto

```text
Resposta entregue
→ resumo é atualizado em segundo plano
→ últimas falas são compactadas
→ contexto fica pronto para próxima pergunta
```

---

# 10. Comunicação entre os módulos

## 10.1 Eventos da extensão para o backend

```text
session.start
session.stop
audio.chunk
audio.pause
tts.status
settings.update
answer.cancel
```

## 10.2 Eventos do backend para a extensão

```text
session.ready
session.error
transcript.partial
transcript.final
question.detected
answer.started
answer.delta
answer.completed
answer.cancelled
answer.failed
metrics.updated
```

## 10.3 Exemplo de bloco de áudio

```json
{
  "type": "audio.chunk",
  "sessionId": "session-001",
  "sequence": 150,
  "timestamp": 1712345678,
  "encoding": "pcm_s16le",
  "sampleRate": 16000
}
```

O conteúdo binário deverá preferencialmente ser enviado como frame binário do WebSocket.

---

# 11. Interface do painel

## 11.1 Área superior

Deverá conter:

* indicador de conexão;
* indicador do Whisper;
* indicador da API;
* estado de escuta;
* botão minimizar;
* botão encerrar.

## 11.2 Área de pergunta

Deverá exibir:

```text
Pergunta detectada:
Como você escalaria uma aplicação Laravel?
```

## 11.3 Área de resposta

Deverá exibir:

* frase inicial em destaque;
* resposta;
* palavras-chave;
* pergunta de esclarecimento;
* status de geração.

## 11.4 Área de áudio

Controles:

* ligar ou desligar;
* velocidade;
* volume;
* repetir frase;
* pausar;
* modo de leitura.

## 11.5 Indicadores

Estados possíveis:

```text
Escutando
Transcrevendo
Pergunta detectada
Gerando resposta
Lendo resposta
Aguardando
Erro
```

---

# 12. Configurações

## 12.1 Transcrição

* idioma;
* modelo Whisper;
* sensibilidade do VAD;
* duração da pausa;
* tamanho do bloco;
* uso de GPU;
* correção de termos técnicos.

## 12.2 Inteligência artificial

* provedor;
* modelo;
* chave de API;
* temperatura;
* tamanho máximo;
* modo de resposta;
* limite de contexto;
* tempo limite;
* política de repetição.

## 12.3 TTS

* voz;
* idioma;
* velocidade;
* volume;
* modo;
* início automático;
* interrupção por nova fala;
* destaque sincronizado.

## 12.4 Interface

* tamanho do painel;
* posição;
* transparência;
* fonte;
* tamanho do texto;
* modo compacto;
* atalhos.

---

# 13. Prompt do sistema

Exemplo inicial:

```text
Você é um copiloto para conversas e entrevistas técnicas.

Sua função é ajudar o usuário a estruturar uma resposta curta, natural e tecnicamente correta.

Regras:
- Não invente experiências.
- Use o perfil fornecido apenas quando relevante.
- Priorize uma resposta que possa ser falada.
- Evite textos longos.
- Comece com uma frase direta.
- Apresente no máximo cinco pontos principais.
- Quando houver ambiguidade, sugira uma pergunta de esclarecimento.
- Não repita a pergunta inteira.
- Não explique seu processo interno.
- Retorne somente o formato JSON solicitado.
```

---

# 14. Estratégia para baixa latência

A cadeia crítica deverá ser:

```text
Áudio
→ Whisper
→ detecção por regras
→ API principal
→ painel
→ TTS
```

Não deverá ser:

```text
Áudio
→ Whisper
→ LLM local
→ decisão
→ API principal
```

O LLM local poderá ser adicionado posteriormente para:

* resumo;
* correção;
* classificação;
* organização do contexto;
* funcionamento de emergência.

Porém deverá trabalhar em paralelo, sem atrasar a resposta principal.

---

# 15. Fases de desenvolvimento

## Fase 1 — Prova de conceito de áudio

Objetivo:

* capturar áudio da aba;
* enviar ao backend;
* confirmar reprodução normal;
* salvar temporariamente alguns segundos;
* validar qualidade.

Resultado esperado:

```text
Extensão captura áudio corretamente.
```

## Fase 2 — Whisper local

Objetivo:

* instalar faster-whisper;
* carregar o modelo Small;
* receber áudio em streaming;
* mostrar transcrição no terminal.

Resultado esperado:

```text
Transcrição parcial e final funcionando.
```

## Fase 3 — Painel flutuante

Objetivo:

* criar overlay;
* mostrar estado;
* mostrar transcrição;
* mover e redimensionar.

Resultado esperado:

```text
Painel utilizável durante uma reunião.
```

## Fase 4 — Integração com IA

Objetivo:

* detectar pergunta;
* montar prompt;
* chamar uma API;
* mostrar resposta.

Resultado esperado:

```text
Pergunta gera resposta curta.
```

## Fase 5 — Streaming e cancelamento

Objetivo:

* mostrar tokens em tempo real;
* cancelar resposta antiga;
* priorizar nova pergunta.

Resultado esperado:

```text
Sistema acompanha o ritmo da conversa.
```

## Fase 6 — TTS

Objetivo:

* ler por frases;
* destacar texto;
* ajustar velocidade;
* cancelar automaticamente.

Resultado esperado:

```text
Áudio auxilia a leitura sem dominar a conversa.
```

## Fase 7 — Perfil, vaga e contexto

Objetivo:

* cadastrar perfil;
* cadastrar vaga;
* resumir conversa;
* personalizar respostas.

Resultado esperado:

```text
Respostas mais alinhadas ao usuário.
```

## Fase 8 — Métricas e estabilização

Objetivo:

* medir latência;
* tratar falhas;
* reduzir consumo;
* preparar instalador.

Resultado esperado:

```text
MVP pronto para testes reais.
```

---

# 16. MVP recomendado

O MVP deverá incluir somente:

1. Captura de áudio da aba.
2. Whisper Small local.
3. Transcrição em tempo real.
4. Detector simples de pergunta.
5. Chamada para uma API rápida.
6. Resposta em streaming.
7. Painel flutuante.
8. TTS por frases.
9. Cancelamento de resposta.
10. Perfil e vaga em arquivos JSON.

Não incluir inicialmente:

* modelo local de 2B;
* banco de dados complexo;
* múltiplos provedores simultâneos;
* reconhecimento de participantes;
* análise semântica avançada;
* automações autônomas.

---

# 17. Critérios de sucesso do MVP

O MVP será considerado bem-sucedido quando:

* capturar o áudio sem interromper a reunião;
* transcrever com qualidade suficiente;
* detectar a maioria das perguntas claras;
* mostrar a primeira sugestão em até três segundos;
* cancelar respostas desatualizadas;
* manter estabilidade por pelo menos uma hora;
* iniciar o TTS sem travar o painel;
* funcionar na RTX 3050 de 6 GB;
* não expor a chave da API na extensão;
* manter o áudio local.

---

# 18. Principais riscos

## Risco 1 — Latência elevada

Mitigação:

* streaming;
* contexto reduzido;
* modelo rápido;
* detecção por regras;
* cancelamento;
* blocos menores de áudio.

## Risco 2 — Whisper transcrever termos técnicos incorretamente

Mitigação:

* lista de termos;
* prompt inicial;
* dicionário de tecnologias;
* correção posterior;
* contexto da vaga.

## Risco 3 — Pergunta detectada cedo demais

Mitigação:

* aguardar pausa mínima;
* usar transcrição parcial apenas como pré-carregamento;
* cancelar e reiniciar quando o texto mudar.

## Risco 4 — Resposta grande demais

Mitigação:

* limite de tokens;
* formato estruturado;
* prompt rígido;
* parser e truncamento.

## Risco 5 — TTS atrapalhar a reunião

Mitigação:

* volume baixo;
* modo manual;
* leitura por frases;
* interrupção imediata;
* limite de duração.

## Risco 6 — Modelo inventar experiências

Mitigação:

* regras explícitas;
* perfil estruturado;
* saída validada;
* sinalização de baixa confiança.

## Risco 7 — Falta de consentimento ou questões de privacidade

Mitigação:

* uso local;
* aviso claro;
* gravação desativada;
* consentimento conforme regras e legislação aplicáveis.

---

# 19. Estrutura final do repositório

```text
./
├── apps/
│   ├── chrome-extension/
│   └── orchestrator/
├── services/
│   └── whisper/
├── packages/
│   ├── protocol/
│   ├── shared-types/
│   ├── prompt-templates/
│   └── configuration/
├── profiles/
│   ├── candidate.example.json
│   └── job.example.json
├── scripts/
│   ├── install.ps1
│   ├── start.ps1
│   ├── stop.ps1
│   └── health-check.ps1
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   ├── protocol.md
│   └── installation.md
├── docker-compose.yml
├── package.json
└── README.md
```

---

# 20. Decisão técnica recomendada

A configuração inicial mais equilibrada será:

```text
Extensão:
React + TypeScript + Manifest V3

Backend:
Node.js + Fastify + WebSocket

Transcrição:
faster-whisper Small + CUDA

IA:
API rápida acessada diretamente pelo backend

TTS:
speechSynthesis do Chrome

Contexto:
Memória em processo + arquivos JSON

Persistência:
SQLite somente quando necessária

Comunicação:
WebSocket entre extensão e backend

Resposta:
Streaming estruturado

Meta:
Primeira sugestão útil em até 3 segundos
```

Essa divisão mantém o caminho crítico simples, reduz a latência e permite evoluir cada parte sem reconstruir todo o sistema.
