import { TtsMode, StructuredAnswer } from '@conversation-copilot/shared-types';

/**
 * Interface abstrata para provedores de TTS (RNF-006).
 * Permite futura troca por Piper ou serviço externo.
 */
export interface SpeechProvider {
  speak(text: string, options?: SpeakOptions): Promise<void>;
  cancel(): void;
  pause(): void;
  resume(): void;
  isSpeaking(): boolean;
}

export interface SpeakOptions {
  rate?: number;
  volume?: number;
  lang?: string;
  onBoundary?: (charIndex: number, charLength: number) => void;
  onEnd?: () => void;
}

/**
 * Gerenciador de TTS com múltiplos modos (RF-013).
 * 
 * Funcionalidades:
 * - 5 modos de TTS (RF-013)
 * - Velocidade e volume ajustáveis
 * - Pausar e repetir (RF-013)
 * - Destaque visual sincronizado (RF-014)
 * - Cancelamento automático por regras de negócio (RN-008)
 * - Interface SpeechProvider substituível (RNF-006)
 */
export class SpeechManager implements SpeechProvider {
  private isMuted: boolean = false;
  private rate: number = 1.25;   // Padrão: 1.25x
  private volume: number = 0.4;  // Padrão: 40%
  private mode: TtsMode = 'manual';
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private lastSpokenText: string = '';
  private isPaused: boolean = false;

  // Callbacks para destaque sincronizado (RF-014)
  private onSentenceStart?: (sentenceIndex: number) => void;
  private onSpeechEnd?: () => void;

  // ========= Controles básicos =========

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.cancel();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  public getRate(): number {
    return this.rate;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMode(mode: TtsMode) {
    this.mode = mode;
    if (mode === 'off') {
      this.cancel();
    }
  }

  public getMode(): TtsMode {
    return this.mode;
  }

  // ========= Callbacks para destaque visual (RF-014) =========

  public setOnSentenceStart(callback: (sentenceIndex: number) => void) {
    this.onSentenceStart = callback;
  }

  public setOnSpeechEnd(callback: () => void) {
    this.onSpeechEnd = callback;
  }

  // ========= Fala principal =========

  /**
   * Fala o texto fornecido.
   * Se já estiver falando, cancela a fala anterior (RN-008).
   */
  public async speak(text: string, options?: SpeakOptions): Promise<void> {
    if (this.isMuted || this.mode === 'off' || !('speechSynthesis' in window)) return;

    this.cancel(); // Cancela falas anteriores
    this.lastSpokenText = text;
    this.isPaused = false;

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options?.lang || 'pt-BR';
      utterance.rate = options?.rate ?? this.rate;
      utterance.volume = options?.volume ?? this.volume;

      // Seleciona voz em Português
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.includes('pt') || v.lang.includes('PT'));
      if (ptVoice) {
        utterance.voice = ptVoice;
      }

      // Destaque sincronizado (RF-014)
      if (options?.onBoundary) {
        utterance.onboundary = (event) => {
          options.onBoundary!(event.charIndex, event.charLength);
        };
      }

      utterance.onend = () => {
        this.currentUtterance = null;
        this.isPaused = false;
        this.onSpeechEnd?.();
        options?.onEnd?.();
        resolve();
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
        resolve();
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Fala a resposta estruturada da IA, frase por frase.
   * Emite callbacks para destaque sincronizado (RF-014).
   */
  public async speakStructured(answer: StructuredAnswer): Promise<void> {
    if (this.isMuted || this.mode === 'off') return;

    let textToSpeak = '';

    switch (this.mode) {
      case 'full':
        textToSpeak = [answer.opening, answer.answer].filter(Boolean).join('. ');
        break;
      case 'summary':
        textToSpeak = answer.audioHint || answer.opening || '';
        break;
      case 'keywords':
        textToSpeak = (answer.keyPoints || []).join(', ');
        break;
      case 'manual':
        // No modo manual, não inicia automaticamente
        return;
      default:
        textToSpeak = answer.audioHint || answer.opening || '';
    }

    if (!textToSpeak.trim()) return;

    // Divide em frases para leitura por frase (RF-013)
    const sentences = this.splitIntoSentences(textToSpeak);

    for (let i = 0; i < sentences.length; i++) {
      if (this.isMuted) break;

      this.onSentenceStart?.(i);
      await this.speak(sentences[i]);
    }
  }

  // ========= Controles de playback =========

  public cancel() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
    this.isPaused = false;
  }

  public pause() {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.isPaused = true;
    }
  }

  public resume() {
    if ('speechSynthesis' in window && this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
    }
  }

  /**
   * Repete o último texto falado (RF-013).
   */
  public repeat() {
    if (this.lastSpokenText) {
      this.speak(this.lastSpokenText);
    }
  }

  public isSpeaking(): boolean {
    return 'speechSynthesis' in window && window.speechSynthesis.speaking;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public stop() {
    this.cancel();
  }

  // ========= Helpers =========

  /**
   * Divide texto em frases, respeitando o limite de ~5 segundos por trecho.
   */
  private splitIntoSentences(text: string): string[] {
    // Divide por pontuação final
    const raw = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);

    // Reagrupa frases muito curtas
    const sentences: string[] = [];
    let current = '';

    for (const frag of raw) {
      if (current.length + frag.length > 120) {
        if (current) sentences.push(current.trim());
        current = frag;
      } else {
        current += (current ? ' ' : '') + frag;
      }
    }
    if (current) sentences.push(current.trim());

    return sentences;
  }
}
