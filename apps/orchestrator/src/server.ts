import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import dotenv from 'dotenv';
import WebSocket from 'ws';

import { ContextManager } from './services/context-manager.js';
import { GeminiProvider } from './services/gemini.js';
import { QuestionDetector } from './services/question-detector.js';
import { WhisperClient } from './services/whisper-client.js';
import { MeetingSummaryService } from './services/meeting-summary.js';
import { AnswerProvider, AnswerEvent } from './services/answer-provider.js';
import {
  WSMessage,
  Settings,
  Utterance,
  ResponseMode,
  StatusUpdatePayload,
  QuestionMetrics
} from '@conversation-copilot/shared-types';

dotenv.config();

// ============================================================
// Inicialização
// ============================================================

const server = Fastify({ logger: true });

const defaultContextManager = new ContextManager();
const sessionContexts = new Map<string, ContextManager>();
const sessionActiveRequests = new Map<string, string>();
const socketSessionMap = new Map<WebSocket, string>();

let activeAudioSessionId: string | null = null;

function getContextManager(sessionId?: string): ContextManager {
  if (!sessionId) return defaultContextManager;
  let cm = sessionContexts.get(sessionId);
  if (!cm) {
    cm = new ContextManager();
    sessionContexts.set(sessionId, cm);
  }
  return cm;
}

const geminiProvider = new GeminiProvider(process.env.GEMINI_API_KEY);
const whisperClient = new WhisperClient(
  process.env.WHISPER_WS_URL || 'ws://localhost:8000/ws/transcribe'
);

// AnswerProvider substituível (RNF-006)
let answerProvider: AnswerProvider = geminiProvider;

let activeConnections = new Set<WebSocket>();
let activeSessionId: string | null = null;
let currentResponseMode: ResponseMode = 'short';

// ============================================================
// Métricas (RNF-007)
// ============================================================

const questionMetrics: QuestionMetrics[] = [];
let currentMetrics: Partial<QuestionMetrics> | null = null;

// ============================================================
// Broadcast por Aba / Sessão
// ============================================================

function broadcastToSession(targetSessionId: string | undefined, msg: WSMessage) {
  if (!targetSessionId) {
    return;
  }

  const messageWithSession = { ...msg, sessionId: targetSessionId };
  const jsonStr = JSON.stringify(messageWithSession);

  for (const conn of activeConnections) {
    if (conn.readyState === WebSocket.OPEN) {
      const connSessionId = socketSessionMap.get(conn);
      if (connSessionId === targetSessionId) {
        conn.send(jsonStr);
      }
    }
  }
}

function broadcastStatus(targetSessionId?: string) {
  const statusMsg: WSMessage = {
    type: 'status.update',
    sessionId: targetSessionId,
    payload: {
      whisperConnected: whisperClient.getIsConnected(),
      llmConfigured: answerProvider.isConfigured(),
      isCapturing: targetSessionId ? (activeSessionId === targetSessionId) : false,
      activeSessionId: targetSessionId || activeSessionId || undefined,
      responseMode: currentResponseMode
    } satisfies StatusUpdatePayload
  };

  const jsonStr = JSON.stringify(statusMsg);

  for (const conn of activeConnections) {
    if (conn.readyState === WebSocket.OPEN) {
      const connSessionId = socketSessionMap.get(conn);
      if (!targetSessionId || connSessionId === targetSessionId) {
        conn.send(jsonStr);
      }
    }
  }
}

// ============================================================
// Geração de resposta com IA (RF-009, RF-010)
// ============================================================

