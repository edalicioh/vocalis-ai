import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextManager } from '../context-manager.js';
import { QuestionDetector } from '../question-detector.js';
import { AnswerProviderManager } from '../provider-manager.js';
import { MeetingSummaryService } from '../meeting-summary.js';
import { GeminiProvider } from '../gemini.js';
import { OpenAIProvider } from '../openai.js';
import { AnthropicProvider } from '../anthropic.js';
import { OllamaProvider } from '../ollama.js';
import { AnswerProvider, AnswerInput, AnswerEvent } from '../answer-provider.js';

// ============================================================
// Testes de Integração — Fluxo completo entre serviços
// ============================================================

describe('Integração: QuestionDetector → ContextManager → AnswerProvider', () => {
  let cm: ContextManager;
  let manager: AnswerProviderManager;

  beforeEach(() => {
    cm = new ContextManager();
    manager = new AnswerProviderManager();
  });

  it('detecta pergunta, alimenta contexto e monta prompt para IA', () => {
    // 1. Simula fala transcrita pelo Whisper
    const transcricao = 'Como você implementaria uma fila de mensagens distribuída?';
    cm.addUtterance(transcricao, 'interviewer', true);

    // 2. Detecta pergunta via QuestionDetector
    const deteccion = QuestionDetector.detect(transcricao, 1200, true);
    expect(deteccion.isQuestion).toBe(true);
    expect(deteccion.score).toBeGreaterThanOrEqual(0.35);

    // 3. Monta prompt contextualizado via ContextManager
    const prompt = cm.buildPromptPayload(transcricao, 'short');
    expect(prompt).toContain('Como você implementaria');
    expect(prompt).toContain('PERGUNTA ATUAL');
    expect(prompt).toContain('MODO DE RESPOSTA: SHORT');

    // 4. Verifica que o AnswerProviderManager tem provedor configurável
    expect(manager.getActiveProviderType()).toBe('gemini');
    expect(manager.getActiveProvider()).toBeInstanceOf(GeminiProvider);
  });

  it('injeta perfil e vaga no contexto da IA corretamente', () => {
    // 1. Configurar perfil do candidato (RF-015)
    cm.updateProfile({
      name: 'João Silva',
      role: 'Engenheiro Backend Senior',
      seniority: 'Senior',
      skills: ['Node.js', 'TypeScript', 'Kafka'],
      experiences: ['5 anos em arquitetura de microsserviços'],
      projects: ['Gateway de pagamentos com 10M TPS'],
      strengths: ['Sistemas distribuídos', 'Performance'],
      weaknesses: ['Frontend']
    });

    // 2. Configurar vaga (RF-016)
    cm.updateJobDescription({
      title: 'Staff Engineer',
      company: 'Empresa Tech',
      requirements: ['Node.js', 'Kubernetes'],
      technologies: ['TypeScript', 'Kafka', 'PostgreSQL']
    });

    // 3. Montar prompt e validar inclusão do perfil/vaga
    const prompt = cm.buildPromptPayload('Como você escala um microsserviço?', 'full');
    expect(prompt).toContain('João Silva');
    expect(prompt).toContain('Engenheiro Backend Senior');
    expect(prompt).toContain('Node.js');
    expect(prompt).toContain('Kafka');
    expect(prompt).toContain('Staff Engineer');
    expect(prompt).toContain('Empresa Tech');
    expect(prompt).toContain('MODO DE RESPOSTA: FULL');
  });

  it('alterna provedor durante a sessão sem perder contexto', () => {
    // 1. Adiciona contexto ao ContextManager
    cm.addUtterance('Fale sobre sua experiência com Docker', 'interviewer', true);
    cm.addUtterance('Tenho 3 anos usando Docker e Kubernetes.', 'candidate', true);

    const prompt = cm.buildPromptPayload('Como você faria um deploy blue-green?', 'short');

    // 2. Inicia com Gemini
    expect(manager.getActiveProviderType()).toBe('gemini');

    // 3. Troca para OpenAI
    manager.updateSettings({ aiProvider: 'openai', openaiApiKey: 'sk-test-key-123' });
    expect(manager.getActiveProviderType()).toBe('openai');
    expect(manager.getActiveProvider()).toBeInstanceOf(OpenAIProvider);
    expect(manager.isConfigured()).toBe(true);

    // 4. Troca para Anthropic
    manager.updateSettings({ aiProvider: 'anthropic', anthropicApiKey: 'sk-ant-test-key' });
    expect(manager.getActiveProviderType()).toBe('anthropic');
    expect(manager.getActiveProvider()).toBeInstanceOf(AnthropicProvider);

    // 5. Troca para Ollama
    manager.updateSettings({ aiProvider: 'ollama', ollamaEndpoint: 'http://localhost:11434', ollamaModel: 'mistral' });
    expect(manager.getActiveProviderType()).toBe('ollama');
    expect(manager.getActiveProvider()).toBeInstanceOf(OllamaProvider);

    // 6. Troca para Proxy Agnóstico / API Customizada
    manager.updateSettings({
      aiProvider: 'custom_proxy',
      customProxyEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
      customProxyApiKey: 'gsk-test',
      customProxyModel: 'llama-3.3-70b'
    });
    expect(manager.getActiveProviderType()).toBe('custom_proxy');
    expect(manager.getActiveProvider().isConfigured()).toBe(true);

    // 7. Volta para Gemini
    manager.updateSettings({ aiProvider: 'gemini' });
    expect(manager.getActiveProviderType()).toBe('gemini');
    expect(manager.getActiveProvider()).toBeInstanceOf(GeminiProvider);

    // 7. Contexto permanece intacto durante trocas
    const recentUtterances = cm.getRecentUtterances();
    expect(recentUtterances).toHaveLength(2);
    expect(recentUtterances[0].text).toContain('Docker');
  });
});

