// ============================================================
// Gerenciador de Geração e Streaming de Sugestões (Chrome Extension)
// ============================================================

import { Settings, Suggestion } from '@conversation-copilot/shared-types';
import { ProviderManager } from '../providers/provider-manager.js';
import { ContextManager } from '../conversation/context-manager.js';
import { AgentRouter } from '../agents/agent-router.js';
import { CancellationManager } from './cancellation-manager.js';
import { GenerationEvent } from '../providers/provider.interface.js';

export interface GenerationManagerCallbacks {
  onStarted?: (suggestion: Suggestion) => void;
  onDelta?: (id: string, textDelta: string, fullText: string) => void;
  onCompleted?: (suggestion: Suggestion) => void;
  onFailed?: (id: string, error: string) => void;
  onCancelled?: (id: string, reason: string) => void;
}

export class GenerationManager {
  private providerManager: ProviderManager;
  private contextManager: ContextManager;
  private agentRouter: AgentRouter;
  private cancellationManager: CancellationManager;
  private callbacks: GenerationManagerCallbacks;

  constructor(
    providerManager: ProviderManager,
    contextManager: ContextManager,
    agentRouter: AgentRouter,
    callbacks: GenerationManagerCallbacks = {}
  ) {
    this.providerManager = providerManager;
    this.contextManager = contextManager;
    this.agentRouter = agentRouter;
    this.cancellationManager = new CancellationManager();
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: GenerationManagerCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public async generateAnswerForQuestion(
    questionText: string,
    actionHint?: 'rewrite' | 'shorten' | 'formal' | 'technical' | 'expand' | 'answer'
  ): Promise<void> {
    const id = `sug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Cancelar qualquer geração em andamento
    this.cancellationManager.cancelAll('Nova pergunta detectada');
    const signal = this.cancellationManager.createController(id);

    const agent = this.agentRouter.selectAgent({
      questionText,
      meetingMode: this.contextManager.getMeetingMode(),
      historyContext: this.contextManager.buildHistoryContext(),
      actionHint
    });

    const provider = this.providerManager.getActiveProvider();
    const systemPrompt = this.contextManager.buildSystemPrompt() + '\n\n' + agent.systemPrompt;
    const historyContext = this.contextManager.buildHistoryContext();

    const initialSuggestion: Suggestion = {
      id,
      question: questionText,
      structured: {},
      rawText: '',
      timestamp: Date.now(),
      status: 'streaming'
    };

    this.callbacks.onStarted?.(initialSuggestion);

    try {
      const events = provider.generate(
        {
          id,
          prompt: questionText,
          systemPrompt,
          historyContext,
          meetingMode: this.contextManager.getMeetingMode()
        },
        signal
      );

      for await (const event of events) {
        if (signal.aborted) {
          this.callbacks.onCancelled?.(id, 'Operação cancelada');
          return;
        }

        switch (event.kind) {
          case 'delta':
            if (event.textDelta && event.fullText) {
              this.callbacks.onDelta?.(id, event.textDelta, event.fullText);
            }
            break;
          case 'completed':
            initialSuggestion.status = 'complete';
            initialSuggestion.rawText = event.fullText || '';
            initialSuggestion.structured = {
              answer: event.fullText || '',
              opening: 'Resposta direta:',
              questionSummary: questionText
            };
            this.callbacks.onCompleted?.(initialSuggestion);
            break;
          case 'failed':
            initialSuggestion.status = 'error';
            this.callbacks.onFailed?.(id, event.error || 'Erro desconhecido ao gerar resposta');
            break;
          case 'cancelled':
            initialSuggestion.status = 'cancelled';
            initialSuggestion.reason = event.reason;
            this.callbacks.onCancelled?.(id, event.reason || 'Cancelado');
            break;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.callbacks.onFailed?.(id, message);
    }
  }

  public cancelCurrentGeneration(reason: string = 'Cancelado pelo usuário') {
    this.cancellationManager.cancelAll(reason);
  }
}
