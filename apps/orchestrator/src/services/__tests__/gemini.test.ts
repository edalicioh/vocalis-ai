import { describe, it, expect } from 'vitest';
import { buildSystemInstruction, GeminiProvider } from '../gemini.js';
import { UserProfile, JobDescription } from '@conversation-copilot/shared-types';

describe('GeminiProvider & buildSystemInstruction', () => {
  it('deve montar a system instruction com seções em Markdown quando o perfil e a vaga forem fornecidos', () => {
    const userProfile: UserProfile = {
      name: 'Edalicio',
      role: 'Engenheiro de Software Full Stack',
      seniority: 'Senior',
      skills: ['TypeScript', 'Node.js', 'React'],
      experiences: ['Sistemas distribuídos'],
      projects: ['Conversational Copilot'],
      strengths: ['Arquitetura de Software'],
      weaknesses: ['DevOps avançado'],
      preferredStyle: 'short',
      summary: ''
    };

    const jobDescription: JobDescription = {
      title: 'Senior Software Engineer',
      company: 'InnovateTech',
      description: 'Vaga para desenvolvimento de APIs escaláveis',
      requirements: ['TypeScript', 'Fastify'],
      niceToHave: ['Docker', 'Kubernetes'],
      technologies: ['Node.js', 'PostgreSQL'],
      notes: ''
    };

    const instruction = buildSystemInstruction(userProfile, jobDescription);

    expect(instruction).toContain('[PERFIL DO CANDIDATO]');
    expect(instruction).toContain('- Nome: Edalicio');
    expect(instruction).toContain('- Cargo: Engenheiro de Software Full Stack');
    expect(instruction).toContain('- Habilidades: TypeScript, Node.js, React');

    expect(instruction).toContain('[DETALHES DA VAGA]');
    expect(instruction).toContain('- Título da vaga: Senior Software Engineer');
    expect(instruction).toContain('- Empresa: InnovateTech');
    expect(instruction).toContain('- Requisitos obrigatórios: TypeScript, Fastify');
  });

  it('deve gerar system instruction padrão se perfil ou vaga forem omitidos', () => {
    const instruction = buildSystemInstruction();

    expect(instruction).toContain('Você é um assistente copiloto pessoal');
    expect(instruction).not.toContain('[PERFIL DO CANDIDATO]');
    expect(instruction).not.toContain('[DETALHES DA VAGA]');
  });

  it('deve verificar o status de configuração do GeminiProvider', () => {
    const providerWithoutKey = new GeminiProvider('');
    expect(providerWithoutKey.isConfigured()).toBe(false);

    const providerWithKey = new GeminiProvider('test-api-key-123');
    expect(providerWithKey.isConfigured()).toBe(true);
  });
});
