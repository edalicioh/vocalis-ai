import { describe, it, expect, beforeEach } from 'vitest';
import { QuestionDetector } from '../detection/question-detector.js';
import { ContextManager } from '../conversation/context-manager.js';
import { ProviderManager } from '../providers/provider-manager.js';
import { AgentRouter } from '../agents/agent-router.js';
import { GeminiProvider } from '../providers/gemini.provider.js';
import { OllamaProvider } from '../providers/ollama.provider.js';

describe('Orquestração Client-Side (Chrome Extension)', () => {
  describe('QuestionDetector', () => {
    it('deve detectar perguntas técnicas clássicas em português', () => {
      const result = QuestionDetector.detect('Como você lidaria com concorrência no banco de dados?', 0, true);
      expect(result.isQuestion).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.65);
    });

    it('deve ignorar afirmações normais', () => {
      const result = QuestionDetector.detect('Eu desenvolvi essa funcionalidade ontem no projeto.', 0, true);
      expect(result.isQuestion).toBe(false);
    });

    it('deve identificar pedidos de explicação em inglês', () => {
      const result = QuestionDetector.detect('Can you explain how garbage collection works in Java?', 0, true);
      expect(result.isQuestion).toBe(true);
    });
  });

  describe('ContextManager', () => {
    let contextManager: ContextManager;

    beforeEach(() => {
      contextManager = new ContextManager();
    });

    it('deve inicializar com o modo de reunião padrão e permitir troca', () => {
      expect(contextManager.getMeetingMode()).toBe('technical_interview');
      contextManager.setMeetingMode('system_design');
      expect(contextManager.getMeetingMode()).toBe('system_design');
    });

    it('deve construir o prompt do sistema com o perfil do candidato', () => {
      contextManager.setUserProfile({
        name: 'Edalicio',
        role: 'Engenheiro Principal',
        skills: ['TypeScript', 'Node.js', 'React', 'Docker']
      });

      const prompt = contextManager.buildSystemPrompt();
      expect(prompt).toContain('Engenheiro Principal');
      expect(prompt).toContain('TypeScript, Node.js, React, Docker');
    });

    it('deve manter histórico deslizante de falas', () => {
      contextManager.addUtterance({
        id: '1',
        speaker: 'interviewer',
        text: 'Qual o seu banco de dados favorito?',
        timestamp: Date.now(),
        isFinal: true
      });

      const history = contextManager.buildHistoryContext();
      expect(history).toContain('Entrevistador: Qual o seu banco de dados favorito?');
    });
  });

  describe('ProviderManager', () => {
    it('deve selecionar o provedor Gemini por padrão e permitir alteração', () => {
      const manager = new ProviderManager();
      expect(manager.getActiveProvider().providerId).toBe('gemini');
    });

    it('deve atualizar provedores com base em configurações', () => {
      const manager = new ProviderManager();
      manager.updateSettings({
        aiProvider: 'ollama',
        geminiApiKey: 'test-key',
        responseMode: 'short',
        ttsMode: 'off',
        ttsSpeed: 1.25,
        ttsVolume: 0.4,
        ttsAutoPlay: false,
        autoTrigger: true,
        panelMode: 'normal',
        userProfile: { role: '', seniority: '', skills: [], experiences: [], projects: [], strengths: [], weaknesses: [], preferredStyle: 'short', summary: '' },
        jobDescription: { title: '', description: '', requirements: [], niceToHave: [], company: '', technologies: [], notes: '' }
      });

      expect(manager.getActiveProvider().providerId).toBe('ollama');
    });
  });

  describe('AgentRouter', () => {
    it('deve selecionar o agente de entrevistas por padrão', () => {
      const router = new AgentRouter();
      const agent = router.selectAgent({
        questionText: 'Explique REST',
        meetingMode: 'technical_interview',
        historyContext: ''
      });
      expect(agent.id).toBe('technical-interview');
    });

    it('deve selecionar o agente de reescrita quando um hint de ação for fornecido', () => {
      const router = new AgentRouter();
      const agent = router.selectAgent({
        questionText: 'Texto original',
        meetingMode: 'technical_interview',
        historyContext: '',
        actionHint: 'shorten'
      });
      expect(agent.id).toBe('rewrite');
    });
  });
});
