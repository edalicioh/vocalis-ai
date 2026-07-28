import { describe, it, expect } from 'vitest';
import { QuestionDetector, DetectionContext } from '../question-detector.js';
import { Utterance } from '@conversation-copilot/shared-types';

describe('QuestionDetector', () => {
  it('deve identificar frases com pontuação interrogativa (?)', () => {
    const result = QuestionDetector.detect('Como funciona a arquitetura de microserviços?');
    expect(result.isQuestion).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.35);
    expect(result.reasons).toContain('pontuação interrogativa');
  });

  it('deve identificar frases com termos interrogativos em Português sem ponto', () => {
    const result = QuestionDetector.detect('como você resolveria um problema de memory leak em Nodejs');
    expect(result.isQuestion).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.35);
    expect(result.reasons).toContain('expressão interrogativa');
  });

  it('deve identificar pedidos de explicação ou narrativa', () => {
    const result = QuestionDetector.detect('me explique como funciona a arquitetura de microserviços?');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('pedido de narrativa');
  });

  it('deve identificar perguntas em Inglês', () => {
    const result = QuestionDetector.detect('Can you explain how React virtual DOM works under the hood?');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('question mark');
  });

  it('não deve classificar afirmações simples como perguntas', () => {
    const result = QuestionDetector.detect('Eu trabalhei três anos utilizando Node.js e Docker em ambiente AWS.');
    expect(result.isQuestion).toBe(false);
    expect(result.score).toBeLessThan(0.35);
  });

  it('deve retornar falso para textos muito curtos', () => {
    const result = QuestionDetector.detect('Sim');
    expect(result.isQuestion).toBe(false);
    expect(result.score).toBe(0);
  });

  it('deve reduzir a confiança de transcrições parciais (não finais)', () => {
    const finalResult = QuestionDetector.detect('Qual a diferença entre Threads e Processos?', 1000, true);
    const partialResult = QuestionDetector.detect('Qual a diferença entre Threads e Processos?', 1000, false);

    expect(partialResult.score).toBeLessThan(finalResult.score);
    expect(partialResult.reasons).toContain('transcrição parcial (confiança reduzida)');
  });

  // ============ Novos testes: padrões indiretos ============

  it('deve identificar consulta indireta (gostaria de saber)', () => {
    const result = QuestionDetector.detect('gostaria de saber como você lida com concurrency em Go');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('consulta indireta');
  });

  it('deve identificar expressão de curiosidade (tenho curiosidade)', () => {
    const result = QuestionDetector.detect('tenho curiosidade sobre como você arquitetou esse sistema');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('expressão de curiosidade');
  });

  it('deve identificar falta de entendimento (não entendi)', () => {
    const result = QuestionDetector.detect('não entendi direito como você implementou o cache distribuído');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('falta de entendimento');
  });

  it('deve identificar pedido de opinião (o que você acha)', () => {
    const result = QuestionDetector.detect('o que você acha sobre usar Kafka vs RabbitMQ para mensageria');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('pedido de opinião');
  });

  it('deve identificar pedido de narrativa suave (me conta sobre)', () => {
    const result = QuestionDetector.detect('me conta sobre sua experiência com arquitetura orientada a eventos');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('pedido de narrativa suave');
  });

  it('deve identificar pedido de aprofundamento', () => {
    const result = QuestionDetector.detect('pode detalhar melhor como você fez o deploy blue-green');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('pedido de aprofundamento');
  });

  it('deve identificar pergunta comportamental de entrevista', () => {
    const result = QuestionDetector.detect('conta uma situação onde você teve que escalar um sistema em produção');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('pergunta comportamental');
  });

  it('deve identificar pergunta indireta em Inglês (i\'m curious)', () => {
    const result = QuestionDetector.detect("i'm curious about how you handle database sharding");
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('indirect inquiry');
  });

  it('deve identificar pedido de opinião em Inglês (what do you think)', () => {
    const result = QuestionDetector.detect('what do you think about microservices vs monolith');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('opinion request');
  });

  it('deve identificar check de entendimento (ficou claro)', () => {
    const result = QuestionDetector.detect('ficou claro como o garbage collector funciona');
    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('check de entendimento');
  });

  // ============ Novos testes: detecção contextual ============

  it('deve aplicar bônus contextual para sequência de perguntas do entrevistador', () => {
    const context: DetectionContext = {
      recentUtterances: [
        { id: '1', speaker: 'interviewer', text: 'Olá, vamos começar.', timestamp: 1, isFinal: true },
        { id: '2', speaker: 'candidate', text: 'Olá.', timestamp: 2, isFinal: true },
        { id: '3', speaker: 'interviewer', text: 'Como você lida com transações distribuídas?', timestamp: 3, isFinal: true },
        { id: '4', speaker: 'candidate', text: 'Uso saga pattern.', timestamp: 4, isFinal: true },
        { id: '5', speaker: 'interviewer', text: 'queria entender melhor como você implementa o saga', timestamp: 5, isFinal: true }
      ]
    };

    const resultContext = QuestionDetector.detectWithContext(
      'queria entender melhor como você implementa o saga', 0, true, context
    );
    const resultSemContext = QuestionDetector.detectWithContext(
      'queria entender melhor como você implementa o saga', 0, true
    );

    expect(resultContext.score).toBeGreaterThan(resultSemContext.score);
    expect(resultContext.reasons).toContain('sequência de perguntas do entrevistador');
    expect(resultContext.reasons).toContain('follow-up após resposta do candidato');
  });

  it('deve aplicar bônus contextual para follow-up após resposta curta', () => {
    const context: DetectionContext = {
      recentUtterances: [
        { id: '1', speaker: 'interviewer', text: 'Como você testa seus serviços?', timestamp: 1, isFinal: true },
        { id: '2', speaker: 'candidate', text: 'Com Jest.', timestamp: 2, isFinal: true },
        { id: '3', speaker: 'interviewer', text: 'pode aprofundar sua estratégia de testes', timestamp: 3, isFinal: true }
      ]
    };

    const result = QuestionDetector.detectWithContext(
      'pode aprofundar sua estratégia de testes', 0, true, context
    );

    expect(result.isQuestion).toBe(true);
    expect(result.reasons).toContain('possível aprofundamento após resposta curta');
  });

  it('deve combinar texto com parciais acumuladas no contexto', () => {
    const context: DetectionContext = {
      recentUtterances: [],
      accumulatedPartials: 'eu estava pensando em'
    };

    const result = QuestionDetector.detectWithContext(
      'como você faria o deploy disso', 0, true, context
    );

    expect(result.questionText).toContain('eu estava pensando em');
    expect(result.questionText).toContain('como você faria o deploy disso');
    expect(result.isQuestion).toBe(true);
  });

  it('não deve aplicar bônus contextual quando não há padrão interrogativo', () => {
    const context: DetectionContext = {
      recentUtterances: [
        { id: '1', speaker: 'interviewer', text: 'Como você lida com cache?', timestamp: 1, isFinal: true },
        { id: '2', speaker: 'candidate', text: 'Uso Redis.', timestamp: 2, isFinal: true },
        { id: '3', speaker: 'interviewer', text: 'Certo, obrigado.', timestamp: 3, isFinal: true }
      ]
    };

    const result = QuestionDetector.detectWithContext(
      'Certo, obrigado.', 0, true, context
    );

    expect(result.isQuestion).toBe(false);
  });

  it('deve limitar o bônus contextual máximo a 0.15', () => {
    const context: DetectionContext = {
      recentUtterances: [
        { id: '1', speaker: 'interviewer', text: 'Como você lida com X?', timestamp: 1, isFinal: true },
        { id: '2', speaker: 'candidate', text: 'Sim.', timestamp: 2, isFinal: true },
        { id: '3', speaker: 'interviewer', text: 'Como você lida com Y?', timestamp: 3, isFinal: true },
        { id: '4', speaker: 'candidate', text: 'Ok.', timestamp: 4, isFinal: true },
        { id: '5', speaker: 'interviewer', text: 'o que você acha sobre Z', timestamp: 5, isFinal: true }
      ]
    };

    const resultComContexto = QuestionDetector.detectWithContext(
      'o que você acha sobre Z', 0, true, context
    );
    const resultSemContexto = QuestionDetector.detectWithContext(
      'o que você acha sobre Z', 0, true
    );

    const diferenca = resultComContexto.score - resultSemContexto.score;
    expect(diferenca).toBeLessThanOrEqual(0.16); // tolerância para ponto flutuante
  });
});
