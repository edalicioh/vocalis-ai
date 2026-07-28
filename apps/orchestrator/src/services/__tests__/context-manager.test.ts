import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../context-manager.js';

describe('ContextManager', () => {
  let cm: ContextManager;

  beforeEach(() => {
    cm = new ContextManager();
  });

  it('deve inicializar com valores padrão de perfil e vaga', () => {
    const profile = cm.getUserProfile();
    const job = cm.getJobDescription();

    expect(profile.role).toBe('Engenheiro de Software');
    expect(profile.seniority).toBe('Senior');
    expect(job.title).toBe('');
  });

  it('deve atualizar o perfil do candidato corretamente', () => {
    cm.updateProfile({
      name: 'Edalicio',
      skills: ['TypeScript', 'Fastify', 'React'],
      seniority: 'Staff'
    });

    const profile = cm.getUserProfile();
    expect(profile.name).toBe('Edalicio');
    expect(profile.skills).toEqual(['TypeScript', 'Fastify', 'React']);
    expect(profile.seniority).toBe('Staff');
  });

  it('deve atualizar os detalhes da vaga corretamente', () => {
    cm.updateJobDescription({
      title: 'Tech Lead Backend',
      company: 'TechCorp',
      technologies: ['Node.js', 'PostgreSQL', 'Docker']
    });

    const job = cm.getJobDescription();
    expect(job.title).toBe('Tech Lead Backend');
    expect(job.company).toBe('TechCorp');
    expect(job.technologies).toEqual(['Node.js', 'PostgreSQL', 'Docker']);
  });

  it('deve adicionar falas e limitar a janela deslizante (sliding window)', () => {
    for (let i = 1; i <= 25; i++) {
      cm.addUtterance(`Fala número ${i}`, i % 2 === 0 ? 'candidate' : 'interviewer', true);
    }

    const recent = cm.getRecentUtterances();
    expect(recent.length).toBeLessThanOrEqual(10);
    expect(recent[recent.length - 1].text).toBe('Fala número 25');
  });

  it('deve montar o prompt payload com as seções de perfil, vaga e pergunta', () => {
    cm.updateProfile({ name: 'Maria', role: 'Engenheira de Dados' });
    cm.updateJobDescription({ title: 'Senior Data Engineer', company: 'DataCo' });
    cm.addUtterance('O que é um Pipeline de ETL?', 'interviewer', true);

    const prompt = cm.buildPromptPayload('O que é um Pipeline de ETL?', 'short');

    expect(prompt).toContain('Engenheira de Dados');
    expect(prompt).toContain('Senior Data Engineer');
    expect(prompt).toContain('O que é um Pipeline de ETL?');
    expect(prompt).toContain('=== MODO DE RESPOSTA: SHORT ===');
  });

  // ============ Novos testes: Buffer de parciais ============

  it('deve acumular transcrições parciais no buffer', () => {
    cm.addUtterance('eu estava pensando', 'interviewer', false);
    cm.addUtterance('que poderíamos usar', 'interviewer', false);
    cm.addUtterance('kafka para isso', 'interviewer', false);

    expect(cm.getAccumulatedPartials()).toBe('eu estava pensando que poderíamos usar kafka para isso');
  });

  it('deve limpar o buffer de parciais quando chega uma transcrição final', () => {
    cm.addUtterance('eu estava pensando', 'interviewer', false);
    cm.addUtterance('que poderíamos usar', 'interviewer', false);
    cm.addUtterance('Vamos usar Kafka?', 'interviewer', true);

    expect(cm.getAccumulatedPartials()).toBe('');
  });

  it('deve limitar o buffer de parciais a 5 entradas', () => {
    for (let i = 1; i <= 8; i++) {
      cm.addUtterance(`parcial ${i}`, 'interviewer', false);
    }

    const partials = cm.getAccumulatedPartials();
    expect(partials).not.toContain('parcial 1');
    expect(partials).toContain('parcial 8');
  });

  it('deve retornar string vazia quando não há parciais', () => {
    expect(cm.getAccumulatedPartials()).toBe('');
  });

  // ============ Novos testes: Rastreamento de pausa ============

  it('deve retornar 0 quando não há fala anterior', () => {
    expect(cm.getPauseSinceLastUtterance()).toBe(0);
  });

  it('deve rastrear a pausa desde a última fala finalizada', () => {
    const before = Date.now();
    cm.addUtterance('Olá', 'interviewer', true);
    const pause = cm.getPauseSinceLastUtterance();

    expect(pause).toBeGreaterThanOrEqual(0);
    expect(pause).toBeLessThan(100);
  });

  it('deve ignorar parciais para cálculo de pausa', () => {
    cm.addUtterance('parcial', 'interviewer', false);
    cm.addUtterance('parcial 2', 'interviewer', false);

    expect(cm.getPauseSinceLastUtterance()).toBe(0);

    cm.addUtterance('Final', 'interviewer', true);
    expect(cm.getPauseSinceLastUtterance()).toBeGreaterThanOrEqual(0);
  });

  // ============ Novos testes: Tom da conversa ============

  it('deve inicializar com tom neutro', () => {
    expect(cm.getCurrentTone()).toBe('neutro');
  });

  it('deve atualizar o tom corretamente', () => {
    cm.updateTone('amigável', 0.8, 'Conversa cordial e descontraída');

    expect(cm.getCurrentTone()).toBe('amigável');

    const payload = cm.getTonePayload();
    expect(payload.tone).toBe('amigável');
    expect(payload.confidence).toBe(0.8);
    expect(payload.summary).toBe('Conversa cordial e descontraída');
  });

  it('deve manter histórico de mudanças de tom', () => {
    cm.updateTone('amigável', 0.7, 'Tom amigável');
    cm.updateTone('tenso', 0.6, 'Tom tenso');

    const payload = cm.getTonePayload();
    expect(payload.trends).toHaveLength(2);
    expect(payload.trends![0].tone).toBe('amigável');
    expect(payload.trends![1].tone).toBe('tenso');
  });

  it('deve limitar o histórico de tom a 10 entradas', () => {
    for (let i = 0; i < 15; i++) {
      cm.updateTone('amigável', 0.5, `Teste ${i}`);
    }

    const payload = cm.getTonePayload();
    expect(payload.trends!.length).toBeLessThanOrEqual(10);
  });

  it('deve disparar análise de tom a cada 8 falas finais', () => {
    expect(cm.shouldAnalyzeTone()).toBe(false);

    for (let i = 0; i < 7; i++) {
      cm.addUtterance(`Fala ${i}`, 'interviewer', true);
      expect(cm.shouldAnalyzeTone()).toBe(false);
    }

    cm.addUtterance('Fala 8', 'interviewer', true);
    expect(cm.shouldAnalyzeTone()).toBe(true);
  });

  it('deve gerar prompt de análise de tom com o histórico', () => {
    cm.addUtterance('Olá, como vai?', 'interviewer', true);
    cm.addUtterance('Bem, obrigado!', 'candidate', true);

    const prompt = cm.buildToneAnalysisPrompt();
    expect(prompt).toContain('Olá, como vai?');
    expect(prompt).toContain('Bem, obrigado!');
    expect(prompt).toContain('neutro');
  });
});
