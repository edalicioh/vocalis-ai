import { describe, it, expect } from 'vitest';
import { ContextManager } from '../context-manager.js';
import { GeminiProvider } from '../gemini.js';
import { MeetingSummaryService } from '../meeting-summary.js';

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
});
