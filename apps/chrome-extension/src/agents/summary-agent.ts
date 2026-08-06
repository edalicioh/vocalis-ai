// ============================================================
// Agente de Sumarização (Chrome Extension)
// ============================================================

import { AgentDefinition } from '@conversation-copilot/shared-types';

export const summaryAgent: AgentDefinition = {
  id: 'summary',
  name: 'Agente de Sumarização',
  description: 'Sintetiza os pontos principais e tópicos discutidos na reunião.',
  capabilities: ['summarize', 'action_items', 'topics'],
  systemPrompt: `
Você é um assistente de síntese de reuniões.
Analise a conversa e gere um resumo conciso contendo:
- Tópicos Principais Discutidos
- Decisões Tomadas
- Action Items (Próximos Passos)
Use formatação limpa em tópicos com marcadores.
`.trim()
};
