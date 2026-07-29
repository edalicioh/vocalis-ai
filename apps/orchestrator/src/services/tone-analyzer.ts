import { ConversationTone, Utterance } from '@conversation-copilot/shared-types';

/**
 * Resultado da análise de tom da conversa.
 */
export interface ToneAnalysisResult {
  tone: ConversationTone;
  confidence: number;
  summary: string;
}

interface ToneSignal {
  pattern: RegExp;
  weight: number;
}

interface ToneScore {
  tone: ConversationTone;
  score: number;
  evidence: number;
}

/**
 * Analisador heurístico local do tom emocional da conversa.
 */
export class ToneAnalyzer {
  private static readonly RECENT_WINDOW_SIZE = 12;
  private static readonly MIN_EVIDENCE = 2;
  private static readonly MIN_SCORE = 1.35;
  private static readonly MIN_MARGIN = 0.35;

  private static readonly TONE_SIGNALS: Record<ConversationTone, ToneSignal[]> = {
    amigável: [
      { pattern: /\b(obrigad[oa]|valeu|por favor|bom dia|boa tarde|boa noite)\b/i, weight: 1 },
      { pattern: /\b(ótim[oa]|excelente|maravilhos[oa]|que bom|parabéns)\b/i, weight: 1 },
      { pattern: /(?:\b(?:haha|hehe|kkk|rsrs)\b|[😊😄👍])/i, weight: 0.8 }
    ],
    tenso: [
      { pattern: /\b(com urgência|urgente|preciso (?:disso )?agora|não posso esperar|sem mais atrasos?)\b/i, weight: 1.2 },
      { pattern: /\b(inaceitável|não aceito|absurdo|estou irritad[oa]|isso é inadmissível)\b/i, weight: 1.3 },
      { pattern: /\b(mais uma vez|já falei|quantas vezes|pare de enrolar|você não está ouvindo)\b/i, weight: 1.1 },
      { pattern: /!{2,}/, weight: 0.35 }
    ],
    disperso: [
      { pattern: /\b(mudando de assunto|outra coisa|a propósito|falando em outra coisa)\b/i, weight: 1 },
      { pattern: /\b(voltando ao assunto|voltando ao que eu dizia|onde eu estava)\b/i, weight: 1 },
      { pattern: /\b(enfim,? deixa pra lá|mas isso é outro assunto|depois a gente volta nisso)\b/i, weight: 0.9 }
    ],
    interessado: [
      { pattern: /\b(interessante|curioso|adorei|gostei|incrível|surpreendente)\b/i, weight: 1 },
      { pattern: /\b(conta mais|me explica|pode detalhar|quero entender|quero saber|como assim)\b/i, weight: 1.1 },
      { pattern: /\?/, weight: 0.35 }
    ],
    confuso: [
      { pattern: /\b(não entendi|não ficou claro|não peguei|não estou entendendo)\b/i, weight: 1.2 },
      { pattern: /\b(estou perdido|tô perdido|não faço ideia|não tenho certeza)\b/i, weight: 1.1 },
      { pattern: /\b(pode explicar (?:de novo|novamente)|pode repetir|repita|repete)\b/i, weight: 1.1 }
    ],
    formal: [
      { pattern: /\b(por gentileza|prezad[oa]s?|senhor(?:a|es|as)?|doutor(?:a|es|as)?)\b/i, weight: 1 },
      { pattern: /\b(gostaria de solicitar|venho por meio deste|conforme mencionado|agradeço antecipadamente)\b/i, weight: 1 },
      { pattern: /\b(com licença|se não me engano|a meu ver)\b/i, weight: 0.8 }
    ],
    neutro: []
  };

  /**
   * Analisa localmente o tom das falas recentes por sinais léxicos ponderados.
   */
  public static analyzeHeuristic(utterances: Utterance[]): ToneAnalysisResult {
    const recentUtterances = utterances
      .filter(utterance => utterance.isFinal && utterance.text.trim().length > 0)
      .slice(-this.RECENT_WINDOW_SIZE);

    if (recentUtterances.length === 0) {
      return {
        tone: 'neutro',
        confidence: 0.2,
        summary: 'Conversa não iniciada ou sem conteúdo suficiente para análise.'
      };
    }

    if (recentUtterances.length < 2) {
      return {
        tone: 'neutro',
        confidence: 0.25,
        summary: 'Ainda não há falas recentes suficientes para identificar o tom.'
      };
    }

    const scores = (Object.entries(this.TONE_SIGNALS) as Array<[ConversationTone, ToneSignal[]]>)
      .filter(([tone]) => tone !== 'neutro')
      .map(([tone, signals]): ToneScore => {
        let score = 0;
        let evidence = 0;

        for (let index = 0; index < recentUtterances.length; index++) {
          const utterance = recentUtterances[index];
          const recency = index / (recentUtterances.length - 1);
          const recencyWeight = 0.55 + recency * 0.45;

          for (const signal of signals) {
            // search não mantém o lastIndex mutável de expressões globais entre falas.
            if (utterance.text.search(signal.pattern) >= 0) {
              score += signal.weight * recencyWeight;
              evidence++;
            }
          }
        }

        return { tone, score, evidence };
      })
      .sort((left, right) => right.score - left.score);

    const best = scores[0];
    const second = scores[1];
    const margin = best.score - second.score;

    if (best.evidence < this.MIN_EVIDENCE || best.score < this.MIN_SCORE) {
      return {
        tone: 'neutro',
        confidence: 0.35,
        summary: 'Não há evidências recentes suficientes para definir um tom predominante.'
      };
    }

    if (margin < this.MIN_MARGIN) {
      return {
        tone: 'neutro',
        confidence: this.roundConfidence(0.3 + Math.max(0, margin) * 0.2),
        summary: 'Os sinais recentes são mistos, sem um tom predominante claro.'
      };
    }

    const confidence = 0.45
      + Math.min(0.3, best.score * 0.08)
      + Math.min(0.2, margin * 0.1)
      + Math.min(0.05, Math.max(0, best.evidence - this.MIN_EVIDENCE) * 0.02);

    return {
      tone: best.tone,
      confidence: this.roundConfidence(confidence),
      summary: this.generateHeuristicSummary(best.tone)
    };
  }

  private static roundConfidence(confidence: number): number {
    const boundedConfidence = Math.min(1, Math.max(0, confidence));
    return Math.round(boundedConfidence * 100) / 100;
  }

  /**
   * Gera um resumo sem atribuir falas a participantes, pois a origem pode estar incorreta.
   */
  private static generateHeuristicSummary(tone: ConversationTone): string {
    const summaries: Record<ConversationTone, string> = {
      neutro: 'A conversa recente mantém um tom neutro e equilibrado.',
      amigável: 'A conversa recente apresenta cordialidade e descontração.',
      tenso: 'A conversa recente apresenta sinais de pressão ou confronto.',
      disperso: 'A conversa recente apresenta mudanças frequentes de assunto.',
      interessado: 'A conversa recente apresenta curiosidade e interesse em aprofundar o tema.',
      confuso: 'A conversa recente apresenta dúvidas ou pedidos de esclarecimento.',
      formal: 'A conversa recente apresenta linguagem formal e respeitosa.'
    };

    return summaries[tone];
  }
}
