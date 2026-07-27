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
});
