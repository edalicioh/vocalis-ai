import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import dotenv from 'dotenv';
import WebSocket from 'ws';

import { ContextManager } from './services/context-manager.js';
import { QuestionDetector } from './services/question-detector.js';
import { WhisperClient } from './services/whisper-client.js';
import { MeetingSummaryService } from './services/meeting-summary.js';
import { AnswerProviderManager } from './services/provider-manager.js';
import { AnswerProvider } from './services/answer-provider.js';
import { ToneAnalyzer } from './services/tone-analyzer.js';
import { ExternalConversationAnalyzer } from './services/external-conversation-analyzer.js';
import {
  WSMessage,
  Settings,
  Utterance,
  ResponseMode,
  StatusUpdatePayload,
  QuestionMetrics,
  AIProvider,
  AudioSource,
  ConversationAnalysisMode,
  QuestionDetectionResult,
  ConversationSummaryUpdatePayload,
  SessionRegisterPayload
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
const socketAudioSourceMap = new Map<WebSocket, AudioSource>();
const pendingQuestionValidations = new Map<string, {
  candidateKey: string;
  version: number;
  controller: AbortController;
}>();
const pendingToneRefinements = new Map<string, {
  version: number;
  controller: AbortController;
}>();
const pendingSummaryRefinements = new Map<string, {
  version: number;
  isFinal: boolean;
  controller: AbortController;
}>();
const queuedQuestionValidations = new Map<string, QuestionDetectionResult>();
const queuedSuggestionQuestions = new Map<string, string[]>();
const sessionUtteranceVersions = new Map<string, number>();
const recentDetectedQuestions = new Map<string, { normalizedText: string; detectedAt: number }>();
const activeCaptureSessions = new Set<string>();

let activeAudioSessionId: string | null = null;
let defaultConversationAnalysisMode: ConversationAnalysisMode = 'local';

function getContextManager(sessionId?: string): ContextManager {
  if (!sessionId) return defaultContextManager;
  let cm = sessionContexts.get(sessionId);
  if (!cm) {
    cm = new ContextManager();
    cm.setConversationAnalysisMode(defaultConversationAnalysisMode);
    sessionContexts.set(sessionId, cm);
  }
  return cm;
}

const providerManager = new AnswerProviderManager();
const externalQuestionAnalyzer = new ExternalConversationAnalyzer(providerManager, {
  timeoutMs: Number(process.env.EXTERNAL_QUESTION_TIMEOUT_MS) || 1_200,
  utteranceWindowSize: 8
});
const externalToneAnalyzer = new ExternalConversationAnalyzer(providerManager, {
  timeoutMs: Number(process.env.EXTERNAL_TONE_TIMEOUT_MS) || 5_000,
  utteranceWindowSize: 8
});
if (process.env.GEMINI_API_KEY) {
  providerManager.geminiProvider.setApiKey(process.env.GEMINI_API_KEY);
}
const whisperUrl = process.env.WHISPER_WS_URL || 'ws://localhost:8000/ws/transcribe';
const whisperClients = new Map<string, WhisperClient>();

function getWhisperClientKey(sessionId: string, source: AudioSource): string {
  return `${sessionId}:${source}`;
}

function getWhisperClient(sessionId: string, source: AudioSource): WhisperClient {
  const key = getWhisperClientKey(sessionId, source);
  const existingClient = whisperClients.get(key);
  if (existingClient) return existingClient;

  const client = new WhisperClient(
    whisperUrl,
    source === 'tab' ? 'interviewer' : 'candidate'
  );
  whisperClients.set(key, client);
  client.connect(
    (utterance: Utterance) => {
      if (!activeCaptureSessions.has(sessionId) || whisperClients.get(key) !== client) {
        server.log.debug({ sessionId, source }, 'Transcrição tardia ignorada porque a sessão de áudio não está ativa.');
        return;
      }
      processUtterance(utterance, sessionId);
    },
    () => broadcastStatus(sessionId)
  );
  return client;
}

function isWhisperConnected(sessionId?: string): boolean {
  const clients = sessionId
    ? (['tab', 'microphone'] as const)
      .map(source => whisperClients.get(getWhisperClientKey(sessionId, source)))
      .filter((client): client is WhisperClient => Boolean(client))
    : [...whisperClients.values()];
  return clients.length > 0 && clients.every(client => client.getIsConnected());
}

// AnswerProvider substituível (RNF-006)
let answerProvider: AnswerProvider = providerManager;

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
      whisperConnected: isWhisperConnected(targetSessionId),
      llmConfigured: answerProvider.isConfigured(),
      isCapturing: targetSessionId ? activeCaptureSessions.has(targetSessionId) : false,
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

function enqueueLLMSuggestion(questionText: string, targetSessionId?: string): void {
  const sessionKey = getSessionKey(targetSessionId);
  if (!sessionActiveRequests.has(sessionKey)) {
    void triggerLLMSuggestion(questionText, targetSessionId);
    return;
  }

  const queue = queuedSuggestionQuestions.get(sessionKey) || [];
  queue.push(questionText);
  queuedSuggestionQuestions.set(sessionKey, queue);
  server.log.info(
    { question: questionText, queuedQuestions: queue.length, targetSessionId },
    'Pergunta adicionada à fila de sugestões.'
  );
}

async function triggerLLMSuggestion(questionText: string, targetSessionId?: string) {
  const requestId = Math.random().toString(36).substring(2, 9);
  const sessionKey = getSessionKey(targetSessionId);

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
          triggerContinuousSummary(targetSessionId);
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
  } finally {
    if (sessionActiveRequests.get(sessionKey) === requestId) {
      sessionActiveRequests.delete(sessionKey);
      const queuedQuestions = queuedSuggestionQuestions.get(sessionKey);
      const nextQuestion = queuedQuestions?.shift();
      if (queuedQuestions?.length === 0) {
        queuedSuggestionQuestions.delete(sessionKey);
      }

      if (nextQuestion) {
        void triggerLLMSuggestion(nextQuestion, targetSessionId);
      } else {
        const queuedDetection = queuedQuestionValidations.get(sessionKey);
        if (queuedDetection) {
          queuedQuestionValidations.delete(sessionKey);
          void validateAmbiguousQuestion(queuedDetection, targetSessionId);
        }
      }
    }
  }
}

