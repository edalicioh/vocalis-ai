import { describe, it, expect } from 'vitest';
import { ContextManager } from '../context-manager.js';
import { GeminiProvider } from '../gemini.js';
import { MeetingSummaryService } from '../meeting-summary.js';
import { AnswerProvider, AnswerEvent } from '../answer-provider.js';

class FakeSummaryProvider implements AnswerProvider {
  public isConfigured(): boolean {
    return true;
  }

  public async *generate(): AsyncIterable<AnswerEvent> {
    yield { type: 'answer.started', data: { id: 'fake', question: 'resumo', responseMode: 'short' } };
    yield {
      type: 'answer.delta',
      data: {
        id: 'fake',
        chunk: '{"topics":["Backend","Kafka"],"previousQuestions":[],"technologies":["Kafka","Redis"],"decisions":["Usar Kafka para mensageria"],"actionItems":["Criar PR da fila","Validar DLQ"],"summaryText":"Alinhamento sobre a arquitetura de mensageria."}'
      }
    };
    yield {
      type: 'answer.completed',
      data: {
        id: 'fake',
        structured: {
          questionSummary: '',
          opening: '',
          answer: '',
          keyPoints: []
        }
      }
    };
  }

  public async cancel(): Promise<void> {}
}

describe('MeetingSummaryService', () => {
  it('gera ata fallback quando não há falas registradas', async () => {
    const cm = new ContextManager();
    const gemini = new GeminiProvider();

    const summary = await MeetingSummaryService.generateSummary(cm, gemini);
    expect(summary).toContain('# Ata de Reunião — Copiloto de Conversas');
    expect(summary).toContain('## 📌 Resumo Executivo');
    expect(summary).toContain('Nenhuma fala registrada.');
  });

  it('gera ata contendo as 4 seções obrigatórias e falas gravadas', async () => {
    const cm = new ContextManager();
    cm.addUtterance('Quais são suas experiências com TypeScript?', 'interviewer', true);
    cm.addUtterance('Tenho 5 anos de experiência com TypeScript e Node.js.', 'candidate', true);

    const gemini = new GeminiProvider();
    const summary = await MeetingSummaryService.generateSummary(cm, gemini);

    expect(summary).toContain('## 📌 Resumo Executivo');
    expect(summary).toContain('## 🤝 Decisões Tomadas');
    expect(summary).toContain('## ✅ Action Items (Tarefas & Próximos Passos)');
    expect(summary).toContain('## 💬 Transcrição Completa');
    expect(summary).toContain('[ENTREVISTADOR/REUNIÃO]: Quais são suas experiências com TypeScript?');
    expect(summary).toContain('[VOCÊ]: Tenho 5 anos de experiência com TypeScript e Node.js.');
    expect(summary).toContain('Quais são suas experiências com TypeScript?');
  });

  it('retorna null quando o provedor não está configurado', async () => {
    const cm = new ContextManager();
    cm.addUtterance('Vamos alinhar as entregas da sprint.', 'interviewer', true);

    const unconfigured = new GeminiProvider();
    const result = await MeetingSummaryService.generateStructuredSummary(cm, unconfigured);
    expect(result).toBeNull();
  });

  it('gera snapshot estruturado com decisões e action items a partir do stream', async () => {
    const cm = new ContextManager();
    cm.addUtterance('Vamos alinhar as entregas da sprint.', 'interviewer', true);

    const result = await MeetingSummaryService.generateStructuredSummary(cm, new FakeSummaryProvider());

    expect(result).not.toBeNull();
    expect(result!.topics).toContain('Backend');
    expect(result!.decisions).toContain('Usar Kafka para mensageria');
    expect(result!.actionItems).toEqual(['Criar PR da fila', 'Validar DLQ']);
    expect(result!.summaryText).toContain('Alinhamento');
    expect(result!.lastUpdated).toBeGreaterThan(0);
  });
});