async function triggerLLMSuggestion(questionText: string, targetSessionId?: string) {
  const requestId = Math.random().toString(36).substring(2, 9);
  const sessionKey = targetSessionId || 'default';
  const lastActiveRequest = sessionActiveRequests.get(sessionKey);

  // RN-002: Cancela geração anterior da mesma sessão se existir
  if (lastActiveRequest) {
    await answerProvider.cancel(lastActiveRequest);
    broadcastToSession(targetSessionId, {
      type: 'answer.cancelled',
      sessionId: targetSessionId,
      payload: { id: lastActiveRequest, reason: 'Nova pergunta detectada' }
    });
  }

  sessionActiveRequests.set(sessionKey, requestId);

  // Inicia métricas (RNF-007)
  currentMetrics = {
    questionId: requestId,
    requestStarted: Date.now(),
    wasCancelled: false
  };

  const cm = getContextManager(targetSessionId);
  const prompt = cm.buildPromptPayload(questionText, currentResponseMode);

  try {
    const stream = answerProvider.generate({
      requestId,
      question: questionText,
      prompt,
      responseMode: currentResponseMode,
      userProfile: cm.getUserProfile(),
      jobDescription: cm.getJobDescription()
    });

    let isFirst = true;

    for await (const event of stream) {
      // Check if this request is still active for this session
      if (sessionActiveRequests.get(sessionKey) !== requestId) {
        break;
      }

      broadcastToSession(targetSessionId, {
        type: event.type,
        sessionId: targetSessionId,
        payload: event.data
      });

      // Métricas: registra primeiro token
      if (isFirst && event.type === 'answer.delta' && currentMetrics) {
        currentMetrics.firstToken = Date.now();
        isFirst = false;
      }

      if (event.type === 'answer.completed' && currentMetrics) {
        currentMetrics.completed = Date.now();
        currentMetrics.totalLatency = currentMetrics.completed - (currentMetrics.speechEnd || currentMetrics.requestStarted!);
        questionMetrics.push(currentMetrics as QuestionMetrics);
        currentMetrics = null;

        // RN-010: Atualiza resumo em background (assíncrono, não-bloqueante)
        if (cm.shouldUpdateSummary()) {
          triggerBackgroundSummary(targetSessionId);
        }
      }

      if (event.type === 'answer.cancelled' && currentMetrics) {
        currentMetrics.wasCancelled = true;
        currentMetrics.completed = Date.now();
        questionMetrics.push(currentMetrics as QuestionMetrics);
        currentMetrics = null;
      }

      if (event.type === 'answer.failed' && currentMetrics) {
        currentMetrics.completed = Date.now();
        questionMetrics.push(currentMetrics as QuestionMetrics);
        currentMetrics = null;
      }
    }
  } catch (err: any) {
    broadcastToSession(targetSessionId, {
      type: 'answer.failed',
      sessionId: targetSessionId,
      payload: { id: requestId, error: err.message }
    });
  }
}

async function triggerBackgroundSummary(targetSessionId?: string) {
  (async () => {
    try {
      const cm = getContextManager(targetSessionId);
      const recentUtterances = cm.getRecentUtterances();
      if (recentUtterances.length < 5) return;

      const summaryPrompt = cm.buildSummaryPrompt();
      const summaryStream = answerProvider.generate({
        requestId: `summary-${Date.now()}`,
        question: 'resumo',
        prompt: summaryPrompt,
        responseMode: 'short'
      });

      let summaryText = '';
      for await (const event of summaryStream) {
        if (event.type === 'answer.delta') {
          summaryText += (event.data as any).chunk || '';
        }
      }

      try {
        const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          cm.updateSummary(parsed);
        } else {
          cm.updateSummary({ summaryText });
        }
      } catch {
        cm.updateSummary({ summaryText });
      }

      server.log.info('Resumo da conversa atualizado em background.');
    } catch (err: any) {
      server.log.warn({ err }, 'Falha ao atualizar resumo em background (não-crítico).');
    }
  })();
}

// ============================================================
// Servidor
// ============================================================

