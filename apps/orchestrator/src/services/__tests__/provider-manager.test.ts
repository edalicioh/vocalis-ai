import { describe, it, expect } from 'vitest';
import { AnswerProviderManager } from '../provider-manager.js';

describe('AnswerProviderManager', () => {
  it('inicia por padrão com Gemini como provedor ativo', () => {
    const manager = new AnswerProviderManager();
    expect(manager.getActiveProviderType()).toBe('gemini');
    expect(manager.getActiveProvider()).toBe(manager.geminiProvider);
  });

  it('alterna para OpenAI ao atualizar configurações', () => {
    const manager = new AnswerProviderManager();
    manager.updateSettings({ aiProvider: 'openai', openaiApiKey: 'sk-test' });

    expect(manager.getActiveProviderType()).toBe('openai');
    expect(manager.getActiveProvider()).toBe(manager.openAIProvider);
    expect(manager.isConfigured()).toBe(true);
  });

  it('alterna para Anthropic ao atualizar configurações', () => {
    const manager = new AnswerProviderManager();
    manager.updateSettings({ aiProvider: 'anthropic', anthropicApiKey: 'sk-ant-test' });

    expect(manager.getActiveProviderType()).toBe('anthropic');
    expect(manager.getActiveProvider()).toBe(manager.anthropicProvider);
    expect(manager.isConfigured()).toBe(true);
  });

  it('alterna para Ollama e configura endpoint local', () => {
    const manager = new AnswerProviderManager();
    manager.updateSettings({
      aiProvider: 'ollama',
      ollamaEndpoint: 'http://localhost:11434',
      ollamaModel: 'llama3'
    });

    expect(manager.getActiveProviderType()).toBe('ollama');
    expect(manager.getActiveProvider()).toBe(manager.ollamaProvider);
    expect(manager.isConfigured()).toBe(true);
  });
});
