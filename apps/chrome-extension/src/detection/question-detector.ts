// ============================================================
// Detector de Perguntas (Chrome Extension)
// ============================================================

import { QuestionDetectionResult, Utterance } from '@conversation-copilot/shared-types';

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

export class QuestionDetector {
  static readonly PAUSE_SHORT_MS = 400;
  static readonly PAUSE_PROBABLE_MS = 700;
  static readonly PAUSE_CONFIRMED_MS = 1000;
  static readonly PAUSE_MAX_CONFIRMED_MS = 1300;

  static readonly LOCAL_DETECTION_THRESHOLD = 0.65;
  static readonly EXTERNAL_VALIDATION_MIN_SCORE = 0.25;
  static readonly EXTERNAL_VALIDATION_MAX_SCORE = QuestionDetector.LOCAL_DETECTION_THRESHOLD;

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
          pattern: /^(?:what|how|why|where|when|who|which)(?:'s|\s+is|\s+are|\s+do|\s+did|\s+does)?\b/i,
          weight: 0.68,
          label: 'pergunta direta'
        },
        {
          pattern: /^(?:can|could|would|do|did|does|are|is|was|were|have|has|should|will)\s+\w+/i,
          weight: 0.65,
          label: 'pergunta direta'
        }
      ]
    }
  ];

  public static detect(
    text: string,
    pauseDurationMs: number = 0,
    isFinal: boolean = true
  ): QuestionDetectionResult {
    return this.detectWithContext(text, pauseDurationMs, isFinal);
  }

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

  private static combinePartialText(accumulatedPartials: string | undefined, text: string): string {
    const partial = accumulatedPartials?.trim() ?? '';
    const current = text.trim();
    if (!partial) return current;
    if (!current) return partial;
    if (current.toLowerCase().startsWith(partial.toLowerCase())) return current;
    return `${partial} ${current}`;
  }

  private static evaluateContextualSignals(recentUtterances: Utterance[]): { bonus: number; reasons: string[] } {
    if (!recentUtterances || recentUtterances.length === 0) {
      return { bonus: 0, reasons: [] };
    }

    const lastUtterance = recentUtterances[recentUtterances.length - 1];
    if (lastUtterance.speaker === 'interviewer') {
      return { bonus: 0.1, reasons: ['fala vinda do interlocutor/entrevistador'] };
    }

    return { bonus: 0, reasons: [] };
  }
}
