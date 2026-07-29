import { QuestionDetectionResult, Utterance } from '@conversation-copilot/shared-types';

/** Contexto opcional para detecção contextual de perguntas. */
export interface DetectionContext {
  /** Últimas falas da conversa (mais recentes por último). */
  recentUtterances: Utterance[];
  /** Texto acumulado de transcrições parciais anteriores. */
  accumulatedPartials?: string;
}

interface QuestionSignal {
  pattern: RegExp;
  weight: number;
  label: string;
}

interface SignalGroup {
  maxContribution: number;
  signals: QuestionSignal[];
}

/**
 * Detector local de perguntas em Português e Inglês.
 *
 * Sinais explícitos são resolvidos localmente. Sinais ambíguos ficam em uma
 * faixa intermediária, disponível para validação externa pelo servidor.
 */
export class QuestionDetector {
  // Limiares legados de pausa, mantidos para o fluxo progressivo.
  static readonly PAUSE_SHORT_MS = 400;
  static readonly PAUSE_PROBABLE_MS = 700;
  static readonly PAUSE_CONFIRMED_MS = 1000;
  static readonly PAUSE_MAX_CONFIRMED_MS = 1300;

  /** Confiança mínima para aceitar uma pergunta somente com sinais locais. */
  static readonly LOCAL_DETECTION_THRESHOLD = 0.65;
  /** Início da faixa em que o servidor pode solicitar validação externa. */
  static readonly EXTERNAL_VALIDATION_MIN_SCORE = 0.25;
  /** Fim exclusivo da faixa de validação externa. */
  static readonly EXTERNAL_VALIDATION_MAX_SCORE = QuestionDetector.LOCAL_DETECTION_THRESHOLD;