function broadcastSummaryStatus(targetSessionId: string | undefined, payload: ConversationSummaryUpdatePayload): void {
  broadcastToSession(targetSessionId, {
    type: 'conversation.summary.updated',
    sessionId: targetSessionId,
    payload
  });
}

/**
 * Sumarização contínua da conversa (RF-018) com snapshot estruturado.
 * Dispara a cada 5 falas finais (ou ao encerrar a sessão, com isFinal=true)
 * e publica o evento conversation.summary.updated no painel.
 * Assíncrona e não-bloqueante (RN-010).
 */
function triggerContinuousSummary(targetSessionId?: string, isFinal = false, versionOverride?: number): void {
  const cm = getContextManager(targetSessionId);
  const sessionKey = getSessionKey(targetSessionId);

  if (!answerProvider.isConfigured() || pendingSummaryRefinements.has(sessionKey)) {
    return;
  }
  if (!isFinal && !cm.shouldUpdateSummary()) {
    return;
  }
  if (!isFinal && cm.getRecentUtterances().filter(u => u.isFinal).length < 5) {
    return;
  }

  const version = versionOverride ?? (sessionUtteranceVersions.get(sessionKey) || 0);
  const controller = new AbortController();
  const pendingSummary = { version, isFinal, controller };
  pendingSummaryRefinements.set(sessionKey, pendingSummary);

  broadcastSummaryStatus(targetSessionId, {
    status: 'generating',
    summary: cm.getSummary(),
    utteranceVersion: version,
    isFinal
  });

  void (async () => {
    try {
      const result = await MeetingSummaryService.generateStructuredSummary(cm, answerProvider, controller.signal);
      const currentVersion = sessionUtteranceVersions.get(sessionKey) || 0;
      if (pendingSummaryRefinements.get(sessionKey) !== pendingSummary) {
        return;
      }
      if (!isFinal && currentVersion !== version) {
        return;
      }

      if (result) {
        cm.updateSummary(result);
        broadcastSummaryStatus(targetSessionId, {
          status: 'ready',
          summary: cm.getSummary(),
          utteranceVersion: version,
          isFinal
        });
        server.log.info(
          { targetSessionId, isFinal, utteranceVersion: version },
          'Resumo da conversa atualizado (snapshot estruturado).'
        );
      } else {
        broadcastSummaryStatus(targetSessionId, {
          status: 'error',
          summary: cm.getSummary(),
          utteranceVersion: version,
          isFinal,
          error: 'Não foi possível gerar o resumo da conversa.'
        });
      }
    } catch (err: any) {
      server.log.warn({ err }, 'Falha ao gerar resumo contínuo (não-crítico).');
      if (pendingSummaryRefinements.get(sessionKey) === pendingSummary) {
        broadcastSummaryStatus(targetSessionId, {
          status: 'error',
          summary: cm.getSummary(),
          utteranceVersion: version,
          isFinal,
          error: err?.message || 'Falha ao gerar o resumo da conversa.'
        });
      }
    } finally {
      if (pendingSummaryRefinements.get(sessionKey) === pendingSummary) {
        pendingSummaryRefinements.delete(sessionKey);
      }
    }
  })();
}

