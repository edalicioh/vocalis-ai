// ============================================================
// Tipos de Mensagem — Protocolo WebSocket (dot.notation)
// ============================================================

/**
 * Tipos de mensagem padronizados em dot.notation conforme
 * o Levantamento de Requisitos (seções 10.1 e 10.2).
 */
export type MessageType =
  // Extensão → Backend
  | 'session.register'
  | 'session.start'
  | 'session.stop'
  | 'audio.chunk'
  | 'audio.pause'
  | 'tts.status'
  | 'settings.update'
  | 'answer.cancel'
  | 'answer.force'
  // Backend → Extensão
  | 'session.ready'
  | 'session.error'
  | 'transcript.partial'
  | 'transcript.final'
  | 'transcript.preprocessed'
  | 'question.detected'
  | 'answer.started'
  | 'answer.delta'
  | 'answer.section.completed'
  | 'answer.completed'
  | 'answer.cancelled'
  | 'answer.failed'
  | 'metrics.updated'
  | 'status.update'
  | 'conversation.tone.updated'
  | 'error';

// ============================================================
// Perfil Profissional — RF-015
// ============================================================

export interface UserProfile {
  /** Nome opcional do candidato */
  name?: string;
  /** Cargo atual */
  role: string;
  /** Senioridade (junior, pleno, senior, staff, etc.) */
  seniority: string;
  /** Principais tecnologias */
  skills: string[];
  /** Experiências relevantes */
  experiences: string[];
  /** Exemplos de projetos */
  projects: string[];
  /** Pontos fortes */
  strengths: string[];
  /** Assuntos que não domina */
  weaknesses: string[];
  /** Estilo preferido de resposta */
  preferredStyle: ResponseMode;
  /** Resumo profissional (gerado ou manual) */
  summary: string;
}

// ============================================================
// Descrição da Vaga — RF-016
// ============================================================

export interface JobDescription {
  /** Título da vaga */
  title: string;
  /** Descrição da vaga */
  description: string;
  /** Requisitos obrigatórios */
  requirements: string[];
  /** Diferenciais */
  niceToHave: string[];
  /** Empresa */
  company: string;
  /** Tecnologias da vaga */
  technologies: string[];
  /** Observações */
  notes: string;
}

// ============================================================
// Modos de Reunião Adaptativos — RF-020
// ============================================================

export type MeetingMode = 'technical_interview' | 'system_design' | 'code_review' | 'general';

// ============================================================
// Modos de Resposta — RF-017
// ============================================================

export type ResponseMode = 'keywords' | 'short' | 'full' | 'structured';

// ============================================================
// Modos de TTS — RF-013
// ============================================================

export type TtsMode = 'off' | 'full' | 'summary' | 'keywords' | 'manual';

// ============================================================
// Modos Visuais do Painel — RF-012
// ============================================================

export type PanelMode = 'compact' | 'normal' | 'keywords-only' | 'transcription-only' | 'hidden';

// ============================================================
// Configurações — Expandidas
// ============================================================

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'custom_proxy';
export type UiLanguage = 'pt-BR' | 'en';
export type ConversationAnalysisMode = 'local' | 'hybrid';

