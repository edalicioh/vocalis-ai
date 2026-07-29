import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer, WebSocket as ServerWebSocket } from 'ws';
import { WhisperClient } from '../whisper-client.js';
import { Utterance } from '@conversation-copilot/shared-types';

describe('WhisperClient', () => {
  let wss: WebSocketServer | null = null;
  let port: number;
  let client: WhisperClient | null = null;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (client) {
      client.disconnect();
      client = null;
    }
    if (wss) {
      await new Promise<void>((resolve) => wss?.close(() => resolve()));
      wss = null;
    }
  });

  function createTestServer(): Promise<{ server: WebSocketServer; port: number }> {
    return new Promise((resolve) => {
      const server = new WebSocketServer({ port: 0 }, () => {
        const address = server.address();
        const p = typeof address === 'object' && address ? address.port : 8000;
        resolve({ server, port: p });
      });
    });
  }

  it('deve conectar com sucesso ao servidor WebSocket e atualizar estado getIsConnected', async () => {
    const { server, port: testPort } = await createTestServer();
    wss = server;

    client = new WhisperClient(`ws://localhost:${testPort}`, 'interviewer');
    expect(client.getIsConnected()).toBe(false);

    let connectedOnServer = false;
    wss.on('connection', () => {
      connectedOnServer = true;
    });

    client.connect(() => {});

    // Aguarda ciclo de eventos de rede
    await vi.waitFor(() => {
      expect(connectedOnServer).toBe(true);
      expect(client?.getIsConnected()).toBe(true);
    });
  });

  it('deve receber e converter eventos transcript.final em Utterance', async () => {
    const { server, port: testPort } = await createTestServer();
    wss = server;

    const receivedUtterances: Utterance[] = [];
    client = new WhisperClient(`ws://localhost:${testPort}`, 'interviewer');

    wss.on('connection', (ws) => {
      // Envia evento de transcrição final quando o cliente conecta
      ws.send(
        JSON.stringify({
          type: 'transcript.final',
          payload: {
            text: 'Olá mundo da transcrição',
            probability: 0.98,
            language: 'pt',
            start: 0,
            end: 2.5
          }
        })
      );
    });

    client.connect((utterance) => {
      receivedUtterances.push(utterance);
    });

    await vi.waitFor(() => {
      expect(receivedUtterances.length).toBe(1);
    });

    const utt = receivedUtterances[0];
    expect(utt.text).toBe('Olá mundo da transcrição');
    expect(utt.isFinal).toBe(true);
    expect(utt.confidence).toBe(0.98);
    expect(utt.language).toBe('pt');
    expect(utt.speaker).toBe('interviewer');
  });

  it('deve identificar transcrições do canal do microfone como candidato', async () => {
    const { server, port: testPort } = await createTestServer();
    wss = server;

    const receivedUtterances: Utterance[] = [];
    client = new WhisperClient(`ws://localhost:${testPort}`, 'candidate');

    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({
        type: 'transcript.final',
        payload: { text: 'Esta é a minha resposta', confidence: 0.9 }
      }));
    });

    client.connect(utterance => receivedUtterances.push(utterance));

    await vi.waitFor(() => {
      expect(receivedUtterances).toHaveLength(1);
    });

    expect(receivedUtterances[0].speaker).toBe('candidate');
  });

  it('deve normalizar eventos legados como TRANSCRIPTION_DELTA para transcript.final', async () => {
    const { server, port: testPort } = await createTestServer();
    wss = server;

    const receivedUtterances: Utterance[] = [];
    client = new WhisperClient(`ws://localhost:${testPort}`);

    wss.on('connection', (ws) => {
      ws.send(
        JSON.stringify({
          type: 'TRANSCRIPTION_DELTA',
          payload: {
            text: 'Texto de evento legado',
            confidence: 0.85
          }
        })
      );
    });

    client.connect((utterance) => {
      receivedUtterances.push(utterance);
    });

    await vi.waitFor(() => {
      expect(receivedUtterances.length).toBe(1);
    });

    expect(receivedUtterances[0].text).toBe('Texto de evento legado');
    expect(receivedUtterances[0].isFinal).toBe(true);
    expect(receivedUtterances[0].confidence).toBe(0.85);
  });

  it('deve enviar áudio binário via sendAudioChunk', async () => {
    const { server, port: testPort } = await createTestServer();
    wss = server;

    let receivedBuffer: Buffer | null = null;
    wss.on('connection', (ws) => {
      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          receivedBuffer = Buffer.from(data as ArrayBuffer);
        }
      });
    });

    client = new WhisperClient(`ws://localhost:${testPort}`);
    client.connect(() => {});

    await vi.waitFor(() => {
      expect(client?.getIsConnected()).toBe(true);
    });

    const sampleChunk = Buffer.from([1, 2, 3, 4, 5]);
    client.sendAudioChunk(sampleChunk);

    await vi.waitFor(() => {
      expect(receivedBuffer).not.toBeNull();
      expect(receivedBuffer).toEqual(sampleChunk);
    });
  });

  it('deve descartar transcrições antigas até a confirmação do reset', async () => {
    const { server, port: testPort } = await createTestServer();
    wss = server;

    const receivedUtterances: Utterance[] = [];
    wss.on('connection', (ws) => {
      ws.on('message', (data, isBinary) => {
        if (isBinary) return;
        const message = JSON.parse(data.toString());
        if (message.type === 'RESET') {
          ws.send(JSON.stringify({
            type: 'transcript.final',
            payload: { text: 'Transcrição da sessão anterior' }
          }));
          ws.send(JSON.stringify({ type: 'RESET_ACK' }));
          ws.send(JSON.stringify({
            type: 'transcript.final',
            payload: { text: 'Transcrição da sessão atual' }
          }));
        }
      });
    });

    client = new WhisperClient(`ws://localhost:${testPort}`, 'interviewer');
    client.connect(utterance => receivedUtterances.push(utterance));

    await vi.waitFor(() => expect(client?.getIsConnected()).toBe(true));
    client.reset();

    await vi.waitFor(() => expect(receivedUtterances).toHaveLength(1));
    expect(receivedUtterances[0].text).toBe('Transcrição da sessão atual');
  });

  it('deve tentar reconectar automaticamente após desconexão não intencional', async () => {
    const { server, port: testPort } = await createTestServer();
    wss = server;

    let connectionCount = 0;
    wss.on('connection', (ws) => {
      connectionCount++;
      if (connectionCount === 1) {
        // Encerra forçadamente a primeira conexão
        ws.close();
      }
    });

    client = new WhisperClient(`ws://localhost:${testPort}`);
    client.connect(() => {});

    await vi.waitFor(() => {
      expect(connectionCount).toBe(1);
    });

    // Avança o timer de reconexão de 3000ms
    vi.advanceTimersByTime(3100);

    await vi.waitFor(() => {
      expect(connectionCount).toBeGreaterThanOrEqual(2);
      expect(client?.getIsConnected()).toBe(true);
    });
  });

  it('deve parar de reconectar ao chamar disconnect()', async () => {
    const { server, port: testPort } = await createTestServer();
    wss = server;

    let connectionCount = 0;
    wss.on('connection', () => {
      connectionCount++;
    });

    client = new WhisperClient(`ws://localhost:${testPort}`);
    client.connect(() => {});

    await vi.waitFor(() => {
      expect(connectionCount).toBe(1);
    });

    client.disconnect();
    expect(client.getIsConnected()).toBe(false);

    vi.advanceTimersByTime(5000);

    // Não deve ter ocorrido novas conexões
    expect(connectionCount).toBe(1);
  });
});
