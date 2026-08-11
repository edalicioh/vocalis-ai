import type { AnswerInput } from './answer-provider.js';

/**
 * Monta a mensagem de sistema usada pelos provedores OpenAI-compatible.
 * Adapta a persona conforme a finalidade da geração.
 */
export function buildSystemMessage(purpose: AnswerInput['purpose'] = 'answer'): string {
  if (purpose === 'summary' || purpose === 'analysis') {
    return 'Você é um secretário e analista de reuniões profissionais. Acompanhe a conversa, organize pontos-chave, decisões tomadas e tarefas (action items) retornando exatamente o formato JSON solicitado, em Português do Brasil. Não invente informações ausentes.';
  }
  return 'Você é um assistente técnico em entrevistas de emprego. Responda em Português do Brasil.';
}
