import { describe, expect, it } from 'vitest';
import type { Utterance } from '@conversation-copilot/shared-types';
import type {
  AnswerEvent,
  AnswerInput,
  AnswerProvider
} from '../answer-provider.js';
import { ExternalConversationAnalyzer } from '../external-conversation-analyzer.js';

type GenerateHandler = (input: AnswerInput) => AsyncIterable<AnswerEvent>;

class MockProvider implements AnswerProvider {
  public readonly inputs: AnswerInput[] = [];

  constructor(
    private readonly handler: GenerateHandler,
    private readonly configured = true
  ) {}

  public generate(input: AnswerInput): AsyncIterable<AnswerEvent> {
    this.inputs.push(input);
    return this.handler(input);
  }

  public async cancel(): Promise<void> {}

  public isConfigured(): boolean {
    return this.configured;
  }
}

function streamChunks(...chunks: string[]): GenerateHandler {
  return async function* (input) {
    for (const chunk of chunks) {
      yield {
        type: 'answer.delta',
        data: { id: input.requestId, chunk }
      };
    }
  };
}

function buildUtterances(total: number): Utterance[] {
  return Array.from({ length: total }, (_, index) => ({
    id: `fala-${index + 1}`,
    speaker: index % 2 === 0 ? 'interviewer' : 'candidate',
    text: `Conteúdo exclusivo da fala ${index + 1}`,
    timestamp: index + 1,
    isFinal: true
  }));
}

const baseContext = {
  accumulatedSummary: 'A conversa aborda experiência com sistemas distribuídos.',
  recentUtterances: buildUtterances(6),
  meetingMode: 'technical_interview' as const
};

describe('ExternalConversationAnalyzer', () => {
  it('valida pergunta e refina tom consumindo apenas deltas internamente', async () => {
    const responses = [
      [
        '```json\n{"isQuestion":true,"confidence":1.4,',
        '"questionText":"  Como você lidou com o incidente?  ","reason":"  É um pedido indireto.  "}\n```'
      ],
      ['{"tone":"interessado","confidence":0.82,"summary":"  Há perguntas de aprofundamento.  "}']
    ];
    const provider = new MockProvider(async function* (input) {
      const chunks = responses.shift() ?? [];
      for (const chunk of chunks) {
        yield { type: 'answer.delta', data: { id: input.requestId, chunk } };
      }
    });
    const analyzer = new ExternalConversationAnalyzer(provider);

    const question = await analyzer.validateAmbiguousQuestion({
      ...baseContext,
      candidateText: 'Queria entender melhor como você lidou com o incidente'
    });
    const tone = await analyzer.refineTone(baseContext);

    expect(question).toEqual({
      isQuestion: true,
      confidence: 1,
      questionText: 'Como você lidou com o incidente?',
      reason: 'É um pedido indireto.'
    });
    expect(tone).toEqual({
      tone: 'interessado',
      confidence: 0.82,
      summary: 'Há perguntas de aprofundamento.'
    });
    expect(provider.inputs).toHaveLength(2);
    expect(provider.inputs[0].requestId).toMatch(/^analise-externa-pergunta-/);
    expect(provider.inputs[1].requestId).toMatch(/^analise-externa-tom-/);
    expect(provider.inputs[0].requestId).not.toBe(provider.inputs[1].requestId);
    expect(provider.inputs.every(input => input.signal instanceof AbortSignal)).toBe(true);
    expect(provider.inputs.every(input => input.userProfile === undefined)).toBe(true);
    expect(provider.inputs.every(input => input.jobDescription === undefined)).toBe(true);
  });

  it('retorna null para JSON inválido ou categoria de tom desconhecida', async () => {
    const invalidJsonProvider = new MockProvider(streamChunks('{"isQuestion": true'));
    const invalidToneProvider = new MockProvider(streamChunks(
      '{"tone":"agressivo","confidence":0.9,"summary":"Tom hostil."}'
    ));

    const invalidQuestion = await new ExternalConversationAnalyzer(invalidJsonProvider)
      .validateAmbiguousQuestion({ ...baseContext, candidateText: 'Pode detalhar' });
    const invalidTone = await new ExternalConversationAnalyzer(invalidToneProvider)
      .refineTone(baseContext);

    expect(invalidQuestion).toBeNull();
    expect(invalidTone).toBeNull();
  });

  it('retorna null quando o provedor lança erro', async () => {
    const provider = new MockProvider(async function* () {
      throw new Error('Falha externa');
    });
    const analyzer = new ExternalConversationAnalyzer(provider);

    await expect(analyzer.refineTone(baseContext)).resolves.toBeNull();
  });

  it('aborta e retorna null ao atingir o timeout configurado', async () => {
    let receivedSignal: AbortSignal | undefined;
    const provider = new MockProvider(async function* (input) {
      receivedSignal = input.signal;
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 1_000);
        input.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    });
    const analyzer = new ExternalConversationAnalyzer(provider, { timeoutMs: 10 });

    const result = await analyzer.refineTone(baseContext);

    expect(result).toBeNull();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('retorna null sem iniciar geração quando o provedor não está configurado', async () => {
    const provider = new MockProvider(streamChunks('{}'), false);
    const analyzer = new ExternalConversationAnalyzer(provider);

    const result = await analyzer.refineTone(baseContext);

    expect(result).toBeNull();
    expect(provider.inputs).toHaveLength(0);
  });

  it('respeita o cancelamento solicitado pela sessão', async () => {
    let receivedSignal: AbortSignal | undefined;
    const provider = new MockProvider(async function* (input) {
      receivedSignal = input.signal;
      await new Promise<void>(resolve => {
        input.signal?.addEventListener('abort', () => resolve(), { once: true });
      });
    });
    const analyzer = new ExternalConversationAnalyzer(provider, { timeoutMs: 1_000 });
    const controller = new AbortController();

    const analysis = analyzer.validateAmbiguousQuestion({
      ...baseContext,
      candidateText: 'Tenho curiosidade sobre a arquitetura'
    }, controller.signal);
    controller.abort();

    await expect(analysis).resolves.toBeNull();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('limita o contexto às dez falas mais recentes e não envia histórico completo', async () => {
    const provider = new MockProvider(streamChunks(
      '{"isQuestion":false,"confidence":-0.2,"questionText":"","reason":"É uma afirmação."}'
    ));
    const analyzer = new ExternalConversationAnalyzer(provider, { utteranceWindowSize: 99 });

    const result = await analyzer.validateAmbiguousQuestion({
      accumulatedSummary: 'Resumo acumulado seguro.',
      recentUtterances: buildUtterances(12),
      meetingMode: 'general',
      candidateText: 'A arquitetura utiliza filas'
    });

    expect(result?.confidence).toBe(0);
    expect(provider.inputs).toHaveLength(1);
    expect(provider.inputs[0].prompt).not.toContain('Conteúdo exclusivo da fala 1"');
    expect(provider.inputs[0].prompt).not.toContain('Conteúdo exclusivo da fala 2"');
    for (let index = 3; index <= 12; index++) {
      expect(provider.inputs[0].prompt).toContain(`Conteúdo exclusivo da fala ${index}`);
    }
    expect(provider.inputs[0].prompt).not.toContain('fala-12');
    expect(provider.inputs[0].prompt).not.toContain('timestamp');
    expect(provider.inputs[0].prompt).not.toContain('speaker');
  });
});
