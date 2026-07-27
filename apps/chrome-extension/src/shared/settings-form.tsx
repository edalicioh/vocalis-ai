import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  JobDescription,
  ResponseMode,
  TtsMode,
  Settings,
  AIProvider
} from '@conversation-copilot/shared-types';

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
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');

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
  const [responseMode, setResponseMode] = useState<ResponseMode>('short');
  const [ttsMode, setTtsMode] = useState<TtsMode>('manual');
  const [ttsSpeed, setTtsSpeed] = useState(1.25);
  const [ttsVolume, setTtsVolume] = useState(0.4);

  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');

  // Carrega dados salvos
  useEffect(() => {
    chrome.storage.local.get(null, (res) => {
      if (res.aiProvider) setAiProvider(res.aiProvider);
      if (res.geminiApiKey) setGeminiApiKey(res.geminiApiKey);
      if (res.openaiApiKey) setOpenaiApiKey(res.openaiApiKey);
      if (res.anthropicApiKey) setAnthropicApiKey(res.anthropicApiKey);
      if (res.ollamaEndpoint) setOllamaEndpoint(res.ollamaEndpoint);
      if (res.ollamaModel) setOllamaModel(res.ollamaModel);
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
      geminiApiKey,
      openaiApiKey,
      anthropicApiKey,
      ollamaEndpoint,
      ollamaModel,
      responseMode,
      ttsMode,
      ttsSpeed,
      ttsVolume,
      ttsAutoPlay: ttsMode !== 'off' && ttsMode !== 'manual',
      autoTrigger: true,
      userProfile,
      jobDescription: job
    };
  };

  const handleSave = () => {
    const payload = buildPayload();

    chrome.storage.local.set({
      aiProvider, geminiApiKey, openaiApiKey, anthropicApiKey, ollamaEndpoint, ollamaModel,
      name, role, seniority, skills, experiences, projects,
      strengths, weaknesses, jobTitle, jobCompany, jobDescription,
      jobRequirements, jobNiceToHave, jobTechnologies, jobNotes,
      responseMode, ttsMode, ttsSpeed, ttsVolume
    }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });

    const ws = new WebSocket('ws://localhost:3001/ws');
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'settings.update', payload }));
      setTimeout(() => ws.close(), 500);
    };

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
              <label style={labelStyle}>Provedor de IA Ativo</label>
              <select
                value={aiProvider}
                onChange={e => setAiProvider(e.target.value as AIProvider)}
                style={inputStyle}
              >
                <option value="gemini">✨ Google Gemini API</option>
                <option value="openai">🤖 OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="anthropic">🧠 Anthropic (Claude 3.5 Sonnet)</option>
                <option value="ollama">🏠 Ollama Local (100% Offline)</option>
              </select>
            </div>

            {aiProvider === 'gemini' && (
              <Field label="Chave de API do Google Gemini" type="password" value={geminiApiKey} onChange={setGeminiApiKey} placeholder="AIzaSy..." />
            )}

            {aiProvider === 'openai' && (
              <Field label="Chave de API da OpenAI (sk-...)" type="password" value={openaiApiKey} onChange={setOpenaiApiKey} placeholder="sk-..." />
            )}

            {aiProvider === 'anthropic' && (
              <Field label="Chave de API da Anthropic (sk-ant-...)" type="password" value={anthropicApiKey} onChange={setAnthropicApiKey} placeholder="sk-ant-..." />
            )}

            {aiProvider === 'ollama' && (
              <>
                <Field label="Endpoint do Ollama Local" value={ollamaEndpoint} onChange={setOllamaEndpoint} placeholder="http://localhost:11434" />
                <Field label="Nome do Modelo Ollama" value={ollamaModel} onChange={setOllamaModel} placeholder="llama3 ou mistral" />
              </>
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

        {/* Tab: Modos (RF-017, RF-013) */}
        {activeTab === 'modes' && (
          <>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Modo de Resposta</label>
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
