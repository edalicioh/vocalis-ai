import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import WebSocket from 'ws';
import { processUtterance, server, startServer } from '../server.js';
import {
  QuestionDetectionResult,
  StatusUpdatePayload,
  WSMessage
} from '@conversation-copilot/shared-types';

describe('Orchestrator Fastify Server & WebSocket Interface', () => {
  let serverAddress: string;

  beforeAll(async () => {
    // Inicializa os plugins do servidor fastify
    await startServer();
    // Escuta em uma porta efêmera aleatória para os testes de integração
    const address = await server.listen({ port: 0, host: '127.0.0.1' });
    serverAddress = address;
  });

  afterAll(async () => {
    await server.close();
  });

  it('deve responder OK no endpoint GET /health', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
    expect(body.whisperConnected).toBeDefined();
    expect(body.llmConfigured).toBeDefined();
  });

  it('deve aceitar conexões WebSocket no endpoint /ws e responder com status.update ao evento session.start', async () => {
    const wsUrl = serverAddress.replace('http://', 'ws://') + '/ws';
    const ws = new WebSocket(wsUrl);

    const receivedMessages: WSMessage[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        // Envia mensagem session.start
        const startMsg: WSMessage = {
          type: 'session.start',
          sessionId: 'test-session-123'
        };
        ws.send(JSON.stringify(startMsg));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        receivedMessages.push(msg);

        if (msg.type === 'status.update') {
          resolve();
        }
      });

      ws.on('error', (err) => reject(err));
    });

    ws.close();

    expect(receivedMessages.length).toBeGreaterThan(0);
    const statusMsg = receivedMessages.find((m) => m.type === 'status.update');
    expect(statusMsg).toBeDefined();
    expect(statusMsg?.sessionId).toBe('test-session-123');

    const payload = statusMsg?.payload as StatusUpdatePayload;
    expect(payload.isCapturing).toBe(true);
    expect(payload.activeSessionId).toBe('test-session-123');
  });

  it('deve processar o evento settings.update e transmitir o status atualizado', async () => {
    const wsUrl = serverAddress.replace('http://', 'ws://') + '/ws';
    const ws = new WebSocket(wsUrl);

    const receivedMessages: WSMessage[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        const settingsMsg: WSMessage = {
          type: 'settings.update',
          sessionId: 'test-session-settings',
          payload: {
            responseMode: 'full',
            userProfile: {
              name: 'Maria QA',
              role: 'Engenheira de Testes'
            }
          }
        };
        ws.send(JSON.stringify(settingsMsg));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        receivedMessages.push(msg);
        if (msg.type === 'status.update') {
          resolve();
        }
      });

      ws.on('error', (err) => reject(err));
    });

    ws.close();

    const statusMsg = receivedMessages.find((m) => m.type === 'status.update');
    expect(statusMsg).toBeDefined();
    expect(statusMsg?.sessionId).toBe('test-session-settings');

    const payload = statusMsg?.payload as StatusUpdatePayload;
    expect(payload.responseMode).toBe('full');
  });

  it('deve transmitir pergunta e tom, reconstruindo parciais sem duplicar perguntas', async () => {
    const sessionId = 'test-session-detection';
    const wsUrl = serverAddress.replace('http://', 'ws://') + '/ws';
    const ws = new WebSocket(wsUrl);
    const receivedMessages: WSMessage[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'settings.update',
          sessionId,
          payload: {
            aiProvider: 'openai',
            conversationAnalysisMode: 'local'
          }
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        receivedMessages.push(msg);

        if (msg.type === 'status.update') {
          processUtterance({
            id: 'partial-1',
            speaker: 'interviewer',
            text: 'como você faria',
            timestamp: Date.now(),
            isFinal: false
          }, sessionId);

          const finalUtterance = {
            id: 'final-1',
            speaker: 'interviewer' as const,
            text: 'como você faria o cache distribuído?',
            timestamp: Date.now(),
            isFinal: true
          };
          processUtterance(finalUtterance, sessionId);
          processUtterance({ ...finalUtterance, id: 'final-2' }, sessionId);
        }

        const finalCount = receivedMessages.filter(message => message.type === 'transcript.final').length;
        const toneCount = receivedMessages.filter(message => message.type === 'conversation.tone.updated').length;
        if (finalCount === 2 && toneCount === 2) {
          resolve();
        }
      });

      ws.on('error', reject);
    });

    ws.close();

    const detectedQuestions = receivedMessages.filter(message => message.type === 'question.detected');
    expect(detectedQuestions).toHaveLength(1);
    expect((detectedQuestions[0].payload as QuestionDetectionResult).questionText)
      .toBe('como você faria o cache distribuído?');
    expect(receivedMessages.some(message => message.type === 'conversation.tone.updated')).toBe(true);
  });

  it('não deve detectar como pergunta uma fala do candidato', async () => {
    const sessionId = 'test-session-candidate';
    const wsUrl = serverAddress.replace('http://', 'ws://') + '/ws';
    const ws = new WebSocket(wsUrl);
    const receivedMessages: WSMessage[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'session.register', sessionId }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        receivedMessages.push(msg);

        if (msg.type === 'status.update') {
          processUtterance({
            id: 'candidate-question',
            speaker: 'candidate',
            text: 'Posso explicar como implementei o cache?',
            timestamp: Date.now(),
            isFinal: true
          }, sessionId);
        }

        if (msg.type === 'conversation.tone.updated') {
          resolve();
        }
      });

      ws.on('error', reject);
    });

    ws.close();

    expect(receivedMessages.some(message => message.type === 'transcript.final')).toBe(true);
    expect(receivedMessages.some(message => message.type === 'question.detected')).toBe(false);
  });

  it('deve enfileirar perguntas explícitas e responder todas na ordem', async () => {
    const sessionId = 'test-session-question-queue';
    const wsUrl = serverAddress.replace('http://', 'ws://') + '/ws';
    const ws = new WebSocket(wsUrl);
    const receivedMessages: WSMessage[] = [];
    let utterancesSent = false;

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Resposta da fila."}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });
      return { ok: true, body: stream };
    }));

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'settings.update',
          sessionId,
          payload: {
            aiProvider: 'custom_proxy',
            customProxyEndpoint: 'https://proxy.test/v1/chat/completions',
            customProxyModel: 'modelo-teste',
            conversationAnalysisMode: 'local'
          }
        }));
      });

      ws.on('message', data => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        receivedMessages.push(msg);

        if (msg.type === 'status.update' && !utterancesSent) {
          utterancesSent = true;
          processUtterance({
            id: 'queue-question-1',
            speaker: 'interviewer',
            text: 'Where are you going?',
            timestamp: Date.now(),
            isFinal: true
          }, sessionId);
          processUtterance({
            id: 'queue-question-2',
            speaker: 'interviewer',
            text: 'Why are you going there?',
            timestamp: Date.now() + 1,
            isFinal: true
          }, sessionId);
        }

        if (receivedMessages.filter(message => message.type === 'answer.completed').length === 2) {
          resolve();
        }
      });

      ws.on('error', reject);
    });

    ws.close();
    vi.unstubAllGlobals();

    const startedQuestions = receivedMessages
      .filter(message => message.type === 'answer.started')
      .map(message => (message.payload as { question: string }).question);
    expect(startedQuestions).toEqual(['Where are you going?', 'Why are you going there?']);
    expect(receivedMessages.some(message => message.type === 'answer.cancelled')).toBe(false);
  });

  it('não deve detectar perguntas nem gerar respostas no modo general (passivo)', async () => {
    const sessionId = 'test-session-general';
    const wsUrl = serverAddress.replace('http://', 'ws://') + '/ws';
    const ws = new WebSocket(wsUrl);
    const receivedMessages: WSMessage[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'settings.update',
          sessionId,
          payload: {
            aiProvider: 'custom_proxy',
            customProxyEndpoint: 'https://proxy.test/v1/chat/completions',
            customProxyModel: 'modelo-teste',
            meetingMode: 'general',
            conversationAnalysisMode: 'local'
          }
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        receivedMessages.push(msg);

        if (msg.type === 'status.update') {
          processUtterance({
            id: 'general-question-1',
            speaker: 'interviewer',
            text: 'Qual seria a melhor estratégia de cache distribuído aqui?',
            timestamp: Date.now(),
            isFinal: true
          }, sessionId);
        }

        if (msg.type === 'conversation.tone.updated') {
          resolve();
        }
      });

      ws.on('error', reject);
    });

    ws.close();

    expect(receivedMessages.some(message => message.type === 'transcript.final')).toBe(true);
    expect(receivedMessages.some(message => message.type === 'question.detected')).toBe(false);
    expect(receivedMessages.some(message => message.type === 'answer.started')).toBe(false);
  });

  it('deve publicar conversation.summary.updated com snapshot estruturado após 5 falas finais', async () => {
    const sessionId = 'test-session-summary';
    const wsUrl = serverAddress.replace('http://', 'ws://') + '/ws';
    const ws = new WebSocket(wsUrl);
    const receivedMessages: WSMessage[] = [];
    let utterancesSent = false;

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(
            'data: {"choices":[{"delta":{"content":"{\\"topics\\":[\\"Entregas\\"],\\"decisions\\":[\\"Usar Kafka\\"],\\"actionItems\\":[\\"Criar PR\\"],\\"summaryText\\":\\"Alinhamento da sprint concluído.\\"}"}}]}\n\n'
          ));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });
      return { ok: true, body: stream };
    }));

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'settings.update',
          sessionId,
          payload: {
            aiProvider: 'custom_proxy',
            customProxyEndpoint: 'https://proxy.test/v1/chat/completions',
            customProxyModel: 'modelo-teste',
            meetingMode: 'general',
            conversationAnalysisMode: 'local'
          }
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessage;
        receivedMessages.push(msg);

        if (msg.type === 'status.update' && !utterancesSent) {
          utterancesSent = true;
          for (let i = 1; i <= 5; i++) {
            processUtterance({
              id: `summary-utterance-${i}`,
              speaker: 'interviewer',
              text: `Fala de alinhamento número ${i}.`,
              timestamp: Date.now() + i,
              isFinal: true
            }, sessionId);
          }
        }

        const readySummaries = receivedMessages.filter(
          message => message.type === 'conversation.summary.updated'
            && (message.payload as any)?.status === 'ready'
        );
        if (readySummaries.length >= 1) {
          resolve();
        }
      });

      ws.on('error', reject);
    });

    ws.close();
    vi.unstubAllGlobals();

    const summaryMessages = receivedMessages.filter(message => message.type === 'conversation.summary.updated');
    expect(summaryMessages.length).toBeGreaterThanOrEqual(2);

    const readyMessage = summaryMessages.find(message => (message.payload as any)?.status === 'ready');
    expect(readyMessage).toBeDefined();
    const payload = (readyMessage?.payload as any);
    expect(payload.summary.summaryText).toContain('Alinhamento');
    expect(payload.summary.decisions).toContain('Usar Kafka');
    expect(payload.summary.actionItems).toContain('Criar PR');
    expect(payload.isFinal).toBe(false);
  });
});
