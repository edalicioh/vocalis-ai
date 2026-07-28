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

  it('alterna para o Proxy Agnóstico / API Customizada ao atualizar configurações', () => {
    const manager = new AnswerProviderManager();
    manager.updateSettings({
      aiProvider: 'custom_proxy',
      customProxyEndpoint: 'https://api.deepseek.com/v1/chat/completions',
      customProxyApiKey: 'sk-deepseek-test-key',
      customProxyModel: 'deepseek-chat'
    });

    expect(manager.getActiveProviderType()).toBe('custom_proxy');
    expect(manager.getActiveProvider()).toBe(manager.customProxyProvider);
    expect(manager.customProxyProvider.getEndpoint()).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(manager.customProxyProvider.getModel()).toBe('deepseek-chat');
    expect(manager.isConfigured()).toBe(true);
  });

  it('deve atualizar o nome do modelo para todos os provedores parametrizáveis', () => {
    const manager = new AnswerProviderManager();
    manager.updateSettings({
      geminiModel: 'gemini-1.5-pro',
      openaiModel: 'gpt-4o',
      anthropicModel: 'claude-3-5-haiku-20241022',
      ollamaModel: 'codestral',
      customProxyModel: 'llama-3.3-70b-versatile'
    });

    expect(manager.geminiProvider.getModel()).toBe('gemini-1.5-pro');
    expect(manager.openAIProvider.getModel()).toBe('gpt-4o');
    expect(manager.anthropicProvider.getModel()).toBe('claude-3-5-haiku-20241022');
    expect(manager.ollamaProvider.getModel()).toBe('codestral');
    expect(manager.customProxyProvider.getModel()).toBe('llama-3.3-70b-versatile');
  });
});
