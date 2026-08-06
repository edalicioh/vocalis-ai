// ============================================================
// Tipos de Agente (Chrome Extension)
// ============================================================

import { AgentDefinition, MeetingMode } from '@conversation-copilot/shared-types';

export interface AgentContext {
  questionText: string;
  meetingMode: MeetingMode;
  historyContext: string;
  userProfileSummary?: string;
  actionHint?: 'rewrite' | 'shorten' | 'formal' | 'technical' | 'expand' | 'answer';
}

export type { AgentDefinition };
