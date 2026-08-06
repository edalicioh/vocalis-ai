// ============================================================
// Gerenciador de Provedores de IA (Chrome Extension)
// ============================================================

import { Settings, AIProvider } from '@conversation-copilot/shared-types';
import { LlmProvider } from './provider.interface.js';
import { GeminiProvider } from './gemini.provider.js';
import { OpenAiProvider } from './openai.provider.js';
import { OllamaProvider } from './ollama.provider.js';
import { ChromeAiProvider } from './chrome-ai.provider.js';

export class ProviderManager {
  private providers: Map<string, LlmProvider> = new Map();
  private activeProviderId: string = 'gemini';

  constructor(settings?: Settings) {
    const gemini = new GeminiProvider(settings?.geminiApiKey, settings?.geminiModel);
    const openai = new OpenAiProvider('openai', settings?.openaiApiKey, undefined, settings?.openaiModel);
    const anthropic = new OpenAiProvider('anthropic', settings?.anthropicApiKey, 'https://api.anthropic.com/v1/messages', settings?.anthropicModel);
    const ollama = new OllamaProvider(settings?.ollamaEndpoint, settings?.ollamaModel);
    const customProxy = new OpenAiProvider('custom_proxy', settings?.customProxyApiKey, settings?.customProxyEndpoint, settings?.customProxyModel);
    const chromeAi = new ChromeAiProvider();

    this.providers.set('gemini', gemini);
    this.providers.set('openai', openai);
    this.providers.set('anthropic', anthropic);
    this.providers.set('ollama', ollama);
    this.providers.set('custom_proxy', customProxy);
    this.providers.set('chrome_ai', chromeAi);

    if (settings?.aiProvider) {
      this.activeProviderId = settings.aiProvider;
    }
  }

  public updateSettings(settings: Settings) {
    if (settings.aiProvider) {
      this.activeProviderId = settings.aiProvider;
    }

    const gemini = this.providers.get('gemini') as GeminiProvider;
    if (gemini) gemini.updateConfig(settings.geminiApiKey, settings.geminiModel);

    const openai = this.providers.get('openai') as OpenAiProvider;
    if (openai) openai.updateConfig(settings.openaiApiKey || '', undefined, settings.openaiModel);

    const customProxy = this.providers.get('custom_proxy') as OpenAiProvider;
    if (customProxy) customProxy.updateConfig(settings.customProxyApiKey || '', settings.customProxyEndpoint, settings.customProxyModel);

    const ollama = this.providers.get('ollama') as OllamaProvider;
    if (ollama) ollama.updateConfig(settings.ollamaEndpoint, settings.ollamaModel);
  }

  public getActiveProvider(): LlmProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) {
      return this.providers.get('gemini')!;
    }
    return provider;
  }

  public getProvider(id: AIProvider | string): LlmProvider | undefined {
    return this.providers.get(id);
  }
}
