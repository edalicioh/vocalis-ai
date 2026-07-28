import React, { useState, useRef } from 'react';
import { Sparkles, Mic, Volume2, AlertTriangle, Pause, GripVertical } from 'lucide-react';
import { StatusUpdatePayload, ConversationTone } from '@conversation-copilot/shared-types';
import { WidgetPosition } from '../widget-state';

interface StatusIndicatorWidgetProps {
  position: WidgetPosition;
  onPositionChange: (pos: WidgetPosition) => void;
  status: StatusUpdatePayload;
  isCapturing: boolean;
  isGenerating: boolean;
  isSpeaking: boolean;
  opacity: number;
  tone?: ConversationTone;
  toneConfidence?: number;
  toneSummary?: string;
}

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

export const StatusIndicatorWidget: React.FC<StatusIndicatorWidgetProps> = ({
  position,
  onPositionChange,
  status,
  isCapturing,
  isGenerating,
  isSpeaking,
  opacity,
  tone = 'neutro',
  toneConfidence = 0.5,
  toneSummary = ''
}) => {
  const [showDetails, setShowDetails] = useState(false);
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
      const newX = Math.max(8, Math.min(window.innerWidth - 150, dragRef.current.originX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 40, dragRef.current.originY + dy));
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

  // Determina o texto e o estado visual
  let label = 'Pausado';
  let color = '#94a3b8';
  let icon = <Pause size={13} color="#94a3b8" />;

  if (isSpeaking) {
    label = 'Lendo resposta';
    color = '#6366f1';
    icon = <Volume2 size={13} color="#6366f1" className="copilot-pulse" />;
  } else if (isGenerating) {
    label = 'Preparando resposta';
    color = '#a855f7';
    icon = <Sparkles size={13} color="#a855f7" className="copilot-pulse" />;
  } else if (isCapturing && status.whisperConnected) {
    label = 'Ouvindo';
    color = '#22c55e';
    icon = <Mic size={13} color="#22c55e" className="copilot-pulse" />;
  } else if (isCapturing && !status.whisperConnected) {
    label = 'Reconectando';
    color = '#f59e0b';
    icon = <AlertTriangle size={13} color="#f59e0b" />;
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
        onClick={() => setShowDetails(!showDetails)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '20px',
          backgroundColor: '#0f0f23',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          cursor: 'pointer'
        }}
      >
        <span
          onPointerDown={handlePointerDown}
          style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#64748b' }}
          title="Arrastar status"
        >
          <GripVertical size={13} />
        </span>

        {icon}

        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color,
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap'
          }}
        >
          {label}
        </span>

        {isCapturing && tone !== 'neutro' && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              color: TONE_COLORS[tone].text,
              backgroundColor: TONE_COLORS[tone].bg,
              padding: '2px 6px',
              borderRadius: '8px',
              letterSpacing: '0.3px',
              whiteSpace: 'nowrap',
              opacity: 0.85
            }}
            title={toneSummary}
          >
            {TONE_COLORS[tone].label}
          </span>
        )}
      </div>

      {showDetails && (
        <div
          style={{
            position: 'absolute',
            top: opensUpward ? 'auto' : '38px',
            bottom: opensUpward ? '38px' : 'auto',
            left: '0',
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

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <span style={{ color: '#94a3b8' }}>Tom da conversa:</span>
            <span style={{
              color: TONE_COLORS[tone].bg,
              fontWeight: 600,
              fontSize: '10px'
            }}>
              {TONE_COLORS[tone].label} ({Math.round(toneConfidence * 100)}%)
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
  );
};
