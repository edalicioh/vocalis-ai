// ============================================================
// Cliente WebSocket do Whisper Service (Chrome Extension)
// ============================================================

export interface WhisperClientOptions {
  url?: string;
  onPartial?: (text: string, language?: string) => void;
  onFinal?: (text: string, language?: string, confidence?: number, start?: number, end?: number) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (connected: boolean) => void;
}

export class WhisperClient {
  private url: string;
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private options: WhisperClientOptions;

  constructor(options: WhisperClientOptions = {}) {
    this.url = options.url || 'ws://localhost:8000/ws/transcribe';
    this.options = options;
  }

  public setUrl(url: string) {
    this.url = url;
    if (this.socket) {
      this.disconnect();
      this.connect();
    }
  }

  public connect(): void {
    if (this.socket || this.isConnected) return;

    try {
      this.socket = new WebSocket(this.url);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        this.isConnected = true;
        this.options.onStatusChange?.(true);
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            if (data.type === 'transcript.final' || data.text) {
              this.options.onFinal?.(
                data.text,
                data.language,
                data.confidence,
                data.start,
                data.end
              );
            } else if (data.type === 'transcript.partial') {
              this.options.onPartial?.(data.text, data.language);
            }
          }
        } catch {
          // Ignorar mensagens sem formatação JSON
        }
      };

      this.socket.onerror = (event: Event) => {
        const err = new Error('Erro na conexão WebSocket do Whisper');
        this.options.onError?.(err);
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.socket = null;
        this.options.onStatusChange?.(false);
        this.scheduleReconnect();
      };
    } catch (err: unknown) {
      this.isConnected = false;
      this.options.onStatusChange?.(false);
      this.scheduleReconnect();
    }
  }

  public sendAudioChunk(buffer: ArrayBuffer | Int16Array): void {
    if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(buffer);
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.options.onStatusChange?.(false);
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
}