describe('Integração: ContextManager → MeetingSummaryService', () => {
  it('gera ata fallback com todas as seções quando Gemini não está configurado', async () => {
    const cm = new ContextManager();
    cm.addUtterance('Qual sua experiência com React?', 'interviewer', true);
    cm.addUtterance('Uso React há 4 anos em projetos SPA.', 'candidate', true);
    cm.addUtterance('Como você lida com gerenciamento de estado?', 'interviewer', true);
    cm.addUtterance('Uso Redux Toolkit para estado global e React Query para server state.', 'candidate', true);

    // GeminiProvider sem API key → fallback
    const gemini = new GeminiProvider();
    const markdown = await MeetingSummaryService.generateSummary(cm, gemini);

    // Valida estrutura obrigatória da ata
    expect(markdown).toContain('# Ata de Reunião — Copiloto de Conversas');
    expect(markdown).toContain('## 📌 Resumo Executivo');
    expect(markdown).toContain('## 🤝 Decisões Tomadas');
    expect(markdown).toContain('## ✅ Action Items');
    expect(markdown).toContain('## 💬 Transcrição Completa');

    // Valida que as falas aparecem na transcrição
    expect(markdown).toContain('React');
    expect(markdown).toContain('Redux Toolkit');
    expect(markdown).toContain('React Query');
  });

  it('gera ata fallback vazia quando não há falas', async () => {
    const cm = new ContextManager();
    const gemini = new GeminiProvider();

    const markdown = await MeetingSummaryService.generateSummary(cm, gemini);

    expect(markdown).toContain('Nenhuma fala registrada.');
    expect(markdown).toContain('## 📌 Resumo Executivo');
  });
});

