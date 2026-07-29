import React, { useState, useRef } from 'react';
import {
  Mic,
  Play,
  Volume2,
  VolumeX,
  Layout,
  MoreHorizontal,
  GripVertical,
  Settings,
  Download,
  Sparkles,
  Check,
  Activity,
  AlertTriangle,
  Pause,
  Target,
  Boxes,
  Code2,
  FileText
} from 'lucide-react';
import { WidgetPosition, HUDLayoutMode } from '../widget-state';
import { StatusUpdatePayload, ConversationTone, MeetingMode, UiLanguage } from '@conversation-copilot/shared-types';
import { t } from '../../shared/i18n';

/** Mapa de cores por tom de conversa */
const TONE_COLORS: Record<ConversationTone, { bg: string; text: string; label: string }> = {
  neutro:      { bg: '#94a3b8', text: '#f8fafc', label: 'Neutro' },
  amigável:    { bg: '#22c55e', text: '#f8fafc', label: 'Amigável' },
  tenso:       { bg: '#ef4444', text: '#f8fafc', label: 'Tenso' },
  disperso:    { bg: '#f59e0b', text: '#0f0f23', label: 'Disperso' },
  interessado: { bg: '#3b82f6', text: '#f8fafc', label: 'Interessado' },
  confuso:     { bg: '#a855f7', text: '#f8fafc', label: 'Confuso' },
  formal:      { bg: '#6366f1', text: '#f8fafc', label: 'Formal' }
};

/** Configurações de exibição dos modos de reunião */
const MODE_INFO: Record<MeetingMode, { label: string; shortLabel: string; icon: React.ReactNode; color: string }> = {
  technical_interview: { label: 'Entrevista Técnica', shortLabel: 'Entrevista', icon: <Target size={14} />, color: '#10b981' },
  system_design:      { label: 'System Design',      shortLabel: 'Design',     icon: <Boxes size={14} />,  color: '#8b5cf6' },
  code_review:        { label: 'Code Review',        shortLabel: 'Review',     icon: <Code2 size={14} />,  color: '#ec4899' },
  general:            { label: 'Reunião Geral',      shortLabel: 'Geral',      icon: <FileText size={14} />, color: '#64748b' }
};

interface FunctionBarWidgetProps {
  position: WidgetPosition;
  onPositionChange: (pos: WidgetPosition) => void;
  status: StatusUpdatePayload;
  isCapturing: boolean;
  onToggleCapture: () => void;
  isGenerating: boolean;
  isSpeaking: boolean;
  onStopSpeech: () => void;
  ttsMuted: boolean;
  onToggleMute: () => void;
  ttsRate: number;
  onChangeTtsRate: (rate: number) => void;
  hudMode: HUDLayoutMode;
  onChangeHudMode: (mode: HUDLayoutMode) => void;
  onForceSuggestion: () => void;
  onSaveSession: () => void;
  onOpenSettings: () => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  tone?: ConversationTone;
  toneConfidence?: number;
  toneSummary?: string;
  meetingMode?: MeetingMode;
  onChangeMeetingMode?: (mode: MeetingMode) => void;
  isAudioActive?: boolean;
  uiLanguage?: UiLanguage;
}