// ============================================================
// Análise externa seletiva (background, não-bloqueante)
// ============================================================

function getSessionKey(targetSessionId?: string): string {
  return targetSessionId || 'default';
}

function normalizeQuestionText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDuplicateQuestion(questionText: string, targetSessionId?: string): boolean {
  const sessionKey = getSessionKey(targetSessionId);
  const normalizedText = normalizeQuestionText(questionText);
  const previous = recentDetectedQuestions.get(sessionKey);
  if (!previous || Date.now() - previous.detectedAt > 5_000) {
    return false;
  }

  return normalizedText === previous.normalizedText;
}

function publishDetectedQuestion(
  detection: QuestionDetectionResult,
  targetSessionId?: string
): void {
  if (isDuplicateQuestion(detection.questionText, targetSessionId)) {
    server.log.info({ question: detection.questionText, targetSessionId }, 'Pergunta duplicada ignorada.');
    return;
  }

  const sessionKey = getSessionKey(targetSessionId);
  pendingQuestionValidations.get(sessionKey)?.controller.abort();
  pendingQuestionValidations.delete(sessionKey);
  queuedQuestionValidations.delete(sessionKey);
  pendingToneRefinements.get(sessionKey)?.controller.abort();
  pendingToneRefinements.delete(sessionKey);
  recentDetectedQuestions.set(sessionKey, {
    normalizedText: normalizeQuestionText(detection.questionText),
    detectedAt: Date.now()
  });

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
    enqueueLLMSuggestion(detection.questionText, targetSessionId);
  }
}

