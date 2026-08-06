// ============================================================
// Roteador de Agentes (Chrome Extension)
// ============================================================

import { AgentDefinition } from '@conversation-copilot/shared-types';
import { AgentContext } from './agent.types.js';
import { technicalInterviewAgent } from './interview-agent.js';
import { rewriteAgent } from './rewrite-agent.js';
import { summaryAgent } from './summary-agent.js';

export class AgentRouter {
  private agents: Map<string, AgentDefinition> = new Map();

  constructor() {
    this.registerAgent(technicalInterviewAgent);
    this.registerAgent(rewriteAgent);
    this.registerAgent(summaryAgent);
  }

  public registerAgent(agent: AgentDefinition) {
    this.agents.set(agent.id, agent);
  }

  public selectAgent(context: AgentContext): AgentDefinition {
    if (context.actionHint === 'rewrite') {
      return this.agents.get('rewrite') || technicalInterviewAgent;
    }

    if (context.actionHint === 'shorten' || context.actionHint === 'formal' || context.actionHint === 'technical' || context.actionHint === 'expand') {
      return this.agents.get('rewrite') || technicalInterviewAgent;
    }

    // Padrão do MVP: Agente de Entrevistas Técnicas
    return this.agents.get('technical-interview') || technicalInterviewAgent;
  }

  public getAgent(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }
}
