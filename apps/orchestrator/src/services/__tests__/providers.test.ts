import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../openai.js';
import { AnthropicProvider } from '../anthropic.js';
import { OllamaProvider } from '../ollama.js';

describe('Novos Provedores de IA', () => {
  describe('OpenAIProvider', () => {
    it('retorna falso para isConfigured quando a chave da API está vazia', () => {
      const provider = new OpenAIProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it('retorna verdadeiro para isConfigured após definir a chave da API', () => {
      const provider = new OpenAIProvider();
      provider.setApiKey('sk-123456');
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('AnthropicProvider', () => {
    it('retorna falso para isConfigured quando a chave da API está vazia', () => {
      const provider = new AnthropicProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it('retorna verdadeiro para isConfigured após definir a chave da API', () => {
      const provider = new AnthropicProvider();
      provider.setApiKey('sk-ant-123456');
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('OllamaProvider', () => {
    it('inicia configurado com endpoint local padrão', () => {
      const provider = new OllamaProvider();
      expect(provider.isConfigured()).toBe(true);
    });

    it('permite atualizar endpoint e modelo', () => {
      const provider = new OllamaProvider();
      provider.setEndpoint('http://localhost:11434');
      provider.setModel('mistral');
      expect(provider.isConfigured()).toBe(true);
    });
  });
});