  /**
   * Cada grupo contribui no máximo uma vez. No grupo semântico, somente o
   * sinal mais forte é considerado, evitando soma e razões por regex sobrepostas.
   */
  private static readonly SIGNAL_GROUPS: SignalGroup[] = [
    {
      maxContribution: 0.65,
      signals: [
        { pattern: /\?/, weight: 0.65, label: 'pontuação interrogativa' }
      ]
    },
    {
      maxContribution: 0.72,
      signals: [
        // Solicitações inequívocas em Português.
        {
          pattern: /\b(?:pode|poderia|consegue|saberia)\s+(?:me\s+)?(?:explicar|descrever|falar|mostrar|contar|detalhar|dar um exemplo)\b/i,
          weight: 0.7,
          label: 'pedido de explicação'
        },
        {
          pattern: /\b(?:me\s+(?:explique|conte|conta|diga|fale|mostre)|explique|descreva|detalhe|exemplifique|conte(?:-me)?|conta)\b/i,
          weight: 0.7,
          label: 'pedido de narrativa'
        },
        {
          pattern: /\b(?:conte|conta|fale)\s+(?:sobre\s+)?(?:uma situação|um momento)|\b(?:já enfrentou|já passou por)\b/i,
          weight: 0.72,
          label: 'pergunta comportamental'
        },
        {
          pattern: /\b(?:qual (?:é )?sua opinião|qual (?:é )?sua visão|o que você acha|o que pensa sobre|como você enxerga|na sua visão)\b/i,
          weight: 0.72,
          label: 'pedido de opinião'
        },
        {
          pattern: /\b(?:não entendi|nao entendi|não compreendi|nao compreendi|não ficou claro|nao ficou claro|pode repetir|me ajude a entender|pode aprofundar|pode detalhar melhor|me dê mais detalhes|me de mais detalhes)\b/i,
          weight: 0.72,
          label: 'pedido de esclarecimento'
        },
        {
          pattern: /\b(?:gostaria|queria)\s+(?:de\s+)?(?:saber|entender|conhecer|ouvir)\b/i,
          weight: 0.68,
          label: 'consulta indireta'
        },
        {
          pattern: /^(?:(?:e|então|entao|bom|bem)\s*,?\s+)?(?:você|voce|vocês|voces)\s+(?:já\s+)?(?:trabalhou|trabalharam|conhece|conhecem|usou|usaram|utilizou|utilizaram|implementou|implementaram|lidou|lidaram)\s+(?:com\s+)?/i,
          weight: 0.68,
          label: 'pergunta de experiência'
        },
        {
          pattern: /\b(?:faz sentido|está claro|esta claro|entendeu|ficou claro|tem alguma dúvida|tem alguma duvida)\b/i,
          weight: 0.68,
          label: 'confirmação de entendimento'
        },

        // Solicitações inequívocas em Inglês.
        {
          pattern: /\b(?:can|could|would) you (?:explain|describe|show|tell|clarify|elaborate|walk me through|talk me through)|\b(?:tell me|explain|describe|clarify|walk me through|talk me through|share an example)\b/i,
          weight: 0.7,
          label: 'pedido de explicação'
        },
        {
          pattern: /\b(?:tell me about a time|have you ever|what(?:'s| is) your take|what do you think|your opinion on|your thoughts on|how do you see)\b/i,
          weight: 0.72,
          label: 'pedido de experiência ou opinião'
        },
        {
          pattern: /\b(?:i didn't catch that|can you repeat|go deeper into|could you clarify)\b/i,
          weight: 0.72,
          label: 'pedido de esclarecimento'
        },
        {
          pattern: /\b(?:i'd like to know|i want to understand|would love to hear)\b/i,
          weight: 0.68,
          label: 'consulta indireta'
        },

        // Estruturas diretas ficam ancoradas no início para não pontuar conectivos narrativos.
        {
          pattern: /^(?:(?:e|então|entao|bom|bem)\s*,?\s+)?(?:o que|qual|quais|por que|por quê|onde|quando|quem|quanto|quanta|quantos|quantas)(?=\s|[?,.]|$)/i,
          weight: 0.65,
          label: 'pergunta direta'
        },
        {
          pattern: /^(?:(?:e|então|entao|bom|bem)\s*,?\s+)?como\s+(?:você|voce|vocês|voces|funciona|funcionam|foi|seria|faria|resolveria|lidaria|abordaria|implementaria|podemos|posso|devo|faz|fez|lidou|implementou|resolver)(?=\s|[?,.]|$)/i,
          weight: 0.65,
          label: 'pergunta direta'
        },
        {
          pattern: /^(?:what|how|why|where|when|who|which)\b/i,
          weight: 0.65,
          label: 'pergunta direta'
        },
        {
          pattern: /^(?:can|could|would|do|did|does|are|is|have|has)\s+(?:you|we|it|there)\b/i,
          weight: 0.65,
          label: 'pergunta direta'
        },

        // Curiosidade sem pedido claro requer validação externa.
        {
          pattern: /\b(?:tenho curiosidade|fiquei curioso|me pergunto|penso sobre|gostaria de ouvir)\b/i,
          weight: 0.35,
          label: 'sinal ambíguo de curiosidade'
        },
        {
          pattern: /\b(?:i'm curious|i was wondering)\b/i,
          weight: 0.35,
          label: 'sinal ambíguo de curiosidade'
        }
      ]
    }
  ];

  /** Avalia uma transcrição sem alterar a assinatura pública legada. */
  public static detect(
    text: string,
    pauseDurationMs: number = 0,
    isFinal: boolean = true
  ): QuestionDetectionResult {
    return this.detectWithContext(text, pauseDurationMs, isFinal);
  }

  /** Avalia uma transcrição e, opcionalmente, seu contexto conversacional. */
  public static detectWithContext(
    text: string,
    _pauseDurationMs: number = 0,
    isFinal: boolean = true,
    context?: DetectionContext
  ): QuestionDetectionResult {
    const fullText = this.combinePartialText(context?.accumulatedPartials, text);

    if (fullText.length < 5) {
      return { isQuestion: false, score: 0, reasons: [], questionText: fullText };
    }

    let score = 0;
    const reasons: string[] = [];

    for (const group of this.SIGNAL_GROUPS) {
      const strongestSignal = group.signals
        .filter(signal => signal.pattern.test(fullText))
        .sort((a, b) => b.weight - a.weight)[0];

      if (strongestSignal) {
        score += Math.min(strongestSignal.weight, group.maxContribution);
        reasons.push(strongestSignal.label);
      }
    }

    if (context && score >= this.EXTERNAL_VALIDATION_MIN_SCORE) {
      const contextual = this.evaluateContextualSignals(context.recentUtterances);
      score += contextual.bonus;
      reasons.push(...contextual.reasons);
    }

    if (!isFinal) {
      score *= 0.6;
      reasons.push('transcrição parcial (confiança reduzida)');
    }

    score = Math.min(1, Math.max(0, score));
    const roundedScore = Math.round(score * 100) / 100;

    return {
      isQuestion: roundedScore >= this.LOCAL_DETECTION_THRESHOLD,
      score: roundedScore,
      reasons: [...new Set(reasons)],
      questionText: fullText
    };
  }

  /** Indica se uma pontuação deve seguir para validação externa. */
  public static shouldValidateExternally(score: number): boolean {
    return score >= this.EXTERNAL_VALIDATION_MIN_SCORE
      && score < this.EXTERNAL_VALIDATION_MAX_SCORE;
  }

  private static combinePartialText(accumulatedPartials: string | undefined, text: string): string {
    const partial = accumulatedPartials?.trim() ?? '';
    const current = text.trim();

    if (!partial) return current;
    if (!current) return partial;

    const partialLower = partial.toLocaleLowerCase('pt-BR');
    const currentLower = current.toLocaleLowerCase('pt-BR');
    if (partialLower.includes(currentLower)) return partial;
    if (currentLower.includes(partialLower)) return current;

    const partialWords = partial.split(/\s+/);
    const currentWords = current.split(/\s+/);
    const maxOverlap = Math.min(partialWords.length, currentWords.length);

    for (let size = maxOverlap; size >= 2; size -= 1) {
      const partialEnd = partialWords.slice(-size).join(' ').toLocaleLowerCase('pt-BR');
      const currentStart = currentWords.slice(0, size).join(' ').toLocaleLowerCase('pt-BR');
      if (partialEnd === currentStart) {
        return [...partialWords, ...currentWords.slice(size)].join(' ');
      }
    }

    return `${partial} ${current}`;
  }

  /** Aplica bônus somente quando há alternância entre papéis conhecidos. */
  private static evaluateContextualSignals(
    recentUtterances: Utterance[]
  ): { bonus: number; reasons: string[] } {
    const recent = recentUtterances.slice(-5);
    if (recent.length < 2) return { bonus: 0, reasons: [] };

    const previous = recent[recent.length - 2];
    const current = recent[recent.length - 1];
    const isKnownTransition = previous.speaker === 'candidate'
      && current.speaker === 'interviewer';

    if (!isKnownTransition) return { bonus: 0, reasons: [] };

    let bonus = 0.05;
    const reasons = ['follow-up após resposta do candidato'];

    if (previous.text.trim().length < 50) {
      bonus += 0.03;
      reasons.push('aprofundamento após resposta curta');
    }

    const hasEarlierKnownExchange = recent
      .slice(0, -2)
      .some(utterance => utterance.speaker === 'interviewer');
    if (hasEarlierKnownExchange) {
      bonus += 0.02;
      reasons.push('sequência conhecida de entrevista');
    }

    return { bonus: Math.min(bonus, 0.1), reasons };
  }

  /** Método simplificado de compatibilidade. */
  public static isQuestion(text: string): boolean {
    return this.detect(text).isQuestion;
  }

  /** Mantém o controle progressivo legado sem influenciar a detecção textual. */
  public static isPrefetchReady(pauseDurationMs: number, score: number): boolean {
    return pauseDurationMs >= this.PAUSE_PROBABLE_MS && score >= 0.5;
  }

  /** Mantém a confirmação progressiva legada para consumidores que possuem pausa confiável. */
  public static isConfirmed(pauseDurationMs: number, score: number): boolean {
    if (score >= 0.7 && pauseDurationMs >= this.PAUSE_PROBABLE_MS) {
      return true;
    }
    return pauseDurationMs >= this.PAUSE_CONFIRMED_MS && score >= 0.35;
  }
}