async function validateAmbiguousQuestion(
  detection: QuestionDetectionResult,
  targetSessionId?: string
): Promise<void> {
  const cm = getContextManager(targetSessionId);
  const sessionKey = getSessionKey(targetSessionId);
  if (
    cm.getConversationAnalysisMode() !== 'hybrid'
    || !QuestionDetector.shouldValidateExternally(detection.score)
    || !answerProvider.isConfigured()
  ) {
    return;
  }

  if (sessionActiveRequests.has(sessionKey)) {
    queuedQuestionValidations.set(sessionKey, detection);
    return;
  }

  const candidateKey = normalizeQuestionText(detection.questionText);
  const version = sessionUtteranceVersions.get(sessionKey) || 0;
  const controller = new AbortController();
  const pendingValidation = { candidateKey, version, controller };
  pendingQuestionValidations.get(sessionKey)?.controller.abort();
  pendingToneRefinements.get(sessionKey)?.controller.abort();
  pendingToneRefinements.delete(sessionKey);
  pendingQuestionValidations.set(sessionKey, pendingValidation);

  try {
    const result = await externalQuestionAnalyzer.validateAmbiguousQuestion({
      candidateText: detection.questionText,
      accumulatedSummary: cm.getSummary().summaryText,
      recentUtterances: cm.getRecentUtterances(),
      meetingMode: cm.getMeetingMode()
    }, controller.signal);

    if (
      pendingQuestionValidations.get(sessionKey) !== pendingValidation
      || sessionUtteranceVersions.get(sessionKey) !== version
      || cm.getConversationAnalysisMode() !== 'hybrid'
      || !result?.isQuestion
      || result.confidence < QuestionDetector.LOCAL_DETECTION_THRESHOLD
    ) {
      return;
    }

    publishDetectedQuestion({
      isQuestion: true,
      score: result.confidence,
      reasons: [...detection.reasons, `validação externa: ${result.reason}`],
      questionText: result.questionText || detection.questionText
    }, targetSessionId);
  } finally {
    if (pendingQuestionValidations.get(sessionKey) === pendingValidation) {
      pendingQuestionValidations.delete(sessionKey);
    }
  }
}

function triggerBackgroundToneRefinement(targetSessionId?: string): void {
  const cm = getContextManager(targetSessionId);
  const sessionKey = getSessionKey(targetSessionId);
  if (
    cm.getConversationAnalysisMode() !== 'hybrid'
    || !cm.shouldRefineTone()
    || cm.getRecentUtterances().length < 3
    || sessionActiveRequests.has(sessionKey)
    || pendingQuestionValidations.has(sessionKey)
    || pendingToneRefinements.has(sessionKey)
    || !answerProvider.isConfigured()
  ) {
    return;
  }

  const version = sessionUtteranceVersions.get(sessionKey) || 0;
  const controller = new AbortController();
  const pendingRefinement = { version, controller };
  cm.markToneRefinementStarted();
  pendingToneRefinements.set(sessionKey, pendingRefinement);
  void (async () => {
    try {
      const result = await externalToneAnalyzer.refineTone({
        accumulatedSummary: cm.getSummary().summaryText,
        recentUtterances: cm.getRecentUtterances(),
        meetingMode: cm.getMeetingMode()
      }, controller.signal);
      const currentVersion = sessionUtteranceVersions.get(sessionKey) || 0;
      if (
        !result
        || pendingToneRefinements.get(sessionKey) !== pendingRefinement
        || currentVersion !== version
        || cm.getConversationAnalysisMode() !== 'hybrid'
      ) return;

      cm.updateTone(result.tone, result.confidence, result.summary);
      broadcastToSession(targetSessionId, {
        type: 'conversation.tone.updated',
        sessionId: targetSessionId,
        payload: cm.getTonePayload()
      });
      server.log.info(
        { tone: result.tone, confidence: result.confidence, targetSessionId },
        'Tom da conversa refinado externamente.'
      );
    } catch (err: any) {
      server.log.warn({ err }, 'Falha ao refinar o tom externamente (não-crítico).');
    } finally {
      if (pendingToneRefinements.get(sessionKey) === pendingRefinement) {
        pendingToneRefinements.delete(sessionKey);
      }
    }
  })();
}

