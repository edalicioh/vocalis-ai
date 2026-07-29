import { describe, expect, it } from 'vitest';
import { Utterance } from '@conversation-copilot/shared-types';
import { DetectionContext, QuestionDetector } from '../question-detector.js';

describe('QuestionDetector', () => {
  it('aceita localmente pergunta explícita com pontuação interrogativa', () => {
    const result = QuestionDetector.detect('A arquitetura usa filas?');

    expect(result.isQuestion).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(QuestionDetector.LOCAL_DETECTION_THRESHOLD);
    expect(result.reasons).toContain('pontuação interrogativa');
  });

  it('aceita localmente pergunta direta em Português sem interrogação', () => {
    const result = QuestionDetector.detect('como você resolveria um vazamento de memória em Node.js');

    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('pergunta direta');
  });

  it('aceita perguntas de tempo e experiência sem pontuação', () => {
    const quando = QuestionDetector.detect('quando você começou a trabalhar com TypeScript');
    const experiencia = QuestionDetector.detect('Você já trabalhou com Kubernetes');
    const conhecimento = QuestionDetector.detect('Você conhece AWS');

    expect(quando.isQuestion).toBe(true);
    expect(experiencia.isQuestion).toBe(true);
    expect(conhecimento.isQuestion).toBe(true);
    expect(experiencia.reasons).toContain('pergunta de experiência');
  });

  it('não confunde referências declarativas à experiência com perguntas', () => {
    const curriculo = QuestionDetector.detect('O currículo mostra que você conhece AWS');
    const mencao = QuestionDetector.detect('Foi mencionado que você já trabalhou com Kubernetes');

    expect(curriculo.isQuestion).toBe(false);
    expect(mencao.isQuestion).toBe(false);
  });

  it.each([
    ['me explique como funciona a arquitetura de microserviços', 'pedido de narrativa'],
    ['pode detalhar melhor a estratégia de implantação', 'pedido de esclarecimento'],
    ['o que você acha sobre Kafka e RabbitMQ', 'pedido de opinião'],
    ['conta uma situação onde você precisou escalar um sistema', 'pergunta comportamental'],
    ['não entendi a decisão de usar consistência eventual', 'pedido de esclarecimento']
  ])('atribui alta confiança à solicitação inequívoca: %s', (text, reason) => {
    const result = QuestionDetector.detect(text);

    expect(result.isQuestion).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(QuestionDetector.LOCAL_DETECTION_THRESHOLD);
    expect(result.reasons).toContain(reason);
  });

  it.each([
    ['Can you explain how the React virtual DOM works?', 'pedido de explicação'],
    ['what do you think about microservices', 'pedido de experiência ou opinião'],
    ['tell me about a time you handled an outage', 'pedido de experiência ou opinião'],
    ['how would you design this queue', 'pergunta direta']
  ])('preserva a detecção de perguntas e pedidos em Inglês: %s', (text, reason) => {
    const result = QuestionDetector.detect(text);

    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain(reason);
  });

  it('mantém curiosidade ambígua na faixa de validação externa', () => {
    const result = QuestionDetector.detect('tenho curiosidade sobre a estratégia de cache do projeto');

    expect(result.isQuestion).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(QuestionDetector.EXTERNAL_VALIDATION_MIN_SCORE);
    expect(result.score).toBeLessThan(QuestionDetector.LOCAL_DETECTION_THRESHOLD);
    expect(QuestionDetector.shouldValidateExternally(result.score)).toBe(true);
  });

  it('mantém curiosidade ambígua em Inglês na faixa de validação externa', () => {
    const result = QuestionDetector.detect("I'm curious about the database strategy");

    expect(result.isQuestion).toBe(false);
    expect(QuestionDetector.shouldValidateExternally(result.score)).toBe(true);
  });

  it('expõe limites inclusivo e exclusivo da validação externa', () => {
    expect(QuestionDetector.shouldValidateExternally(0.24)).toBe(false);
    expect(QuestionDetector.shouldValidateExternally(0.25)).toBe(true);
    expect(QuestionDetector.shouldValidateExternally(0.64)).toBe(true);
    expect(QuestionDetector.shouldValidateExternally(0.65)).toBe(false);
  });

  it.each([
    'trabalhei como desenvolvedor por cinco anos',
    'expliquei porque usamos Redis nesse serviço',
    'eu sei como resolver esse tipo de problema',
    'documentei onde armazenamos as credenciais',
    'a equipe decidiu quando faria a migração'
  ])('não classifica afirmação com conectivo interrogativo: %s', text => {
    const result = QuestionDetector.detect(text);

    expect(result.isQuestion).toBe(false);
    expect(result.score).toBeLessThan(QuestionDetector.EXTERNAL_VALIDATION_MIN_SCORE);
  });

  it('não duplica pontuação nem razões por padrões em Português e Inglês', () => {
    const result = QuestionDetector.detect('Can you explain how this service works?');

    expect(result.score).toBe(1);
    expect(result.reasons).toEqual(['pontuação interrogativa', 'pedido de explicação']);
    expect(new Set(result.reasons).size).toBe(result.reasons.length);
  });

  it('ignora a duração da pausa na pontuação e nas razões', () => {
    const withoutPause = QuestionDetector.detectWithContext('tenho curiosidade sobre o cache', 0);
    const withPause = QuestionDetector.detectWithContext('tenho curiosidade sobre o cache', 5000);

    expect(withPause).toEqual(withoutPause);
    expect(withPause.reasons).not.toContain('pausa longa confirmada');
  });

  it('reduz a confiança de uma transcrição parcial', () => {
    const finalResult = QuestionDetector.detect('Qual a diferença entre processos e threads?', 0, true);
    const partialResult = QuestionDetector.detect('Qual a diferença entre processos e threads?', 0, false);

    expect(partialResult.score).toBeLessThan(finalResult.score);
    expect(partialResult.reasons).toContain('transcrição parcial (confiança reduzida)');
  });

  it('combina parciais sem repetir o trecho sobreposto', () => {
    const context: DetectionContext = {
      recentUtterances: [],
      accumulatedPartials: 'como você faria'
    };

    const result = QuestionDetector.detectWithContext(
      'você faria o deploy desse serviço',
      0,
      true,
      context
    );

    expect(result.questionText).toBe('como você faria o deploy desse serviço');
    expect(result.isQuestion).toBe(true);
  });

  it('não repete uma parcial já contida no texto final', () => {
    const context: DetectionContext = {
      recentUtterances: [],
      accumulatedPartials: 'pode explicar o cache'
    };

    const result = QuestionDetector.detectWithContext(
      'pode explicar o cache distribuído',
      0,
      true,
      context
    );

    expect(result.questionText).toBe('pode explicar o cache distribuído');
  });

  it('aplica bônus contextual quando há alternância real de papéis conhecidos', () => {
    const utterances: Utterance[] = [
      { id: '1', speaker: 'interviewer', text: 'Vamos falar de cache.', timestamp: 1, isFinal: true },
      { id: '2', speaker: 'candidate', text: 'Uso Redis.', timestamp: 2, isFinal: true },
      { id: '3', speaker: 'interviewer', text: 'Tenho curiosidade sobre invalidação.', timestamp: 3, isFinal: true }
    ];
    const context: DetectionContext = { recentUtterances: utterances };

    const withContext = QuestionDetector.detectWithContext(
      'tenho curiosidade sobre invalidação', 0, true, context
    );
    const withoutContext = QuestionDetector.detect('tenho curiosidade sobre invalidação');

    expect(withContext.score).toBeGreaterThan(withoutContext.score);
    expect(withContext.reasons).toContain('follow-up após resposta do candidato');
  });

  it('não confia no contexto quando o papel é desconhecido', () => {
    const context: DetectionContext = {
      recentUtterances: [
        { id: '1', speaker: 'candidate', text: 'Uso Redis.', timestamp: 1, isFinal: true },
        { id: '2', speaker: 'unknown', text: 'Tenho curiosidade sobre invalidação.', timestamp: 2, isFinal: true }
      ]
    };

    const withUnknownContext = QuestionDetector.detectWithContext(
      'tenho curiosidade sobre invalidação', 0, true, context
    );
    const withoutContext = QuestionDetector.detect('tenho curiosidade sobre invalidação');

    expect(withUnknownContext.score).toBe(withoutContext.score);
    expect(withUnknownContext.reasons).toEqual(withoutContext.reasons);
  });

  it('preserva os métodos progressivos legados para consumidores com pausa confiável', () => {
    expect(QuestionDetector.isPrefetchReady(700, 0.5)).toBe(true);
    expect(QuestionDetector.isConfirmed(700, 0.7)).toBe(true);
    expect(QuestionDetector.isConfirmed(300, 0.9)).toBe(false);
  });

  it('retorna resultado vazio para textos muito curtos', () => {
    expect(QuestionDetector.detect('Sim')).toEqual({
      isQuestion: false,
      score: 0,
      reasons: [],
      questionText: 'Sim'
    });
  });
});