describe('Integração: QuestionDetector — Limiares progressivos e pause detection', () => {
  it('avalia cenário completo de entrevista com pausas progressivas', () => {
    // Cenário 1: Pausa curta, detecção não confirmada
    const q1 = QuestionDetector.detect('Como você lida com conflitos no time?', 300, true);
    expect(q1.isQuestion).toBe(true); // Padrão interrogativo forte
    expect(QuestionDetector.isConfirmed(300, q1.score)).toBe(false); // Pausa muito curta

    // Cenário 2: Pausa provável, detecta pré-fetch
    const q2 = QuestionDetector.detect('Me explique sobre Event Sourcing', 750, true);
    expect(q2.isQuestion).toBe(true);
    expect(q2.score).toBeGreaterThanOrEqual(0.35);
    expect(QuestionDetector.isPrefetchReady(750, q2.score)).toBe(q2.score >= 0.5);

    // Cenário 3: Pausa longa confirmada, disparo de geração
    const q3 = QuestionDetector.detect('Qual a diferença entre SQL e NoSQL?', 1100, true);
    expect(q3.isQuestion).toBe(true);
    expect(q3.reasons).toContain('pausa longa confirmada');
    expect(QuestionDetector.isConfirmed(1100, q3.score)).toBe(true);
  });

  it('penaliza transcrições parciais corretamente', () => {
    const textoPergunta = 'Como você implementa testes de integração?';

    const resultadoFinal = QuestionDetector.detect(textoPergunta, 1000, true);
    const resultadoParcial = QuestionDetector.detect(textoPergunta, 1000, false);

    expect(resultadoFinal.score).toBeGreaterThan(resultadoParcial.score);
    expect(resultadoParcial.reasons).toContain('transcrição parcial (confiança reduzida)');
  });
});