export interface Settings {
  /** Provedor de IA ativo */
  aiProvider?: AIProvider;
  /** Modo de reunião ativo (padrão: technical_interview) */
  meetingMode?: MeetingMode;
  /** Modo de análise da conversa (padrão: local) */
  conversationAnalysisMode?: ConversationAnalysisMode;
  /** Notas de apoio customizadas por modo */
  modeNotes?: Partial<Record<MeetingMode, string>>;
  /** Chave da API (armazenada no backend — RNF-004) */
  geminiApiKey: string;
  /** Modelo do Google Gemini (padrão: gemini-2.5-flash ou gemini-1.5-pro) */
  geminiModel?: string;
  /** Chave da API OpenAI (GPT-4o) */
  openaiApiKey?: string;
  /** Nome do modelo OpenAI (padrão: gpt-4o-mini ou gpt-4o) */
  openaiModel?: string;
  /** Chave da API Anthropic (Claude 3.5 Sonnet) */
  anthropicApiKey?: string;
  /** Nome do modelo Anthropic (padrão: claude-3-5-sonnet-20241022) */
  anthropicModel?: string;
  /** URL do servidor Ollama Local (padrão: http://localhost:11434) */
  ollamaEndpoint?: string;
  /** Nome do modelo Ollama Local (padrão: llama3) */
  ollamaModel?: string;
  /** Endpoint do Proxy LLM Agnóstico / API Customizada */
  customProxyEndpoint?: string;
  /** Chave de API / Bearer Token do Proxy Customizado */
  customProxyApiKey?: string;
  /** Nome do Modelo do Proxy Customizado (ex: deepseek-chat, llama-3.3-70b-versatile, etc.) */
  customProxyModel?: string;
  /** Modo de resposta da IA — RF-017 */
  responseMode: ResponseMode;
  /** Modo do TTS — RF-013 */
  ttsMode: TtsMode;
  /** Velocidade do TTS (padrão: 1.25) */
  ttsSpeed: number;
  /** Volume do TTS (0 a 1, padrão: 0.4) */
  ttsVolume: number;
  /** Início automático do TTS */
  ttsAutoPlay: boolean;
  /** Disparo automático de sugestão quando pergunta detectada */
  autoTrigger: boolean;
  /** Modo visual do painel */
  panelMode: PanelMode;
  /** Perfil profissional do candidato */
  userProfile: UserProfile;
  /** Descrição da vaga */
  jobDescription: JobDescription;
  /** Idioma da interface (padrão: pt-BR) */
  uiLanguage?: UiLanguage;
}

// ============================================================
// Transcrição — RF-004
// ============================================================

export interface Utterance {
  id: string;
  speaker: 'interviewer' | 'candidate' | 'unknown';
  text: string;
  timestamp: number;
  isFinal: boolean;
  /** Confiança da transcrição (0 a 1) */
  confidence?: number;
  /** Idioma detectado */
  language?: string;
  /** Timestamp de início do trecho (segundos) */
  start?: number;
  /** Timestamp de fim do trecho (segundos) */
  end?: number;
}

// ============================================================
// Pré-processador Local — Chrome Built-in AI
// ============================================================

export interface ProcessedTranscriptPayload {
  /** Texto original transcrito pelo Whisper */
  originalText: string;
  /** Texto corrigido pelo Gemini Nano (jargões e termos técnicos ajustados) */
  correctedText: string;
  /** Resumo incremental atualizado do contexto */
  incrementalSummary?: string;
  /** Categoria da conversa/pergunta (DevOps, System Design, Backend, etc) */
  category?: string;
  /** Indica se a transcrição passou pelo Gemini Nano ou se usou bypass */
  isBypass: boolean;
}

// ============================================================
// Detecção de Pergunta — RF-006 / RF-007
// ============================================================

export interface QuestionDetectionResult {
  isQuestion: boolean;
  /** Pontuação de confiança (0 a 1) */
  score: number;
  /** Razões para a classificação */
  reasons: string[];
  /** Texto da pergunta detectada */
  questionText: string;
}

// ============================================================
// Resposta Estruturada da IA — RF-009
// ============================================================

export interface StructuredAnswer {
  /** Resumo da pergunta */
  questionSummary: string;
  /** Frase de abertura */
  opening: string;
  /** Resposta principal */
  answer: string;
  /** Palavras-chave (até 5) */
  keyPoints: string[];
  /** Pergunta de esclarecimento sugerida */
  clarifyingQuestion?: string;
  /** Dica curta para áudio (TTS) */
  audioHint?: string;
}

// ============================================================
// Sugestão (estado na extensão)
// ============================================================

export type SuggestionStatus = 'streaming' | 'complete' | 'cancelled' | 'error';

export interface Suggestion {
  id: string;
  question: string;
  /** Resposta estruturada (preenchida progressivamente) */
  structured: Partial<StructuredAnswer>;
  /** Texto completo acumulado (fallback para streaming não-estruturado) */
  rawText: string;
  timestamp: number;
  status: SuggestionStatus;
  /** Motivo do cancelamento (quando status === 'cancelled') */
  reason?: string;
}

