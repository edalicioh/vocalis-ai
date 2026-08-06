// ============================================================
// Interface Unificada de Provedor LLM (Chrome Extension)
// ============================================================

import { ResponseMode, UserProfile, JobDescription, MeetingMode } from '@conversation-copilot/shared-types';

export interface GenerationRequest {
  id: string;
  prompt: string;
  systemPrompt?: string;
  responseMode?: ResponseMode;
  meetingMode?: MeetingMode;
  userProfile?: UserProfile;
  jobDescription?: JobDescription;
  historyContext?: string;
}

export type GenerationEventKind = 'started' | 'delta' | 'completed' | 'failed' | 'cancelled';

export interface GenerationEvent {
  id: string;
  kind: GenerationEventKind;
  textDelta?: string;
  fullText?: string;
  error?: string;
  reason?: string;
}

export interface LlmProvider {
  /** Identificador único do provedor (gemini, openai, anthropic, ollama, chrome_ai, custom_proxy) */
  readonly providerId: string;

  /** Verifica se o provedor está devidamente configurado e disponível */
  isAvailable(): Promise<boolean>;

  /**
   * Gera resposta em modo streaming assíncrono.
   * @param request Dados da requisição e contexto
   * @param signal Sinal de cancelamento (AbortSignal)
   */
  generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncIterable<GenerationEvent>;
}