function processUtterance(utterance: Utterance, targetSessionId?: string): void {
  const resolvedSessionId = targetSessionId || activeAudioSessionId || activeSessionId || undefined;
  server.log.info(
    { text: utterance.text, isFinal: utterance.isFinal, targetSessionId: resolvedSessionId },
    'Transcrição recebida do Whisper'
  );

  const cm = getContextManager(resolvedSessionId);
  const accumulatedPartials = cm.getAccumulatedPartials(utterance.speaker);
  cm.addUtterance(utterance.text, utterance.speaker, utterance.isFinal);

  broadcastToSession(resolvedSessionId, {
    type: utterance.isFinal ? 'transcript.final' : 'transcript.partial',
    sessionId: resolvedSessionId,
    payload: utterance
  });

  if (currentMetrics) {
    currentMetrics.transcriptFinal = Date.now();
  }

  if (!utterance.isFinal) return;

  const sessionKey = getSessionKey(resolvedSessionId);
  const utteranceVersion = (sessionUtteranceVersions.get(sessionKey) || 0) + 1;
  sessionUtteranceVersions.set(sessionKey, utteranceVersion);
  pendingQuestionValidations.get(sessionKey)?.controller.abort();
  pendingQuestionValidations.delete(sessionKey);
  queuedQuestionValidations.delete(sessionKey);

  // A transcrição final encerra a fala; o pipeline atual não fornece pausa pós-fala confiável.
  // No modo passivo (general), a transcrição é apenas exibida — sem detecção automática
  // de perguntas nem geração proativa de respostas (Alt+S continua disponível).
  if (utterance.speaker === 'interviewer' && !cm.isPassiveMode()) {
    const detections = QuestionDetector.detectAllWithContext(utterance.text, 0, true, {
      recentUtterances: cm.getRecentUtterances(),
      accumulatedPartials
    });

    for (const detection of detections) {
      if (detection.isQuestion) {
        publishDetectedQuestion(detection, resolvedSessionId);
      } else if (QuestionDetector.shouldValidateExternally(detection.score)) {
        void validateAmbiguousQuestion(detection, resolvedSessionId);
      }
    }
  }

  // Sumarização contínua: gera snapshot estruturado a cada 5 falas finais.
  if (cm.shouldUpdateSummary()) {
    triggerContinuousSummary(resolvedSessionId);
  }

  const toneResult = ToneAnalyzer.analyzeHeuristic(cm.getRecentUtterances());
  cm.updateTone(toneResult.tone, toneResult.confidence, toneResult.summary);
  broadcastToSession(resolvedSessionId, {
    type: 'conversation.tone.updated',
    sessionId: resolvedSessionId,
    payload: cm.getTonePayload()
  });

  triggerBackgroundToneRefinement(resolvedSessionId);
}

// ============================================================
// Servidor
// ============================================================