export const FunctionBarWidget: React.FC<FunctionBarWidgetProps> = ({
  position,
  onPositionChange,
  status,
  isCapturing,
  onToggleCapture,
  isGenerating,
  isSpeaking,
  onStopSpeech,
  ttsMuted,
  onToggleMute,
  ttsRate,
  onChangeTtsRate,
  hudMode,
  onChangeHudMode,
  onForceSuggestion,
  onSaveSession,
  onOpenSettings,
  opacity,
  onOpacityChange,
  tone = 'neutro',
  toneConfidence = 0.5,
  toneSummary = '',
  meetingMode = 'technical_interview',
  onChangeMeetingMode,
  isAudioActive = false,
  uiLanguage = 'pt-BR'
}) => {
  const [openMenu, setOpenMenu] = useState<'status' | 'mode' | 'audio' | 'visual' | 'more' | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const opensUpward = position.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: position.x,
      originY: position.y
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = moveEvent.clientX - dragRef.current.startX;
      const dy = moveEvent.clientY - dragRef.current.startY;
      const newX = Math.max(8, Math.min(window.innerWidth - 340, dragRef.current.originX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 50, dragRef.current.originY + dy));
      onPositionChange({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const toggleMenu = (menu: 'status' | 'mode' | 'audio' | 'visual' | 'more') => {
    setOpenMenu(prev => (prev === menu ? null : menu));
  };

  // Determina rótulo, cor e ícone de estado de escuta/status (VAD - RF-002 & AUDIO-02)
  let statusLabel = isCapturing ? (isAudioActive ? 'Ouvindo' : 'Ouvindo (Silêncio)') : 'Iniciar';
  let statusColor = isCapturing ? (isAudioActive ? '#22c55e' : '#818cf8') : '#818cf8';
  let statusBg = isCapturing ? (isAudioActive ? 'rgba(34, 197, 94, 0.25)' : 'rgba(99, 102, 241, 0.25)') : 'rgba(99, 102, 241, 0.25)';
  let statusIcon = isCapturing ? (
    <Mic size={14} className={isAudioActive ? 'copilot-pulse' : ''} />
  ) : (
    <Play size={14} />
  );

  if (isSpeaking) {
    statusLabel = 'Lendo';
    statusColor = '#818cf8';
    statusBg = 'rgba(99, 102, 241, 0.25)';
    statusIcon = <Volume2 size={14} className="copilot-pulse" />;
  } else if (isGenerating) {
    statusLabel = 'Gerando';
    statusColor = '#c084fc';
    statusBg = 'rgba(192, 132, 252, 0.25)';
    statusIcon = <Sparkles size={14} className="copilot-pulse" />;
  } else if (isCapturing && !status.whisperConnected) {
    statusLabel = 'Reconectando';
    statusColor = '#f59e0b';
    statusBg = 'rgba(245, 158, 11, 0.25)';
    statusIcon = <AlertTriangle size={14} />;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 999999,
        opacity,
        transition: 'opacity 0.2s ease',
        userSelect: 'none',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 10px',
          borderRadius: '16px',
          backgroundColor: '#0f0f23',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Handle de Arraste */}
        <span
          onPointerDown={handlePointerDown}
          style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#64748b', paddingRight: '4px' }}
          title="Arrastar Barra de Funções"
        >
          <GripVertical size={14} />
        </span>

        {/* 1. Controle de Escuta */}
        <button
          onClick={onToggleCapture}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: statusBg,
            color: statusColor,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title={isCapturing ? 'Pausar escuta da reunião' : 'Iniciar escuta da reunião'}
        >
          {statusIcon}
          <span>{statusLabel}</span>
        </button>

        {/* 2. Botão de Status da Conexão (Integrado) */}
        <button
          onClick={() => toggleMenu('status')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: openMenu === 'status' ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
            color: status.whisperConnected && status.llmConfigured ? '#22c55e' : '#f59e0b',
            cursor: 'pointer'
          }}
          title="Status dos Serviços e Conexão"
        >
          <Activity size={14} />
        </button>

        {/* 2b. Botão do Modo de Reunião */}
        <button
          onClick={() => toggleMenu('mode')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: openMenu === 'mode' ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.05)',
            color: MODE_INFO[meetingMode]?.color || '#818cf8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title={`Modo ativo: ${MODE_INFO[meetingMode]?.label}`}
        >
          {MODE_INFO[meetingMode]?.icon}
          <span>{MODE_INFO[meetingMode]?.shortLabel}</span>
        </button>

        <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 2px' }} />

        {/* 3. Controle de Áudio/TTS */}
        <button
          onClick={() => toggleMenu('audio')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: openMenu === 'audio' ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
            color: ttsMuted ? '#94a3b8' : '#818cf8',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
          title="Controle de Áudio / Leitura TTS"
        >
          {ttsMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          <span>Áudio</span>
        </button>

        {/* 4. Controle de Visualização */}
        <button
          onClick={() => toggleMenu('visual')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: openMenu === 'visual' ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
          title="Alternar modo de visualização"
        >
          <Layout size={14} color="#818cf8" />
          <span>Visual</span>
        </button>

        {/* 5. Menu Mais */}
        <button
          onClick={() => toggleMenu('more')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: openMenu === 'more' ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
            color: '#94a3b8',
            cursor: 'pointer'
          }}
          title="Mais opções"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Popover Status da Sessão */}
      {openMenu === 'status' && (
        <div
          style={{
            position: 'absolute',
            top: opensUpward ? 'auto' : '48px',
            bottom: opensUpward ? '48px' : 'auto',
            left: '30px',
            width: '210px',
            backgroundColor: '#0f0f23',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.85)',
            fontSize: '11px',
            color: '#f8fafc',
            zIndex: 1000000
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '4px' }}>
            Status da Sessão
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#94a3b8' }}>Transcrição:</span>
            <span style={{ color: status.whisperConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
              {status.whisperConnected ? 'Conectada' : 'Desconectada'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#94a3b8' }}>IA (Gemini):</span>
            <span style={{ color: status.llmConfigured ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
              {status.llmConfigured ? 'Ativa' : 'Pendente'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Servidor local:</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Ativo</span>
          </div>

          {isCapturing && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8' }}>Tom da conversa:</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: TONE_COLORS[tone].text,
                  backgroundColor: TONE_COLORS[tone].bg,
                  padding: '2px 8px',
                  borderRadius: '8px'
                }}>
                  {TONE_COLORS[tone].label}
                </span>
              </div>
              {toneSummary && (
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>
                  {toneSummary}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Popover Modo de Reunião */}
      {openMenu === 'mode' && (
        <div
          style={{
            position: 'absolute',
            top: opensUpward ? 'auto' : '48px',
            bottom: opensUpward ? '48px' : 'auto',
            left: '60px',
            width: '210px',
            backgroundColor: '#0f0f23',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '12px',
            padding: '10px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.85)',
            fontSize: '12px',
            color: '#ffffff',
            zIndex: 1000000
          }}
        >
          <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '11px', marginBottom: '8px', paddingLeft: '4px' }}>
            Modo de Reunião Ativo
          </div>
          {(['technical_interview', 'system_design', 'code_review', 'general'] as MeetingMode[]).map(modeKey => {
            const info = MODE_INFO[modeKey];
            const isSelected = meetingMode === modeKey;
            return (
              <button
                key={modeKey}
                onClick={() => {
                  onChangeMeetingMode?.(modeKey);
                  setOpenMenu(null);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
                  color: isSelected ? '#ffffff' : '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '2px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: info.color }}>{info.icon}</span>
                  <span>{info.label}</span>
                </div>
                {isSelected && <Check size={14} color="#a5b4fc" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Popover Áudio */}
      {openMenu === 'audio' && (
        <div
          style={{
            position: 'absolute',
            top: opensUpward ? 'auto' : '48px',
            bottom: opensUpward ? '48px' : 'auto',
            left: '100px',
            width: '195px',
            backgroundColor: '#0f0f23',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.85)',
            fontSize: '12px',
            color: '#ffffff',
            zIndex: 1000000
          }}
        >
          <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>Leitura TTS</div>
          <button
            onClick={onToggleMute}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: ttsMuted ? 'rgba(255, 255, 255, 0.05)' : 'rgba(99, 102, 241, 0.35)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            <span>{ttsMuted ? 'Áudio Desativado' : 'Áudio Ativado'}</span>
            {!ttsMuted && <Check size={14} color="#a5b4fc" />}
          </button>

          <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>Velocidade</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {[0.9, 1.0, 1.25, 1.5].map(rate => (
              <button
                key={rate}
                onClick={() => onChangeTtsRate(rate)}
                style={{
                  padding: '6px 4px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: ttsRate === rate ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: ttsRate === rate ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {rate}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Popover Visual */}
      {openMenu === 'visual' && (
        <div
          style={{
            position: 'absolute',
            top: opensUpward ? 'auto' : '48px',
            bottom: opensUpward ? '48px' : 'auto',
            left: '160px',
            width: '210px',
            backgroundColor: '#0f0f23',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '12px',
            padding: '10px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.85)',
            fontSize: '12px',
            color: '#ffffff',
            zIndex: 1000000
          }}
        >
          <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '11px', marginBottom: '8px', paddingLeft: '4px' }}>
            Modo de Visualização
          </div>
          {[
            { id: 'default', label: 'Resposta' },
            { id: 'reading', label: 'Resposta + Transcrição' },
            { id: 'keywords', label: 'Palavras-chave' },
            { id: 'compact', label: 'Modo Compacto' }
          ].map(item => {
            const isSelected = hudMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeHudMode(item.id as HUDLayoutMode);
                  setOpenMenu(null);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
                  color: isSelected ? '#ffffff' : '#e2e8f0',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '2px'
                }}
              >
                <span>{item.label}</span>
                {isSelected && <Check size={14} color="#a5b4fc" />}
              </button>
            );
          })}

          <div style={{ margin: '8px 4px 4px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>
              <span>Opacidade dos painéis</span>
              <span style={{ color: '#c7d2fe' }}>{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(event) => onOpacityChange(Number(event.target.value))}
              aria-label="Opacidade dos painéis"
              style={{ width: '100%', marginTop: '8px', cursor: 'pointer', accentColor: '#6366f1' }}
            />
          </div>
        </div>
      )}

      {/* Popover Mais */}
      {openMenu === 'more' && (
        <div
          style={{
            position: 'absolute',
            top: opensUpward ? 'auto' : '48px',
            bottom: opensUpward ? '48px' : 'auto',
            right: '0',
            width: '200px',
            backgroundColor: '#0f0f23',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.85)',
            fontSize: '12px',
            color: '#ffffff',
            zIndex: 1000000
          }}
        >
          <button
            onClick={() => {
              onForceSuggestion();
              setOpenMenu(null);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#ffffff',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Sparkles size={14} color="#a855f7" />
            <span>Gerar sugestão agora</span>
          </button>

          <button
            onClick={() => {
              onSaveSession();
              setOpenMenu(null);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#ffffff',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Download size={14} color="#38bdf8" />
            <span>Salvar sessão</span>
          </button>

          <button
            onClick={() => {
              onOpenSettings();
              setOpenMenu(null);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#ffffff',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Settings size={14} color="#94a3b8" />
            <span>Configurações</span>
          </button>
        </div>
      )}
    </div>
  );
};
