// ============================================================
// Agente de Reescrita Rápida (Chrome Extension)
// ============================================================

import { AgentDefinition } from '@conversation-copilot/shared-types';

export const rewriteAgent: AgentDefinition = {
  id: 'rewrite',
  name: 'Agente de Reescrita Rápida',
  description: 'Reescreve sugestões ajustando tom e tamanho (Encurtar, Formal, Técnico, Expandir).',
  provider: 'chrome_ai',
  capabilities: ['rewrite', 'shorten', 'formalize', 'technicalize', 'expand'],
  systemPrompt: `
Você é um assistente de edição de texto para copiloto de conversas.
Reescreva a resposta fornecida mantendo o sentido original, adaptando conforme o comando solicitado (Encurtar, Deixar Formal, Adicionar detalhes Técnicos, ou Expandir).
Responda diretamente com o texto reescrito sem explicações adicionais.
`.trim()
};
