import { describe, expect, it } from 'vitest';
import { ConversationTone, Utterance } from '@conversation-copilot/shared-types';
import { ToneAnalyzer } from '../tone-analyzer.js';

function criarFalas(textos: string[], speaker: Utterance['speaker'] = 'unknown'): Utterance[] {
  return textos.map((text, index) => ({
    id: String(index + 1),
    speaker,
    text,
    timestamp: index + 1,
    isFinal: true
  }));
}

describe('ToneAnalyzer', () => {
  const casosPorTom: Array<{ tone: ConversationTone; textos: string[] }> = [
    {
      tone: 'amigável',
      textos: ['Obrigado pela ajuda.', 'Excelente conversa, parabéns pelo trabalho.']
    },
    {
      tone: 'tenso',
      textos: ['Isso é inaceitável e preciso disso agora.', 'Já falei: não posso esperar mais.']
    },
    {
      tone: 'disperso',
      textos: ['Mudando de assunto, precisamos falar do orçamento.', 'A propósito, como estão as férias?']
    },
    {
      tone: 'interessado',
      textos: ['Que interessante, pode detalhar?', 'Gostei e quero entender melhor.']
    },
    {
      tone: 'confuso',
      textos: ['Não entendi essa explicação.', 'Pode explicar novamente? Estou perdido.']
    },
    {
      tone: 'formal',
      textos: ['Prezada senhora, por gentileza revise o documento.', 'Conforme mencionado, agradeço antecipadamente.']
    },
    {
      tone: 'neutro',
      textos: ['O serviço inicia na porta 3001.', 'A reunião começa às nove horas.']
    }
  ];

  it.each(casosPorTom)('deve identificar o tom $tone', ({ tone, textos }) => {
    const result = ToneAnalyzer.analyzeHeuristic(criarFalas(textos));

    expect(result.tone).toBe(tone);
    expect(result.summary).toMatch(/[A-Za-zÀ-ÿ]/);
  });

  it('deve permanecer neutro em conversa vazia ou insuficiente', () => {
    const vazio = ToneAnalyzer.analyzeHeuristic([]);
    const insuficiente = ToneAnalyzer.analyzeHeuristic(criarFalas([
      'Obrigado, excelente conversa e parabéns.'
    ]));

    expect(vazio.tone).toBe('neutro');
    expect(insuficiente.tone).toBe('neutro');
    expect(vazio.confidence).toBeLessThan(0.5);
    expect(insuficiente.confidence).toBeLessThan(0.5);
  });

  it('deve manter tom neutro quando as categorias têm evidências ambíguas', () => {
    const result = ToneAnalyzer.analyzeHeuristic(criarFalas([
      'Obrigado, senhor.',
      'Excelente atendimento, por gentileza.'
    ]));

    expect(result.tone).toBe('neutro');
    expect(result.summary).toContain('sinais recentes são mistos');
  });

  it('deve dar mais peso aos sinais recentes', () => {
    const result = ToneAnalyzer.analyzeHeuristic(criarFalas([
      'Obrigado pela conversa.',
      'Excelente trabalho.',
      'Vamos revisar o primeiro item.',
      'O serviço usa uma fila.',
      'A implantação será amanhã.',
      'O banco possui duas réplicas.',
      'Seguimos com a apresentação.',
      'O relatório está disponível.',
      'A próxima etapa é o teste.',
      'A equipe revisou o documento.',
      'Isso é inaceitável, preciso disso agora.',
      'Já falei que não posso esperar.'
    ]));

    expect(result.tone).toBe('tenso');
  });

  it('deve manter a confiança entre zero e um e aumentá-la com evidências consistentes', () => {
    const moderado = ToneAnalyzer.analyzeHeuristic(criarFalas([
      'Obrigado pela ajuda.',
      'Excelente conversa.'
    ]));
    const consistente = ToneAnalyzer.analyzeHeuristic(criarFalas([
      'Bom dia, obrigado pela ajuda.',
      'Excelente conversa.',
      'Parabéns pelo trabalho.',
      'Valeu, foi ótimo.',
      'Que bom, muito obrigado.'
    ]));

    expect(moderado.confidence).toBeGreaterThanOrEqual(0);
    expect(moderado.confidence).toBeLessThanOrEqual(1);
    expect(consistente.confidence).toBeGreaterThanOrEqual(0);
    expect(consistente.confidence).toBeLessThanOrEqual(1);
    expect(consistente.confidence).toBeGreaterThan(moderado.confidence);
  });

  it('não deve interpretar termos técnicos isolados como tensão', () => {
    const result = ToneAnalyzer.analyzeHeuristic(criarFalas([
      'Encontramos um bug no cache e um erro de validação.',
      'O crash ocorreu depois da falha no deploy!!',
      'O problema técnico foi registrado para análise.'
    ]));

    expect(result.tone).toBe('neutro');
  });

  it('não deve depender da atribuição de participante', () => {
    const textos = ['Não entendi essa explicação.', 'Pode explicar novamente? Estou perdido.'];
    const comoEntrevistador = ToneAnalyzer.analyzeHeuristic(criarFalas(textos, 'interviewer'));
    const comoCandidato = ToneAnalyzer.analyzeHeuristic(criarFalas(textos, 'candidate'));

    expect(comoEntrevistador).toEqual(comoCandidato);
    expect(comoEntrevistador.summary).not.toMatch(/entrevistador|candidato/i);
  });
});