describe('Integração: ProviderManager — ciclo de vida completo de settings', () => {
  it('propaga configurações para todos os provedores simultaneamente', () => {
    const manager = new AnswerProviderManager();

    // Atualiza tudo de uma vez (como viria de um settings.update do WebSocket)
    manager.updateSettings({
      aiProvider: 'openai',
      geminiApiKey: 'gemini-key-123',
      openaiApiKey: 'sk-openai-key-456',
      anthropicApiKey: 'sk-ant-key-789',
      ollamaEndpoint: 'http://192.168.1.100:11434',
      ollamaModel: 'codellama'
    });

    // Provedor ativo é OpenAI
    expect(manager.getActiveProviderType()).toBe('openai');
    expect(manager.isConfigured()).toBe(true);

    // Mas todos os provedores receberam suas chaves
    expect(manager.geminiProvider.isConfigured()).toBe(true);
    expect(manager.openAIProvider.isConfigured()).toBe(true);
    expect(manager.anthropicProvider.isConfigured()).toBe(true);
    expect(manager.ollamaProvider.isConfigured()).toBe(true);
  });

  it('delega generate ao provedor ativo correto', async () => {
    const manager = new AnswerProviderManager();

    // Sem API key, OpenAI deve falhar
    manager.updateSettings({ aiProvider: 'openai' });

    const input: AnswerInput = {
      requestId: 'test-123',
      question: 'Teste de integração',
      prompt: 'prompt de teste',
      responseMode: 'short'
    };

    const events: AnswerEvent[] = [];
    for await (const event of manager.generate(input)) {
      events.push(event);
    }

    // Deve emitir answer.failed porque não há API key
    expect(events.some(e => e.type === 'answer.failed')).toBe(true);
  });

  it('delega generate ao Anthropic sem API key e recebe falha', async () => {
    const manager = new AnswerProviderManager();
    manager.updateSettings({ aiProvider: 'anthropic' });

    const input: AnswerInput = {
      requestId: 'test-456',
      question: 'Teste anthropic',
      prompt: 'prompt anthropic',
      responseMode: 'short'
    };

    const events: AnswerEvent[] = [];
    for await (const event of manager.generate(input)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('answer.failed');
    expect(events[0].data).toHaveProperty('error');
  });
});

describe('Integração: Janela deslizante do ContextManager sob carga', () => {
  it('mantém janela de 10 falas ao receber 25 falas sequenciais', () => {
    const cm = new ContextManager();

    // Simula 25 falas durante uma reunião longa
    for (let i = 1; i <= 25; i++) {
      const speaker = i % 2 === 0 ? 'candidate' : 'interviewer';
      cm.addUtterance(`Fala ${i} da reunião sobre arquitetura`, speaker as any, true);
    }

    const recentes = cm.getRecentUtterances();
    expect(recentes.length).toBeLessThanOrEqual(10);

    // Deve conter apenas as falas mais recentes
    const textos = recentes.map(u => u.text);
    expect(textos.some(t => t.includes('Fala 25'))).toBe(true);
    // 'Fala 1 da reunião' não deve estar entre as 10 mais recentes (falas 16-25)
    expect(textos.some(t => t === 'Fala 1 da reunião sobre arquitetura')).toBe(false);
  });

  it('dispara sumarização após 5 falas finais consecutivas', () => {
    const cm = new ContextManager();

    for (let i = 0; i < 4; i++) {
      cm.addUtterance(`Fala ${i + 1}`, 'interviewer', true);
      expect(cm.shouldUpdateSummary()).toBe(false);
    }

    cm.addUtterance('Fala 5 — trigger de sumarização', 'interviewer', true);
    expect(cm.shouldUpdateSummary()).toBe(true);

    // Prompt de sumarização deve conter as falas
    const summaryPrompt = cm.buildSummaryPrompt();
    expect(summaryPrompt).toContain('Fala 5');
    expect(summaryPrompt).toContain('Resuma a conversa');

    // Atualiza resumo e reseta contador
    cm.updateSummary({
      topics: ['Arquitetura distribuída'],
      technologies: ['Kafka', 'Redis'],
      summaryText: 'Discussão sobre event-driven architecture.'
    });

    expect(cm.shouldUpdateSummary()).toBe(false);

    // Resumo deve aparecer no prompt da próxima pergunta
    const prompt = cm.buildPromptPayload('Qual padrão de mensageria usar?', 'short');
    expect(prompt).toContain('event-driven architecture');
    expect(prompt).toContain('Kafka');
  });
});

describe('Integração: Fluxo end-to-end — Transcrição → Detecção → Prompt → Troca de Provedor', () => {
  it('simula sessão completa de entrevista com troca de provedor no meio', () => {
    const cm = new ContextManager();
    const manager = new AnswerProviderManager();

    // 1. Configura perfil (como o usuário faria no painel de opções)
    cm.updateProfile({
      name: 'Maria Oliveira',
      role: 'Tech Lead',
      skills: ['Python', 'AWS', 'Terraform']
    });
    cm.updateJobDescription({
      title: 'Principal Engineer',
      company: 'Big Tech Corp',
      technologies: ['Python', 'Kubernetes', 'AWS']
    });

    // 2. Simulação de falas transcritas pelo Whisper
    const falas = [
      { text: 'Bom dia Maria, vamos começar a entrevista.', speaker: 'interviewer' },
      { text: 'Bom dia, obrigada pela oportunidade.', speaker: 'candidate' },
      { text: 'Como você projetaria um sistema de notificações em tempo real?', speaker: 'interviewer' }
    ];

    for (const fala of falas) {
      cm.addUtterance(fala.text, fala.speaker as any, true);
    }

    // 3. Detecção de pergunta na última fala
    const ultimaFala = falas[falas.length - 1].text;
    const deteccao = QuestionDetector.detect(ultimaFala, 1100, true);
    expect(deteccao.isQuestion).toBe(true);
    expect(QuestionDetector.isConfirmed(1100, deteccao.score)).toBe(true);

    // 4. Monta prompt com contexto completo
    const prompt = cm.buildPromptPayload(ultimaFala, 'full');
    expect(prompt).toContain('Maria Oliveira');
    expect(prompt).toContain('Tech Lead');
    expect(prompt).toContain('Principal Engineer');
    expect(prompt).toContain('Big Tech Corp');
    expect(prompt).toContain('notificações em tempo real');

    // 5. Troca de provedor (settings.update) — Gemini → Ollama
    expect(manager.getActiveProviderType()).toBe('gemini');
    manager.updateSettings({
      aiProvider: 'ollama',
      ollamaEndpoint: 'http://localhost:11434',
      ollamaModel: 'llama3'
    });
    expect(manager.getActiveProviderType()).toBe('ollama');
    expect(manager.isConfigured()).toBe(true);

    // 6. Contexto permanece intacto
    const recentes = cm.getRecentUtterances();
    expect(recentes).toHaveLength(3);
    expect(cm.getUserProfile().name).toBe('Maria Oliveira');
    expect(cm.getJobDescription().company).toBe('Big Tech Corp');
  });
});
