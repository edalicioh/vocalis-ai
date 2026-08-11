import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  JobDescription,
  ResponseMode,
  TtsMode,
  Settings,
  AIProvider,
  MeetingMode,
  ConversationAnalysisMode,
  UiLanguage
} from '@conversation-copilot/shared-types';
import { t } from './i18n';
import { normalizeMeetingMode } from './meeting-mode';

type SettingsTab = 'api' | 'profile' | 'job' | 'modes';

interface SettingsFormProps {
  onSave?: (payload: Partial<Settings>) => void;
  opacity?: number;
  onOpacityChange?: (val: number) => void;
}

export const SettingsForm: React.FC<SettingsFormProps> = ({ onSave, opacity = 1.0, onOpacityChange }) => {
  // API & Provider
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('claude-3-5-sonnet-20241022');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [customProxyEndpoint, setCustomProxyEndpoint] = useState('https://api.deepseek.com/v1/chat/completions');
  const [customProxyApiKey, setCustomProxyApiKey] = useState('');
  const [customProxyModel, setCustomProxyModel] = useState('deepseek-chat');
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('pt-BR');
  const [realtimeTranslation, setRealtimeTranslation] = useState(true);
  const [targetTranslationLanguage, setTargetTranslationLanguage] = useState('pt-BR');
  const [recordFullAudio, setRecordFullAudio] = useState(false);

  // Modelos carregados dinamicamente via API
  const [dynamicModels, setDynamicModels] = useState<Record<AIProvider, ModelOption[]>>({
    gemini: GEMINI_MODEL_OPTIONS,
    openai: OPENAI_MODEL_OPTIONS,
    anthropic: ANTHROPIC_MODEL_OPTIONS,
    ollama: OLLAMA_MODEL_OPTIONS,
    custom_proxy: CUSTOM_PROXY_MODEL_OPTIONS,
    chrome_ai: CHROME_AI_MODEL_OPTIONS
  });
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsMsg, setFetchModelsMsg] = useState<string | null>(null);

  const handleFetchDynamicModels = async (provider: AIProvider) => {
    setIsFetchingModels(true);
    setFetchModelsMsg(null);
    let apiKey = '';
    let endpoint = '';

    if (provider === 'gemini') apiKey = geminiApiKey;
    else if (provider === 'openai') apiKey = openaiApiKey;
    else if (provider === 'anthropic') apiKey = anthropicApiKey;
    else if (provider === 'ollama') endpoint = ollamaEndpoint;
    else if (provider === 'custom_proxy') {
      apiKey = customProxyApiKey;
      endpoint = customProxyEndpoint;
    }

    try {
      const httpBase = import.meta.env.VITE_ORCHESTRATOR_HTTP_URL || 'http://localhost:3001';
      const url = new URL(`${httpBase.replace(/\/$/, '')}/api/models`);
      url.searchParams.append('provider', provider);
      if (apiKey) url.searchParams.append('apiKey', apiKey);
      if (endpoint) url.searchParams.append('endpoint', endpoint);

      const res = await fetch(url.toString());
      const json = await res.json();

      if (json?.models?.length) {
        const fetchedOptions: ModelOption[] = json.models.map((m: string) => ({
          value: m,
          label: `✨ ${m}`
        }));
        setDynamicModels(prev => ({ ...prev, [provider]: fetchedOptions }));
        setFetchModelsMsg(`✓ ${json.models.length} modelos liberados na sua API!`);
        setTimeout(() => setFetchModelsMsg(null), 3500);
      } else {
        setFetchModelsMsg('⚠️ Nenhum modelo retornado pela API.');
      }
    } catch (err: any) {
      setFetchModelsMsg(`⚠️ Erro ao consultar API: ${err?.message || 'Orquestrador offline'}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Perfil profissional (RF-015)
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [seniority, setSeniority] = useState('Senior');
  const [skills, setSkills] = useState('');
  const [experiences, setExperiences] = useState('');
  const [projects, setProjects] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');

  // Vaga (RF-016)
  const [jobTitle, setJobTitle] = useState('');
  const [jobCompany, setJobCompany] = useState('');
  const [jobDescription, setJobDesc] = useState('');
  const [jobRequirements, setJobRequirements] = useState('');
  const [jobNiceToHave, setJobNiceToHave] = useState('');
  const [jobTechnologies, setJobTechnologies] = useState('');
  const [jobNotes, setJobNotes] = useState('');

  // Modos
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('technical_interview');
  const [conversationAnalysisMode, setConversationAnalysisMode] = useState<ConversationAnalysisMode>('local');
  const [modeNotes, setModeNotes] = useState<Record<MeetingMode, string>>({
    technical_interview: '',
    system_design: '',
    code_review: '',
    general: '',
    transcription_only: ''
  });
  const [rmsThreshold, setRmsThreshold] = useState<number>(0.01);
  const [responseMode, setResponseMode] = useState<ResponseMode>('short');
  const [ttsMode, setTtsMode] = useState<TtsMode>('manual');
  const [ttsSpeed, setTtsSpeed] = useState(1.25);
  const [ttsVolume, setTtsVolume] = useState(0.4);

  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');

  // Carrega dados salvos
  useEffect(() => {
    chrome.storage.local.get(null, (res) => {
      if (res.meetingMode) setMeetingMode(normalizeMeetingMode(res.meetingMode));
      setConversationAnalysisMode(res.conversationAnalysisMode === 'hybrid' ? 'hybrid' : 'local');
      if (res.modeNotes) setModeNotes(prev => ({ ...prev, ...res.modeNotes }));
      if (typeof res.rmsThreshold === 'number') setRmsThreshold(res.rmsThreshold);
      if (res.aiProvider) setAiProvider(res.aiProvider);
      if (res.geminiApiKey) setGeminiApiKey(res.geminiApiKey);
      if (res.geminiModel) setGeminiModel(res.geminiModel);
      if (res.openaiApiKey) setOpenaiApiKey(res.openaiApiKey);
      if (res.openaiModel) setOpenaiModel(res.openaiModel);
      if (res.anthropicApiKey) setAnthropicApiKey(res.anthropicApiKey);
      if (res.anthropicModel) setAnthropicModel(res.anthropicModel);
      if (res.ollamaEndpoint) setOllamaEndpoint(res.ollamaEndpoint);
      if (res.ollamaModel) setOllamaModel(res.ollamaModel);
      if (res.customProxyEndpoint) setCustomProxyEndpoint(res.customProxyEndpoint);
      if (res.customProxyApiKey) setCustomProxyApiKey(res.customProxyApiKey);
      if (res.customProxyModel) setCustomProxyModel(res.customProxyModel);
      if (res.name) setName(res.name);
      if (res.role) setRole(res.role);
      if (res.seniority) setSeniority(res.seniority);
      if (res.skills) setSkills(res.skills);
      if (res.experiences) setExperiences(res.experiences);
      if (res.projects) setProjects(res.projects);
      if (res.strengths) setStrengths(res.strengths);
      if (res.weaknesses) setWeaknesses(res.weaknesses);
      if (res.jobTitle) setJobTitle(res.jobTitle);
      if (res.jobCompany) setJobCompany(res.jobCompany);
      if (res.jobDescription) setJobDesc(res.jobDescription);
      if (res.jobRequirements) setJobRequirements(res.jobRequirements);
      if (res.jobNiceToHave) setJobNiceToHave(res.jobNiceToHave);
      if (res.jobTechnologies) setJobTechnologies(res.jobTechnologies);
      if (res.jobNotes) setJobNotes(res.jobNotes);
      if (res.uiLanguage) setUiLanguage(res.uiLanguage);
      if (res.realtimeTranslation !== undefined) setRealtimeTranslation(res.realtimeTranslation);
      if (res.targetTranslationLanguage) setTargetTranslationLanguage(res.targetTranslationLanguage);
      if (res.recordFullAudio !== undefined) setRecordFullAudio(res.recordFullAudio);
      if (res.responseMode) setResponseMode(res.responseMode);
      if (res.ttsMode) setTtsMode(res.ttsMode);
      if (res.ttsSpeed) setTtsSpeed(res.ttsSpeed);
      if (res.ttsVolume) setTtsVolume(res.ttsVolume);
    });
  }, []);

  const buildPayload = (): Partial<Settings> => {
    const splitList = (s: string) => s.split(',').map(i => i.trim()).filter(Boolean);

    const userProfile: UserProfile = {
      name,
      role,
      seniority,
      skills: splitList(skills),
      experiences: splitList(experiences),
      projects: splitList(projects),
      strengths: splitList(strengths),
      weaknesses: splitList(weaknesses),
      preferredStyle: responseMode,
      summary: ''
    };

    const job: JobDescription = {
      title: jobTitle,
      description: jobDescription,
      requirements: splitList(jobRequirements),
      niceToHave: splitList(jobNiceToHave),
      company: jobCompany,
      technologies: splitList(jobTechnologies),
      notes: jobNotes
    };

    return {
      aiProvider,
      meetingMode,
      conversationAnalysisMode,
      modeNotes,
      geminiApiKey,
      geminiModel,
      openaiApiKey,
      openaiModel,
      anthropicApiKey,
      anthropicModel,
      ollamaEndpoint,
      ollamaModel,
      customProxyEndpoint,
      customProxyApiKey,
      customProxyModel,
      responseMode,
      ttsMode,
      ttsSpeed,
      ttsVolume,
      ttsAutoPlay: ttsMode !== 'off' && ttsMode !== 'manual',
      autoTrigger: true,
      userProfile,
      jobDescription: job,
      uiLanguage,
      realtimeTranslation,
      targetTranslationLanguage,
      recordFullAudio
    };
  };

  const handleSave = () => {
    const payload = buildPayload();

    try {
      localStorage.setItem('copilotMeetingMode', meetingMode);
      localStorage.setItem('copilotModeNotes', JSON.stringify(modeNotes));
      localStorage.setItem('copilotUiLanguage', uiLanguage);
    } catch (e) {}

    chrome.storage.local.set({
      aiProvider, meetingMode, conversationAnalysisMode, modeNotes, rmsThreshold, geminiApiKey, geminiModel, openaiApiKey, openaiModel, anthropicApiKey, anthropicModel,
      ollamaEndpoint, ollamaModel, customProxyEndpoint, customProxyApiKey, customProxyModel,
      name, role, seniority, skills, experiences, projects,
      strengths, weaknesses, jobTitle, jobCompany, jobDescription,
      jobRequirements, jobNiceToHave, jobTechnologies, jobNotes,
      responseMode, ttsMode, ttsSpeed, ttsVolume, uiLanguage,
      realtimeTranslation, targetTranslationLanguage, recordFullAudio
    }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });

    chrome.runtime.sendMessage({ type: 'SET_RMS_THRESHOLD', rmsThreshold }).catch(() => {});

    onSave?.(payload);
  };

  return (
    <div style={formContainerStyle}>
      {/* Tabs */}
      <div style={tabBarStyle}>
        {(['api', 'profile', 'job', 'modes'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...tabStyle,
              borderBottom: activeTab === tab ? '2px solid #60a5fa' : '2px solid transparent',
              color: activeTab === tab ? '#60a5fa' : '#9ca3af'
            }}
          >
            {tab === 'api' ? '🔑 API' : tab === 'profile' ? '👤 Perfil' : tab === 'job' ? '💼 Vaga' : '⚙️ Modos'}
          </button>
        ))}
      </div>

      <div style={scrollAreaStyle}>
        {/* Tab: API */}
        {activeTab === 'api' && (
          <>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>🌐 {t('settings.language', uiLanguage)}</label>
              <select
                value={uiLanguage}
                onChange={e => setUiLanguage(e.target.value as UiLanguage)}
                style={inputStyle}
              >
                <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                <option value="en">🇺🇸 English</option>
              </select>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>🗣️ {t('settings.realtimeTranslation', uiLanguage)}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={realtimeTranslation}
                  onChange={e => setRealtimeTranslation(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: '#d1d5db' }}>
                  {realtimeTranslation ? 'Ativada (traduzir falas em tempo real)' : 'Desativada'}
                </span>
              </div>
            </div>

            {realtimeTranslation && (
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>🎯 {t('settings.targetTranslationLanguage', uiLanguage)}</label>
                <select
                  value={targetTranslationLanguage}
                  onChange={e => setTargetTranslationLanguage(e.target.value)}
                  style={inputStyle}
                >
                  <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                  <option value="en">🇺🇸 English</option>
                  <option value="es">🇪🇸 Español</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="de">🇩🇪 Deutsch</option>
                </select>
              </div>
            )}

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>{t('settings.provider', uiLanguage)}</label>
              <select
                value={aiProvider}
                onChange={e => setAiProvider(e.target.value as AIProvider)}
                style={inputStyle}
              >
                <option value="gemini">✨ Google Gemini API</option>
                <option value="openai">🤖 OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="anthropic">🧠 Anthropic (Claude 3.5 Sonnet)</option>
                <option value="ollama">🏠 Ollama Local (100% Offline)</option>
                <option value="custom_proxy">🌐 Proxy Agnóstico / API Customizada (DeepSeek, Groq, OpenRouter, etc.)</option>
              </select>
            </div>

            {aiProvider === 'gemini' && (
              <>
                <Field label="Chave de API do Google Gemini" type="password" value={geminiApiKey} onChange={setGeminiApiKey} placeholder="AIzaSy..." />
                <ModelSelectorField
                  label="Modelo do Google Gemini"
                  options={dynamicModels.gemini}
                  value={geminiModel}
                  onChange={setGeminiModel}
                  onFetchModels={() => handleFetchDynamicModels('gemini')}
                  isFetching={isFetchingModels}
                />
              </>
            )}

            {aiProvider === 'openai' && (
              <>
                <Field label="Chave de API da OpenAI (sk-...)" type="password" value={openaiApiKey} onChange={setOpenaiApiKey} placeholder="sk-..." />
                <ModelSelectorField
                  label="Modelo da OpenAI"
                  options={dynamicModels.openai}
                  value={openaiModel}
                  onChange={setOpenaiModel}
                  onFetchModels={() => handleFetchDynamicModels('openai')}
                  isFetching={isFetchingModels}
                />
              </>
            )}

            {aiProvider === 'anthropic' && (
              <>
                <Field label="Chave de API da Anthropic (sk-ant-...)" type="password" value={anthropicApiKey} onChange={setAnthropicApiKey} placeholder="sk-ant-..." />
                <ModelSelectorField
                  label="Modelo da Anthropic"
                  options={dynamicModels.anthropic}
                  value={anthropicModel}
                  onChange={setAnthropicModel}
                  onFetchModels={() => handleFetchDynamicModels('anthropic')}
                  isFetching={isFetchingModels}
                />
              </>
            )}

            {aiProvider === 'ollama' && (
              <>
                <Field label="Endpoint do Ollama Local" value={ollamaEndpoint} onChange={setOllamaEndpoint} placeholder="http://localhost:11434" />
                <ModelSelectorField
                  label="Modelo do Ollama Local"
                  options={dynamicModels.ollama}
                  value={ollamaModel}
                  onChange={setOllamaModel}
                  onFetchModels={() => handleFetchDynamicModels('ollama')}
                  isFetching={isFetchingModels}
                />
              </>
            )}

            {aiProvider === 'custom_proxy' && (
              <>
                <Field label="Endpoint do Proxy LLM (OpenAI Compatible)" value={customProxyEndpoint} onChange={setCustomProxyEndpoint} placeholder="https://api.deepseek.com/v1/chat/completions" />
                <Field label="Chave de API / Bearer Token (opcional)" type="password" value={customProxyApiKey} onChange={setCustomProxyApiKey} placeholder="sk-..." />
                <ModelSelectorField
                  label="Modelo do Proxy Customizado"
                  options={dynamicModels.custom_proxy}
                  value={customProxyModel}
                  onChange={setCustomProxyModel}
                  onFetchModels={() => handleFetchDynamicModels('custom_proxy')}
                  isFetching={isFetchingModels}
                />
              </>
            )}

            {fetchModelsMsg && (
              <div style={{ fontSize: '11px', color: fetchModelsMsg.startsWith('✓') ? '#4ade80' : '#facc15', textAlign: 'center', marginTop: '4px' }}>
                {fetchModelsMsg}
              </div>
            )}

            <div style={hintStyle}>
              A configuração selecionada é enviada ao orquestrador local e salva no seu navegador.
            </div>
          </>
        )}

        {/* Tab: Perfil (RF-015) */}
        {activeTab === 'profile' && (
          <>
            <Field label="Nome (opcional)" value={name} onChange={setName} placeholder="Seu nome" />
            <Field label="Cargo" value={role} onChange={setRole} placeholder="Ex: Engenheiro de Software" />
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Senioridade</label>
              <select value={seniority} onChange={e => setSeniority(e.target.value)} style={inputStyle}>
                <option value="Junior">Junior</option>
                <option value="Pleno">Pleno</option>
                <option value="Senior">Senior</option>
                <option value="Staff">Staff</option>
                <option value="Principal">Principal</option>
              </select>
            </div>
            <Field label="Habilidades (separadas por vírgula)" value={skills} onChange={setSkills} placeholder="TypeScript, Node.js, React, Python" />
            <Field label="Experiências relevantes" value={experiences} onChange={setExperiences} placeholder="APIs REST, Microserviços, CI/CD" multiline />
            <Field label="Projetos" value={projects} onChange={setProjects} placeholder="Plataforma de pagamentos, Sistema de filas" multiline />
            <Field label="Pontos fortes" value={strengths} onChange={setStrengths} placeholder="Arquitetura, Performance, Comunicação" />
            <Field label="Áreas a desenvolver" value={weaknesses} onChange={setWeaknesses} placeholder="DevOps avançado, Frontend avançado" />
          </>
        )}

        {/* Tab: Vaga (RF-016) */}
        {activeTab === 'job' && (
          <>
            <Field label="Título da vaga" value={jobTitle} onChange={setJobTitle} placeholder="Engenheiro de Software Full Stack" />
            <Field label="Empresa" value={jobCompany} onChange={setJobCompany} placeholder="Nome da empresa" />
            <Field label="Descrição da vaga" value={jobDescription} onChange={setJobDesc} placeholder="Breve descrição..." multiline />
            <Field label="Requisitos obrigatórios" value={jobRequirements} onChange={setJobRequirements} placeholder="React, Node.js, TypeScript" />
            <Field label="Diferenciais" value={jobNiceToHave} onChange={setJobNiceToHave} placeholder="Kubernetes, AWS, GraphQL" />
            <Field label="Tecnologias" value={jobTechnologies} onChange={setJobTechnologies} placeholder="React, Node.js, PostgreSQL, Redis" />
            <Field label="Observações" value={jobNotes} onChange={setJobNotes} placeholder="Notas extras sobre a vaga..." multiline />
          </>
        )}

        {/* Tab: Modos (RF-017, RF-013, RF-020) */}
        {activeTab === 'modes' && (
          <>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Modo de Reunião Ativo</label>
              <select value={meetingMode} onChange={e => setMeetingMode(e.target.value as MeetingMode)} style={inputStyle}>
                <option value="technical_interview">🎯 Entrevista Técnica (Respostas curtas de 30s)</option>
                <option value="system_design">🏗️ System Design (Trade-offs e Arquitetura)</option>
                <option value="code_review">💻 Code Review (Complexidade e Refatoração)</option>
                <option value="general">📝 Reunião Geral (Alinhamento e Action Items)</option>
                <option value="transcription_only">🎙️ Apenas Transcrição (Sem sugestões automáticas)</option>
              </select>
            </div>

            <div style={fieldGroupStyle}>
              <label htmlFor="conversation-analysis-mode" style={labelStyle}>⚡ Velocidade & Modo de Análise</label>
              <select
                id="conversation-analysis-mode"
                aria-describedby="conversation-analysis-mode-description"
                value={conversationAnalysisMode}
                onChange={e => setConversationAnalysisMode(e.target.value as ConversationAnalysisMode)}
                style={inputStyle}
              >
                <option value="local">🏠 Local (Processamento 100% no dispositivo)</option>
                <option value="hybrid">⚡ Híbrido / Nuvem (Bypass Local - Máxima Velocidade de Resposta)</option>
              </select>
              <p id="conversation-analysis-mode-description" style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0' }}>
                Para testar velocidade extrema de resposta, selecione <b>Híbrido / Nuvem</b>. Isso desliga o processamento do modelo local e utiliza a API direta na nuvem.
              </p>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Notas & Diretrizes do Modo Ativo (Markdown)</label>
              <textarea
                value={modeNotes[meetingMode] || ''}
                onChange={e => {
                  const text = e.target.value;
                  setModeNotes(prev => ({ ...prev, [meetingMode]: text }));
                }}
                placeholder="Cole aqui diretrizes da vaga, requisitos de arquitetura ou lembretes específicos para este modo..."
                style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                rows={3}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Sensibilidade do Filtro de Ruído/Silêncio (RMS Gate)</label>
              <select value={rmsThreshold} onChange={e => setRmsThreshold(parseFloat(e.target.value))} style={inputStyle}>
                <option value={0.02}>⚡ Baixa (0.02 - Filtra ruído alto de fundo)</option>
                <option value={0.01}>🎯 Média (0.01 - Padrão / Recomendado)</option>
                <option value={0.005}>🎙️ Alta (0.005 - Captura sussurros e fala suave)</option>
                <option value={0.0}>🔓 Desativado (0.0 - Envia 100% dos pacotes)</option>
              </select>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Modo de Resposta da IA</label>
              <select value={responseMode} onChange={e => setResponseMode(e.target.value as ResponseMode)} style={inputStyle}>
                <option value="keywords">🔑 Palavras-chave</option>
                <option value="short">📝 Curto (30-60 palavras)</option>
                <option value="full">📄 Completo (80-150 palavras)</option>
                <option value="structured">🏗️ Estruturado</option>
              </select>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Modo de Leitura</label>
              <select value={ttsMode} onChange={e => setTtsMode(e.target.value as TtsMode)} style={inputStyle}>
                <option value="off">🔇 Desligado</option>
                <option value="full">🔊 Ler resposta completa</option>
                <option value="summary">📢 Ler somente resumo</option>
                <option value="keywords">🔑 Ler palavras-chave</option>
                <option value="manual">🖐️ Manual (Alt+S)</option>
              </select>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Opacidade do Painel: {Math.round(opacity * 100)}%</label>
              <input type="range" min="0.3" max="1.0" step="0.05" value={opacity}
                onChange={e => onOpacityChange?.(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#60a5fa' }} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Velocidade da Leitura: {ttsSpeed}x</label>
              <input type="range" min="0.5" max="2.0" step="0.05" value={ttsSpeed}
                onChange={e => setTtsSpeed(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#60a5fa' }} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Volume da Leitura: {Math.round(ttsVolume * 100)}%</label>
              <input type="range" min="0" max="1" step="0.05" value={ttsVolume}
                onChange={e => setTtsVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#60a5fa' }} />
            </div>

            <div style={{ ...fieldGroupStyle, marginTop: '8px', padding: '10px', backgroundColor: '#111827', borderRadius: '8px', border: '1px solid #374151' }}>
              <label style={{ ...labelStyle, color: '#f3f4f6' }}>🎙️ Permissão de Microfone Local (Sua Voz)</label>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 8px 0' }}>
                Conceda permissão uma vez para que o assistente capture sua voz em conjunto com o áudio da reunião.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                    alert('✓ Permissão do microfone concedida com sucesso!');
                  } catch (err: any) {
                    alert(`❌ Não foi possível acessar o microfone (${err?.name || 'Erro'}): ${err?.message || 'Permissão negada no navegador'}`);
                  }
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Autorizar Microfone Local
              </button>
            </div>

            <div style={{ ...fieldGroupStyle, marginTop: '8px', padding: '10px', backgroundColor: '#111827', borderRadius: '8px', border: '1px solid #374151' }}>
              <label style={{ ...labelStyle, color: '#f3f4f6' }}>🎙️ Gravar áudio completo das reuniões</label>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 8px 0' }}>
                Grava a chamada completa (áudio da aba + seu microfone) em WebM/Opus, 100% local no IndexedDB do navegador — nada é enviado à nuvem. Desativado por padrão.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={recordFullAudio}
                  onChange={e => setRecordFullAudio(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: '#d1d5db' }}>
                  {recordFullAudio ? 'Ativada (gravará as reuniões localmente)' : 'Desativada'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Save button */}
      <button onClick={handleSave} style={buttonStyle}>
        {saved ? '✓ Salvo!' : 'Salvar Configurações'}
      </button>

      <div style={hintStyle}>
        Orquestrador e Whisper devem estar rodando. Veja <strong>docker:gpu</strong> ou <strong>docker:cpu</strong>.
      </div>
    </div>
  );
};

// ============================================================
// Componente auxiliar de campo
// ============================================================

interface ModelOption {
  value: string;
  label: string;
}

const GEMINI_MODEL_OPTIONS: ModelOption[] = [
  { value: 'gemini-2.5-flash', label: '⚡ Gemini 2.5 Flash (Recomendado / Ultra-Rápido)' },
  { value: 'gemini-1.5-flash', label: '⚡ Gemini 1.5 Flash (Rápido)' },
  { value: 'gemini-1.5-pro', label: '🧠 Gemini 1.5 Pro (Maior Raciocínio)' },
  { value: 'gemini-2.0-flash-exp', label: '🧪 Gemini 2.0 Flash (Experimental)' },
];

const OPENAI_MODEL_OPTIONS: ModelOption[] = [
  { value: 'gpt-4o-mini', label: '⚡ GPT-4o Mini (Recomendado / Rápido & Econômico)' },
  { value: 'gpt-4o', label: '🧠 GPT-4o (Completo / Multimodal)' },
  { value: 'gpt-4-turbo', label: '🚀 GPT-4 Turbo' },
  { value: 'o1-mini', label: '🧩 o1-mini (Raciocínio Rápido)' },
  { value: 'o1-preview', label: '🧩 o1-preview (Raciocínio Avançado)' },
];

const ANTHROPIC_MODEL_OPTIONS: ModelOption[] = [
  { value: 'claude-3-5-sonnet-20241022', label: '🧠 Claude 3.5 Sonnet v2 (Recomendado)' },
  { value: 'claude-3-5-haiku-20241022', label: '⚡ Claude 3.5 Haiku (Ultra-Rápido)' },
  { value: 'claude-3-opus-20240229', label: '🏛️ Claude 3 Opus (Raciocínio Complexo)' },
];

const OLLAMA_MODEL_OPTIONS: ModelOption[] = [
  { value: 'llama3', label: '🦙 Llama 3 (Padrão Local)' },
  { value: 'llama3.1', label: '🦙 Llama 3.1 (8B / 70B)' },
  { value: 'mistral', label: '🌪️ Mistral 7B' },
  { value: 'codestral', label: '💻 Codestral (Foco em Código)' },
  { value: 'qwen2.5-coder', label: '👨‍💻 Qwen 2.5 Coder' },
  { value: 'phi3', label: '🔬 Phi-3 Mini' },
];

const CUSTOM_PROXY_MODEL_OPTIONS: ModelOption[] = [
  { value: 'deepseek-chat', label: '🐳 DeepSeek V3 / R1 (DeepSeek API)' },
  { value: 'llama-3.3-70b-versatile', label: '⚡ Llama 3.3 70B (Groq LPU)' },
  { value: 'anthropic/claude-3.5-sonnet', label: '🌐 Claude 3.5 Sonnet (OpenRouter)' },
  { value: 'mistral-small-latest', label: '🍃 Mistral Small (Mistral Cloud)' },
];

const CHROME_AI_MODEL_OPTIONS: ModelOption[] = [
  { value: 'gemini-nano', label: '🤖 Gemini Nano On-Device (Chrome Built-in AI)' }
];


const ModelSelectorField: React.FC<{
  label: string;
  options: ModelOption[];
  value: string;
  onChange: (v: string) => void;
  onFetchModels?: () => void;
  isFetching?: boolean;
}> = ({ label, options, value, onChange, onFetchModels, isFetching }) => {
  const isCustomOption = Boolean(value) && !options.some(opt => opt.value === value);
  const [isCustomMode, setIsCustomMode] = useState(isCustomOption);

  useEffect(() => {
    if (value && !options.some(opt => opt.value === value)) {
      setIsCustomMode(true);
    }
  }, [value, options]);

  return (
    <div style={fieldGroupStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={labelStyle}>{label}</label>
        {onFetchModels && (
          <button
            type="button"
            onClick={onFetchModels}
            disabled={isFetching}
            style={{
              background: 'none',
              border: 'none',
              color: '#60a5fa',
              fontSize: '10px',
              fontWeight: 600,
              cursor: isFetching ? 'not-allowed' : 'pointer',
              padding: '0 2px'
            }}
          >
            {isFetching ? '⏳ Buscando...' : '🔄 Carregar da API'}
          </button>
        )}
      </div>
      <select
        value={isCustomMode ? '__custom__' : value}
        onChange={e => {
          const val = e.target.value;
          if (val === '__custom__') {
            setIsCustomMode(true);
          } else {
            setIsCustomMode(false);
            onChange(val);
          }
        }}
        style={inputStyle}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        <option value="__custom__">✏️ Outro modelo (digitar livremente...)</option>
      </select>

      {isCustomMode && (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Digite o identificador exato do modelo..."
          style={{ ...inputStyle, marginTop: '4px' }}
        />
      )}
    </div>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}> = ({ label, value, onChange, placeholder, type, multiline }) => (
  <div style={fieldGroupStyle}>
    <label style={labelStyle}>{label}</label>
    {multiline ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, minHeight: '48px', resize: 'vertical' }}
        rows={2}
      />
    ) : (
      <input
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    )}
  </div>
);

// ============================================================
// Estilos
// ============================================================

const formContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0',
  borderBottom: '1px solid #374151'
};

const tabStyle: React.CSSProperties = {
  flex: 1,
  background: 'none',
  border: 'none',
  padding: '6px 4px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'color 0.2s'
};

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  maxHeight: '320px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  paddingTop: '8px'
};

const fieldGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px'
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#9ca3af'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 8px',
  borderRadius: '6px',
  border: '1px solid #374151',
  backgroundColor: '#1f2937',
  color: '#f3f4f6',
  fontSize: '12px',
  fontFamily: 'inherit'
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  border: 'none',
  padding: '10px',
  borderRadius: '8px',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
  marginTop: '4px'
};

const hintStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#6b7280',
  textAlign: 'center',
  marginTop: '2px'
};