async function startServer() {
  await server.register(fastifyCors, { origin: '*' });
  await server.register(fastifyWebsocket);

  // Health check
  server.get('/health', async () => {
    return {
      status: 'ok',
      whisperConnected: isWhisperConnected(),
      llmConfigured: answerProvider.isConfigured(),
      activeSession: activeSessionId,
      activeSessionsCount: sessionContexts.size,
      totalQuestions: questionMetrics.length,
      averageLatency: questionMetrics.length > 0
        ? Math.round(questionMetrics.reduce((sum, m) => sum + (m.totalLatency || 0), 0) / questionMetrics.length)
        : 0
    };
  });

  // Rota para listagem dinâmica de modelos liberados por API
  server.get('/api/models', async (request, reply) => {
    const query = request.query as { provider?: AIProvider; apiKey?: string; endpoint?: string };
    const provider = query.provider || 'gemini';
    try {
      const models = await providerManager.fetchAvailableModels(provider, query.apiKey, query.endpoint);
      return { status: 'ok', provider, models };
    } catch (err: any) {
      server.log.error(err, 'Erro ao consultar modelos dinâmicos da API');
      return reply.status(500).send({ status: 'error', error: err?.message || 'Falha ao buscar modelos' });
    }
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
          const socketSession = socketSessionMap.get(socket);
          const audioSource = socketAudioSourceMap.get(socket);
          if (!socketSession || !activeCaptureSessions.has(socketSession)) {
            server.log.debug({ socketSession }, 'Frame de áudio ignorado porque a sessão não está ativa.');
            return;
          }
          if (!audioSource) {
            server.log.debug({ socketSession }, 'Frame de áudio ignorado porque a origem não foi registrada.');
            return;
          }

          receivedChunksCount++;
          totalAudioBytes += rawMsg.length;
          activeAudioSessionId = socketSession;
          const whisperClient = getWhisperClient(socketSession, audioSource);

          if (receivedChunksCount % 50 === 0) {
            server.log.info({
              chunksReceived: receivedChunksCount,
              totalAudioBytes,
              socketSession,
              audioSource,
              whisperConnected: whisperClient.getIsConnected()
            }, '🎙️ [Áudio] Recebendo fluxo de áudio PCM da extensão...');
          }

          whisperClient.sendAudioChunk(rawMsg);
          return;
        }

        try {
          const msg: WSMessage = JSON.parse(rawMsg.toString());
          server.log.info({ type: msg.type, sessionId: msg.sessionId }, '📩 [WS Message] Recebida da extensão');

          if (msg.sessionId) {
            socketSessionMap.set(socket, msg.sessionId);
          }

          switch (msg.type) {
            case 'session.register': {
              const targetSessionId = msg.sessionId;
              if (targetSessionId) {
                socketSessionMap.set(socket, targetSessionId);
                const { audioSource } = (msg.payload || {}) as SessionRegisterPayload;
                if (audioSource === 'tab' || audioSource === 'microphone') {
                  socketAudioSourceMap.set(socket, audioSource);
                }
                server.log.info({ sessionId: targetSessionId }, '📋 [Sessão] Conexão associada à sessão da aba.');
              }
              broadcastStatus(targetSessionId);
              break;
            }

            case 'session.start': {
              const targetSessionId = msg.sessionId || `session-${Date.now()}`;
              const isNewActivation = !activeCaptureSessions.has(targetSessionId);
              socketSessionMap.set(socket, targetSessionId);
              activeSessionId = targetSessionId;
              activeAudioSessionId = targetSessionId;
              if (isNewActivation) {
                getContextManager(targetSessionId).resetConversation();
              }
              activeCaptureSessions.add(targetSessionId);
              for (const source of ['tab', 'microphone'] as const) {
                getWhisperClient(targetSessionId, source).reset();
              }
              receivedChunksCount = 0;
              totalAudioBytes = 0;

              const settings = msg.payload as Partial<Settings> | undefined;
              if (settings) {
                const cm = getContextManager(targetSessionId);
                if (settings.meetingMode) {
                  cm.setMeetingMode(settings.meetingMode, settings.modeNotes);
                }
                if (settings.conversationAnalysisMode) {
                  cm.setConversationAnalysisMode(settings.conversationAnalysisMode);
                }
                providerManager.updateSettings(settings);
              }

              server.log.info({ sessionId: targetSessionId }, '🟢 [Sessão] Iniciada com sucesso.');
              broadcastStatus(targetSessionId);
              break;
            }

            case 'session.stop': {
              const targetSessionId = msg.sessionId || activeSessionId || undefined;
              server.log.info({ sessionId: targetSessionId, totalAudioBytes }, '🔴 [Sessão] Encerrada pelo usuário.');

              const sessionKey = targetSessionId || 'default';
              const stopVersion = sessionUtteranceVersions.get(sessionKey) || 0;
              const activeReq = sessionActiveRequests.get(sessionKey);
              if (activeReq) {
                await answerProvider.cancel(activeReq);
                sessionActiveRequests.delete(sessionKey);
              }
              pendingQuestionValidations.get(sessionKey)?.controller.abort();
              pendingQuestionValidations.delete(sessionKey);
              queuedQuestionValidations.delete(sessionKey);
              queuedSuggestionQuestions.delete(sessionKey);
              pendingToneRefinements.get(sessionKey)?.controller.abort();
              pendingToneRefinements.delete(sessionKey);
              pendingSummaryRefinements.get(sessionKey)?.controller.abort();
              pendingSummaryRefinements.delete(sessionKey);
              sessionUtteranceVersions.delete(sessionKey);
              recentDetectedQuestions.delete(sessionKey);
              if (targetSessionId) {
                activeCaptureSessions.delete(targetSessionId);
              }

              if (targetSessionId && activeSessionId === targetSessionId) {
                activeSessionId = null;
              }
              if (targetSessionId && activeAudioSessionId === targetSessionId) {
                activeAudioSessionId = null;
              }
              if (targetSessionId) {
                for (const source of ['tab', 'microphone'] as const) {
                  const key = getWhisperClientKey(targetSessionId, source);
                  whisperClients.get(key)?.disconnect();
                  whisperClients.delete(key);
                }
              }
              broadcastStatus(targetSessionId);

              // Resumo final da sessão exibido no painel (isFinal=true)
              triggerContinuousSummary(targetSessionId, true, stopVersion);

              // Gerar ata em background ao encerrar a chamada (D-01, D-05)
              const cm = getContextManager(targetSessionId);
              MeetingSummaryService.generateSummary(cm, providerManager.geminiProvider).then(markdown => {
                broadcastToSession(targetSessionId, {
                  type: 'meeting.summary.completed' as any,
                  sessionId: targetSessionId,
                  payload: { markdown }
                });
              }).catch(err => {
                server.log.error(err, 'Erro ao gerar ata da reunião em background');
              }).finally(() => {
                if (
                  targetSessionId
                  && !activeCaptureSessions.has(targetSessionId)
                  && sessionContexts.get(targetSessionId) === cm
                ) {
                  sessionContexts.delete(targetSessionId);
                }
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
              server.log.info({
                responseMode: settings.responseMode,
                aiProvider: settings.aiProvider,
                meetingMode: settings.meetingMode,
                conversationAnalysisMode: settings.conversationAnalysisMode,
                targetSessionId
              }, '⚙️ [Configurações] Atualizadas');

              const cm = getContextManager(targetSessionId);
              if (settings.meetingMode) {
                cm.setMeetingMode(settings.meetingMode, settings.modeNotes);
              }
              providerManager.updateSettings(settings);
              if (settings.userProfile) {
                cm.updateProfile(settings.userProfile);
              }
              if (settings.jobDescription) {
                cm.updateJobDescription(settings.jobDescription);
              }
              if (settings.responseMode) {
                currentResponseMode = settings.responseMode;
              }
              if (settings.conversationAnalysisMode) {
                if (targetSessionId) {
                  cm.setConversationAnalysisMode(settings.conversationAnalysisMode);
                  if (settings.conversationAnalysisMode === 'local') {
                    const sessionKey = getSessionKey(targetSessionId);
                    pendingQuestionValidations.get(sessionKey)?.controller.abort();
                    pendingQuestionValidations.delete(sessionKey);
                    queuedQuestionValidations.delete(sessionKey);
                    pendingToneRefinements.get(sessionKey)?.controller.abort();
                    pendingToneRefinements.delete(sessionKey);
                  }
                } else {
                  defaultConversationAnalysisMode = settings.conversationAnalysisMode;
                  defaultContextManager.setConversationAnalysisMode(settings.conversationAnalysisMode);
                  for (const sessionContext of sessionContexts.values()) {
                    sessionContext.setConversationAnalysisMode(settings.conversationAnalysisMode);
                  }
                  if (settings.conversationAnalysisMode === 'local') {
                    for (const pending of pendingQuestionValidations.values()) {
                      pending.controller.abort();
                    }
                    pendingQuestionValidations.clear();
                    queuedQuestionValidations.clear();
                    for (const pending of pendingToneRefinements.values()) {
                      pending.controller.abort();
                    }
                    pendingToneRefinements.clear();
                  }
                }
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
        socketAudioSourceMap.delete(socket);
        activeConnections.delete(socket);
        server.log.info('Extensão desconectada.');
      });
    });
  });

  // RNF-005: Bind somente em 127.0.0.1
  if (process.env.NODE_ENV !== 'test') {
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
}

export { processUtterance, server, startServer };

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
