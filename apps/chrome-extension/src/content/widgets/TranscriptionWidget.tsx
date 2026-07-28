import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, GripVertical, Minus, X, User } from 'lucide-react';
import { Utterance } from '@conversation-copilot/shared-types';
import { WidgetDimensions, WidgetPosition } from '../widget-state';

interface TranscriptionWidgetProps {
  position: WidgetPosition;
  onPositionChange: (pos: WidgetPosition) => void;
  dimensions: WidgetDimensions;
  onDimensionsChange: (dimensions: WidgetDimensions) => void;
  utterances: Utterance[];
  partialTranscript: string;
  onClose: () => void;
  onToggleMinimize: () => void;
  isMinimized: boolean;
  opacity: number;
}

export const TranscriptionWidget: React.FC<TranscriptionWidgetProps> = ({
  position,
  onPositionChange,
  dimensions,
  onDimensionsChange,
  utterances,
  partialTranscript,
  onClose,
  onToggleMinimize,
  isMinimized,
  opacity
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; width: number; height: number } | null>(null);

  // Intelligent Autoscroll
  useEffect(() => {
    if (!userIsScrolling && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [utterances, partialTranscript, userIsScrolling]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 30;
    setUserIsScrolling(!isAtBottom);
  };

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
      const newX = Math.max(8, Math.min(window.innerWidth - dimensions.width, dragRef.current.originX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - (isMinimized ? 44 : dimensions.height), dragRef.current.originY + dy));
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

  const handleResizeStart = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: dimensions.width,
      height: dimensions.height
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!resizeRef.current) return;
      const maxWidth = Math.min(700, window.innerWidth - position.x - 8);
      const maxHeight = Math.min(window.innerHeight * 0.9, window.innerHeight - position.y - 8);
      onDimensionsChange({
        width: Math.max(280, Math.min(maxWidth, resizeRef.current.width + moveEvent.clientX - resizeRef.current.startX)),
        height: Math.max(200, Math.min(maxHeight, resizeRef.current.height + moveEvent.clientY - resizeRef.current.startY))
      });
    };

    const handlePointerUp = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Pega apenas os últimos 5 itens para manter compacto
  const visibleUtterances = utterances.slice(-5);

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${dimensions.width}px`,
        height: isMinimized ? 'auto' : `${dimensions.height}px`,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: '90vh',
        zIndex: 999998,
        opacity,
        transition: 'opacity 0.2s ease',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        userSelect: 'text'
      }}
    >
      <div
        style={{
          borderRadius: '16px',
          backgroundColor: 'rgba(15, 15, 35, 0.9)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            userSelect: 'none',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              onPointerDown={handlePointerDown}
              style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#64748b' }}
              title="Arrastar Transcrição"
            >
              <GripVertical size={14} />
            </span>
            <MessageSquare size={14} color="#38bdf8" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.3px' }}>
              Transcrição ao Vivo
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={onToggleMinimize}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
              title={isMinimized ? 'Expandir' : 'Minimizar'}
            >
              <Minus size={14} />
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
              title="Ocultar transcrição"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              padding: '10px 12px',
              overflowY: 'auto',
              flex: 1,
              fontSize: '13px',
              color: '#e2e8f0',
              lineHeight: 1.5
            }}
          >
            {visibleUtterances.length === 0 && !partialTranscript && (
              <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
                Aguardando fala na reunião...
              </div>
            )}

            {visibleUtterances.map((u, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginBottom: '2px' }}>
                  <User size={10} color="#38bdf8" />
                  <span>{u.speaker || 'FALA'}</span>
                </div>
                <div style={{ color: '#f8fafc' }}>{u.text}</div>
              </div>
            ))}

            {partialTranscript && (
              <div style={{ fontStyle: 'italic', color: '#94a3b8', marginTop: '4px' }}>
                {partialTranscript}
                <span className="copilot-cursor">▍</span>
              </div>
            )}
          </div>
        )}

        {!isMinimized && (
          <span
            onPointerDown={handleResizeStart}
            title="Redimensionar transcrição"
            aria-label="Redimensionar transcrição"
            style={{
              position: 'absolute',
              right: '5px',
              bottom: '3px',
              color: '#64748b',
              cursor: 'se-resize',
              fontSize: '12px',
              lineHeight: 1,
              userSelect: 'none',
              touchAction: 'none'
            }}
          >
            ◢
          </span>
        )}
      </div>
    </div>
  );
};
