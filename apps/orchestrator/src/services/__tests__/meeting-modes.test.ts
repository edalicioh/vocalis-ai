import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../context-manager';
import { MeetingMode } from '@conversation-copilot/shared-types';

describe('Meeting Modes & Adaptive System Prompts', () => {
  let cm: ContextManager;

  beforeEach(() => {
    cm = new ContextManager();
  });

  it('deve ter o modo "technical_interview" como padrão inicial', () => {
    expect(cm.getMeetingMode()).toBe('technical_interview');
  });

  it('deve permitir a alteração do modo de reunião para system_design', () => {
    cm.setMeetingMode('system_design');
    expect(cm.getMeetingMode()).toBe('system_design');
  });

  it('deve injetar o prompt do modo de reunião ativo no payload do LLM', () => {
    cm.setMeetingMode('system_design');
    const prompt = cm.buildPromptPayload('Como você projetaria a arquitetura do WhatsApp?');

    expect(prompt).toContain('=== DIRETRIZ DO MODO DE REUNIÃO ATIVO ===');
    expect(prompt).toContain('MODO: SYSTEM DESIGN & ARQUITETURA.');
    expect(prompt).toContain('trade-offs de arquitetura');
  });

  it('deve injetar as notas customizadas em Markdown do modo ativo se fornecidas', () => {
    const customNotes = 'Requisitos do projeto: Usar Kafka para mensagens e Redis para cache.';
    cm.setMeetingMode('code_review', { code_review: customNotes });

    const prompt = cm.buildPromptPayload('O que você acha dessa implementação de fila?');

    expect(prompt).toContain('MODO: CODE REVIEW & REFATORAÇÃO.');
    expect(prompt).toContain('=== NOTAS DO USUÁRIO PARA ESTE MODO ===');
    expect(prompt).toContain(customNotes);
  });

  it('deve adaptar as diretrizes para os 4 modos suportados', () => {
    const modes: MeetingMode[] = ['technical_interview', 'system_design', 'code_review', 'general'];

    modes.forEach((mode) => {
      cm.setMeetingMode(mode);
      const prompt = cm.buildPromptPayload('Pergunta de teste');
      expect(prompt).toContain('=== DIRETRIZ DO MODO DE REUNIÃO ATIVO ===');
    });
  });

  it('deve considerar o modo general como passivo (sem detecção automática de perguntas)', () => {
    expect(cm.isPassiveMode()).toBe(false);

    cm.setMeetingMode('general');
    expect(cm.isPassiveMode()).toBe(true);

    cm.setMeetingMode('technical_interview');
    expect(cm.isPassiveMode()).toBe(false);
  });

  it('deve injetar diretriz de transcrição passiva no prompt do modo general', () => {
    cm.setMeetingMode('general');
    const prompt = cm.buildPromptPayload('O que acharam da priorização?');

    expect(prompt).toContain('MODO: REUNIÃO GERAL & ALINHAMENTO (TRANSCRIÇÃO PASSIVA).');
    expect(prompt).toContain('Não assuma o papel de um candidato em entrevista técnica.');
    expect(prompt).toContain('Action Items');
  });
});