// ============================================================
// Eventos de Resposta — RF-010
// ============================================================

export interface AnswerStartedPayload {
  id: string;
  question: string;
  responseMode: ResponseMode;
}

export interface AnswerDeltaPayload {
  id: string;
  chunk: string;
}

export interface AnswerSectionCompletedPayload {
  id: string;
  section: keyof StructuredAnswer;
  content: string | string[];
}

export interface AnswerCompletedPayload {
  id: string;
  structured: StructuredAnswer;
}

export interface AnswerCancelledPayload {
  id: string;
  reason: string;
}

export interface AnswerFailedPayload {
  id: string;
  error: string;
}

// ============================================================
// Dados de Áudio — RF-003
// ============================================================

export interface AudioChunkPayload {
  sampleRate: number;
  channels: number;
  timestamp: number;
  /** Número de sequência do bloco */
  sequence?: number;
  /** Formato de codificação */
  encoding?: 'pcm_s16le';
}

// ============================================================
// Métricas — RNF-007
// ============================================================

export interface QuestionMetrics {
  questionId: string;
  /** Timestamp: final da fala (ms) */
  speechEnd: number;
  /** Timestamp: transcrição final (ms) */
  transcriptFinal: number;
  /** Timestamp: requisição enviada à IA (ms) */
  requestStarted: number;
  /** Timestamp: primeiro token recebido (ms) */
  firstToken: number;
  /** Timestamp: resposta completa (ms) */
  completed: number;
  /** Tempo total end-to-end (ms) */
  totalLatency: number;
  /** Uso estimado de tokens */
  estimatedTokens?: number;
  /** Custo estimado (USD) */
  estimatedCost?: number;
  /** A resposta foi cancelada? */
  wasCancelled: boolean;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalQuestions: number;
  totalCancellations: number;
  averageLatency: number;
  questionMetrics: QuestionMetrics[];
  connectionErrors: number;
  estimatedTotalTokens: number;
  estimatedTotalCost: number;
}

// ============================================================
// Status — Atualização de estado
// ============================================================

export interface StatusUpdatePayload {
  whisperConnected: boolean;
  llmConfigured: boolean;
  isCapturing: boolean;
  activeSessionId?: string;
  /** Modo de resposta ativo */
  responseMode?: ResponseMode;
  /** Modo TTS ativo */
  ttsMode?: TtsMode;
  /** Modo visual do painel */
  panelMode?: PanelMode;
}

// ============================================================
// Mensagem WebSocket Genérica
// ============================================================

export interface WSMessage<T = unknown> {
  type: MessageType;
  sessionId?: string;
  payload?: T;
}

// ============================================================
// Resumo da Conversa — RF-018
// ============================================================

export interface ConversationSummary {
  /** Temas discutidos */
  topics: string[];
  /** Perguntas anteriores */
  previousQuestions: string[];
  /** Tecnologias mencionadas */
  technologies: string[];
  /** Resumo textual */
  summaryText: string;
  /** Timestamp da última atualização */
  lastUpdated: number;
}

// ============================================================
// Temperatura da Conversa — Análise de Tom
// ============================================================

export type ConversationTone =
  | 'neutro'
  | 'amigável'
  | 'tenso'
  | 'disperso'
  | 'interessado'
  | 'confuso'
  | 'formal';

export interface ToneUpdatePayload {
  /** Tom atual detectado */
  tone: ConversationTone;
  /** Confiança da detecção (0 a 1) */
  confidence: number;
  /** Descrição do estado da conversa */
  summary: string;
  /** Histórico de mudanças de tom (últimas N mudanças) */
  trends?: Array<{ tone: ConversationTone; at: number }>;
}

// ============================================================
// Conversas Salvas (Histórico e Exportação)
// ============================================================

export interface SavedConversation {
  id: string;
  title: string;
  url: string;
  timestamp: number;
  transcriptions: Utterance[];
  suggestions: Suggestion[];
  summary?: string;
}
