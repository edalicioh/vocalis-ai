import { AnswerProvider, AnswerInput, AnswerEvent } from './answer-provider.js';
import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { Settings, AIProvider } from '@conversation-copilot/shared-types';

export class AnswerProviderManager implements AnswerProvider {
  private activeProviderType: AIProvider = 'gemini';
  public geminiProvider: GeminiProvider;
  public openAIProvider: OpenAIProvider;
  public anthropicProvider: AnthropicProvider;
  public ollamaProvider: OllamaProvider;

  constructor() {
    this.geminiProvider = new GeminiProvider();
    this.openAIProvider = new OpenAIProvider();
    this.anthropicProvider = new AnthropicProvider();
    this.ollamaProvider = new OllamaProvider();
  }

  public updateSettings(settings: Partial<Settings>) {
    if (settings.aiProvider) {
      this.activeProviderType = settings.aiProvider;
    }
    if (settings.geminiApiKey) {
      this.geminiProvider.setApiKey(settings.geminiApiKey);
    }
    if (settings.openaiApiKey) {
      this.openAIProvider.setApiKey(settings.openaiApiKey);
    }
    if (settings.anthropicApiKey) {
      this.anthropicProvider.setApiKey(settings.anthropicApiKey);
    }
    if (settings.ollamaEndpoint) {
      this.ollamaProvider.setEndpoint(settings.ollamaEndpoint);
    }
    if (settings.ollamaModel) {
      this.ollamaProvider.setModel(settings.ollamaModel);
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
}