async function startServer() {
  await server.register(fastifyCors, { origin: '*' });
  await server.register(fastifyWebsocket);

  // Inicia conexão com o serviço de transcrição (services/whisper/)
  whisperClient.connect((utterance: Utterance) => {
    const targetSessionId = activeAudioSessionId || activeSessionId || undefined;
    server.log.info({ text: utterance.text, isFinal: utterance.isFinal, targetSessionId }, 'Transcrição recebida do Whisper');

    const cm = getContextManager(targetSessionId);
    cm.addUtterance(utterance.text, utterance.speaker, utterance.isFinal);

    // Notifica a extensão da aba correspondente com o evento
    broadcastToSession(targetSessionId, {
      type: utterance.isFinal ? 'transcript.final' : 'transcript.partial',
      sessionId: targetSessionId,
      payload: utterance
    });

    if (currentMetrics) {
      currentMetrics.transcriptFinal = Date.now();
    }

    if (utterance.isFinal) {
      const detection = QuestionDetector.detect(utterance.text, 0, true);

      if (detection.isQuestion) {
        broadcastToSession(targetSessionId, {
          type: 'question.detected',
          sessionId: targetSessionId,
          payload: detection
        });

        if (currentMetrics) {
          currentMetrics.speechEnd = Date.now();
        } else {
          currentMetrics = { speechEnd: Date.now(), wasCancelled: false };
        }

        if (answerProvider.isConfigured()) {
          triggerLLMSuggestion(utterance.text, targetSessionId);
        }
      }
    }
  });

  // Health check
  server.get('/health', async () => {
    return {
      status: 'ok',
      whisperConnected: whisperClient.getIsConnected(),
      llmConfigured: answerProvider.isConfigured(),
      activeSession: activeSessionId,
      activeSessionsCount: sessionContexts.size,
      totalQuestions: questionMetrics.length,
      averageLatency: questionMetrics.length > 0
        ? Math.round(questionMetrics.reduce((sum, m) => sum + (m.totalLatency || 0), 0) / questionMetrics.length)
        : 0
    };
  });

  // WebSocket endpoint
  server.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection: any) => {
      const socket: WebSocket = connection.socket || connection;
      activeConnections.add(socket);
      server.log.info('Extensão Chrome conectada ao Orquestrador.');

      let receivedChunksCount = 0;
      let totalAudioBytes = 0;

      socket.on('message', async (rawMsg: Buffer, isBinary: boolean) => {
        // Frames binários = blocos de áudio (RF-003)
        if (isBinary) {
          receivedChunksCount++;
          totalAudioBytes += rawMsg.length;

          const socketSession = socketSessionMap.get(socket);
          if (socketSession) {
            activeAudioSessionId = socketSession;
          }

          if (receivedChunksCount % 50 === 0) {
            server.log.info({
              chunksReceived: receivedChunksCount,
              totalAudioBytes,
              socketSession,
              whisperConnected: whisperClient.getIsConnected()
            }, '🎙️ [Áudio] Recebendo fluxo de áudio PCM da extensão...');
          }

          whisperClient.sendAudioChunk(rawMsg);
          return;
        }

        try {
          const msg: WSMessage = JSON.parse(rawMsg.toString());
          server.log.info({ type: msg.type, sessionId: msg.sessionId, payload: msg.payload }, '📩 [WS Message] Recebida da extensão');

          if (msg.sessionId) {
            socketSessionMap.set(socket, msg.sessionId);
          }

          switch (msg.type) {
            case 'session.register': {
              const targetSessionId = msg.sessionId;
              if (targetSessionId) {
                socketSessionMap.set(socket, targetSessionId);
                server.log.info({ sessionId: targetSessionId }, '📋 [Sessão] Conexão associada à sessão da aba.');
              }
              broadcastStatus(targetSessionId);
              break;
            }

            case 'session.start': {
              const targetSessionId = msg.sessionId || `session-${Date.now()}`;
              socketSessionMap.set(socket, targetSessionId);
              activeSessionId = targetSessionId;
              activeAudioSessionId = targetSessionId;
              receivedChunksCount = 0;
              totalAudioBytes = 0;
              server.log.info({ sessionId: targetSessionId }, '🟢 [Sessão] Iniciada com sucesso.');
              broadcastStatus(targetSessionId);
              break;
            }

            case 'session.stop': {
              const targetSessionId = msg.sessionId || activeSessionId || undefined;
              server.log.info({ sessionId: targetSessionId, totalAudioBytes }, '🔴 [Sessão] Encerrada pelo usuário.');

              const sessionKey = targetSessionId || 'default';
              const activeReq = sessionActiveRequests.get(sessionKey);
              if (activeReq) {
                await answerProvider.cancel(activeReq);
                sessionActiveRequests.delete(sessionKey);
              }

              if (targetSessionId && activeSessionId === targetSessionId) {
                activeSessionId = null;
              }
              broadcastStatus(targetSessionId);

              // Gerar ata em background ao encerrar a chamada (D-01, D-05)
              const cm = getContextManager(targetSessionId);
              MeetingSummaryService.generateSummary(cm, geminiProvider).then(markdown => {
                broadcastToSession(targetSessionId, {
                  type: 'meeting.summary.completed' as any,
                  sessionId: targetSessionId,
                  payload: { markdown }
                });
              }).catch(err => {
                server.log.error(err, 'Erro ao gerar ata da reunião em background');
              });

              break;
            }

            case 'answer.force': {
              const targetSessionId = msg.sessionId || socketSessionMap.get(socket);
              const cm = getContextManager(targetSessionId);
              const lastUtterances = cm.getRecentUtterances();
              const lastQuestion = lastUtterances.length > 0
                ? lastUtterances[lastUtterances.length - 1].text
                : 'Fale sobre suas experiências relevantes para a vaga.';

              server.log.info({ question: lastQuestion, targetSessionId }, '⚡ [Disparo Manual] Forçando geração de sugestão...');
              triggerLLMSuggestion(lastQuestion, targetSessionId);
              break;
            }

            case 'answer.cancel': {
              const targetSessionId = msg.sessionId || socketSessionMap.get(socket);
              const sessionKey = targetSessionId || 'default';
              const activeReq = sessionActiveRequests.get(sessionKey);
              if (activeReq) {
                await answerProvider.cancel(activeReq);
                broadcastToSession(targetSessionId, {
                  type: 'answer.cancelled',
                  sessionId: targetSessionId,
                  payload: { id: activeReq, reason: 'Cancelado pelo usuário' }
                });
                sessionActiveRequests.delete(sessionKey);
              }
              break;
            }

            case 'settings.update': {
              const targetSessionId = msg.sessionId || socketSessionMap.get(socket);
              const settings = msg.payload as Partial<Settings>;
              server.log.info({ responseMode: settings.responseMode, targetSessionId }, '⚙️ [Configurações] Atualizadas');

              const cm = getContextManager(targetSessionId);
              if (settings.geminiApiKey) {
                geminiProvider.setApiKey(settings.geminiApiKey);
              }
              if (settings.userProfile) {
                cm.updateProfile(settings.userProfile);
              }
              if (settings.jobDescription) {
                cm.updateJobDescription(settings.jobDescription);
              }
              if (settings.responseMode) {
                currentResponseMode = settings.responseMode;
              }

              broadcastStatus(targetSessionId);
              break;
            }
          }
        } catch (err) {
          server.log.error(err, 'Erro ao processar mensagem do cliente');
        }
      });

      socket.on('close', () => {
        socketSessionMap.delete(socket);
        activeConnections.delete(socket);
        server.log.info('Extensão desconectada.');
      });
    });
  });

  // RNF-005: Bind somente em 127.0.0.1
  const PORT = Number(process.env.PORT) || 3001;
  const HOST = process.env.HOST || '127.0.0.1';

  server.listen({ port: PORT, host: HOST }, (err, address) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
    console.log(`Orquestrador rodando em: ${address}`);
  });
}

startServer();
