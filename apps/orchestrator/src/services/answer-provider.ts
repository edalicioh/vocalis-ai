import {
  StructuredAnswer,
  ResponseMode,
  AnswerStartedPayload,
  AnswerDeltaPayload,
  AnswerSectionCompletedPayload,
  AnswerCompletedPayload,
  AnswerCancelledPayload,
  AnswerFailedPayload
} from '@conversation-copilot/shared-types';

// ============================================================
// Interface Abstrata — AnswerProvider (RNF-006)
// ============================================================

/**
 * Tipos de evento emitidos durante a geração de resposta.
 * Segue o ciclo de vida definido no RF-010.
 */
export type AnswerEvent =
  | { type: 'answer.started'; data: AnswerStartedPayload }
  | { type: 'answer.delta'; data: AnswerDeltaPayload }
  | { type: 'answer.section.completed'; data: AnswerSectionCompletedPayload }
  | { type: 'answer.completed'; data: AnswerCompletedPayload }
  | { type: 'answer.cancelled'; data: AnswerCancelledPayload }
  | { type: 'answer.failed'; data: AnswerFailedPayload };

/**
 * Input para geração de resposta.
 */
export interface AnswerInput {
  /** ID único da requisição */
  requestId: string;
  /** Pergunta detectada */
  question: string;
  /** Prompt montado com contexto completo */
  prompt: string;
  /** Modo de resposta selecionado */
  responseMode: ResponseMode;
}

/**
 * Interface abstrata para provedores de IA.
 * 
 * Permite trocar Gemini por OpenAI, Anthropic ou outro
 * provedor sem alterar o orquestrador (RNF-006).
 * 
 * Implementações:
 * - GeminiProvider (padrão)
 * - Futuro: OpenAIProvider, AnthropicProvider, etc.
 */
export interface AnswerProvider {
  /**
   * Gera resposta em streaming, emitindo eventos conforme o progresso.
   * 
   * O gerador deve emitir:
   * 1. answer.started
   * 2. answer.delta (N vezes)
   * 3. answer.completed | answer.cancelled | answer.failed
   */
  generate(input: AnswerInput): AsyncIterable<AnswerEvent>;

  /**
   * Cancela uma geração em andamento.
   * Deve emitir answer.cancelled se a geração ainda estiver ativa.
   */
  cancel(requestId: string): Promise<void>;

  /**
   * Verifica se o provedor está configurado (ex: API key presente).
   */
  isConfigured(): boolean;
}
