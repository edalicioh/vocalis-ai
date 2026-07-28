import { AnswerProvider, AnswerInput, AnswerEvent } from './answer-provider.js';
import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { CustomProxyProvider } from './custom-proxy.js';
import { Settings, AIProvider } from '@conversation-copilot/shared-types';

export class AnswerProviderManager implements AnswerProvider {
  private activeProviderType: AIProvider = 'gemini';
  public geminiProvider: GeminiProvider;
  public openAIProvider: OpenAIProvider;
  public anthropicProvider: AnthropicProvider;
  public ollamaProvider: OllamaProvider;
  public customProxyProvider: CustomProxyProvider;

  constructor() {
    this.geminiProvider = new GeminiProvider();
    this.openAIProvider = new OpenAIProvider();
    this.anthropicProvider = new AnthropicProvider();
    this.ollamaProvider = new OllamaProvider();
    this.customProxyProvider = new CustomProxyProvider();
  }

  public updateSettings(settings: Partial<Settings>) {
    if (settings.aiProvider) {
      this.activeProviderType = settings.aiProvider;
    }
    if (settings.geminiApiKey) {
      this.geminiProvider.setApiKey(settings.geminiApiKey);
    }
    if (settings.geminiModel) {
      this.geminiProvider.setModel(settings.geminiModel);
    }
    if (settings.openaiApiKey) {
      this.openAIProvider.setApiKey(settings.openaiApiKey);
    }
    if (settings.openaiModel) {
      this.openAIProvider.setModel(settings.openaiModel);
    }
    if (settings.anthropicApiKey) {
      this.anthropicProvider.setApiKey(settings.anthropicApiKey);
    }
    if (settings.anthropicModel) {
      this.anthropicProvider.setModel(settings.anthropicModel);
    }
    if (settings.ollamaEndpoint) {
      this.ollamaProvider.setEndpoint(settings.ollamaEndpoint);
    }
    if (settings.ollamaModel) {
      this.ollamaProvider.setModel(settings.ollamaModel);
    }
    if (settings.customProxyEndpoint) {
      this.customProxyProvider.setEndpoint(settings.customProxyEndpoint);
    }
    if (settings.customProxyApiKey) {
      this.customProxyProvider.setApiKey(settings.customProxyApiKey);
    }
    if (settings.customProxyModel) {
      this.customProxyProvider.setModel(settings.customProxyModel);
    }
  }

  public getActiveProviderType(): AIProvider {
    return this.activeProviderType;
  }

  public getActiveProvider(): AnswerProvider {
    switch (this.activeProviderType) {
      case 'openai':
        return this.openAIProvider;
      case 'anthropic':
        return this.anthropicProvider;
      case 'ollama':
        return this.ollamaProvider;
      case 'custom_proxy':
        return this.customProxyProvider;
      case 'gemini':
      default:
        return this.geminiProvider;
    }
  }

  public isConfigured(): boolean {
    return this.getActiveProvider().isConfigured();
  }

  public generate(input: AnswerInput): AsyncIterable<AnswerEvent> {
    return this.getActiveProvider().generate(input);
  }

  public async cancel(requestId: string): Promise<void> {
    return this.getActiveProvider().cancel(requestId);
  }

  public async fetchAvailableModels(providerType?: AIProvider, apiKey?: string, endpoint?: string): Promise<string[]> {
    const type = providerType || this.activeProviderType;
    let provider: AnswerProvider;

    switch (type) {
      case 'openai':
        provider = this.openAIProvider;
        break;
      case 'anthropic':
        provider = this.anthropicProvider;
        break;
      case 'ollama':
        provider = this.ollamaProvider;
        break;
      case 'custom_proxy':
        provider = this.customProxyProvider;
        break;
      case 'gemini':
      default:
        provider = this.geminiProvider;
        break;
    }

    if (provider.listModels) {
      return provider.listModels(apiKey, endpoint);
    }
    return [];
  }
}
