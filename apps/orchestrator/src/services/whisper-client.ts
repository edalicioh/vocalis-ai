import WebSocket from 'ws';
import { Utterance } from '@conversation-copilot/shared-types';

/**
 * Interface para o callback de transcrição.
 * Permite distinguir entre transcrição parcial e final.
 */
export interface TranscriptionCallback {
  (utterance: Utterance): void;
}

/**
 * Cliente WebSocket que conecta o Orquestrador ao serviço Whisper (services/whisper/).
 * 
 * Responsável por:
 * - Manter conexão com reconexão automática (RNF-003)
 * - Encaminhar blocos de áudio
 * - Receber e padronizar eventos de transcrição (transcript.partial / transcript.final)
 */
export class WhisperClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private onTranscriptionCallback: TranscriptionCallback | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect: boolean = true;

  constructor(private url: string = process.env.WHISPER_WS_URL || 'ws://localhost:8000/ws/transcribe') {}

  public connect(onTranscription: TranscriptionCallback) {
    this.onTranscriptionCallback = onTranscription;
    this.shouldReconnect = true;
    this.doConnect();
  }

  private doConnect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.isConnected = true;
        console.log('[WhisperClient] Conectado ao serviço de transcrição (services/whisper/).');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());

          // Padroniza eventos do Whisper para dot.notation
          const type = this.normalizeEventType(message.type);

          if ((type === 'transcript.partial' || type === 'transcript.final') && message.payload?.text) {
            const utterance: Utterance = {
              id: Math.random().toString(36).substring(2, 9),
              speaker: 'interviewer',
              text: message.payload.text,
              timestamp: Date.now(),
              isFinal: type === 'transcript.final',
              confidence: message.payload.probability ?? message.payload.confidence,
              language: message.payload.language,
              start: message.payload.start,
              end: message.payload.end
            };

            if (this.onTranscriptionCallback) {
              this.onTranscriptionCallback(utterance);
            }
          }
        } catch (e) {
          // ignora se não for JSON (pode ser frame binário)
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        console.log('[WhisperClient] Conexão com serviço de transcrição encerrada.');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.warn('[WhisperClient] Erro no WebSocket:', err.message);
      });
    } catch (e) {
      console.error('[WhisperClient] Falha ao conectar ao serviço de transcrição:', e);
      this.scheduleReconnect();
    }
  }

  /**
   * Normaliza nomes de eventos legados para dot.notation.
   * Aceita tanto o formato antigo (TRANSCRIPTION_DELTA) quanto o novo (transcript.final).
   */
  private normalizeEventType(type: string): string {
    const mapping: Record<string, string> = {
      'TRANSCRIPTION_DELTA': 'transcript.final',
      'TRANSCRIPTION_PARTIAL': 'transcript.partial',
      'TRANSCRIPTION_FINAL': 'transcript.final'
    };
    return mapping[type] || type;
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('[WhisperClient] Tentando reconectar ao serviço de transcrição...');
      this.doConnect();
    }, 3000);
  }

  public sendAudioChunk(chunk: Buffer) {
    if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Desconecta do serviço Whisper sem reconectar.
   * Usado no encerramento de sessão (RF-002).
   */
  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
