import React, { useState, useRef } from 'react';
import { GripVertical, Minus, X, Volume2, Pause, Copy, Check, Sparkles, HelpCircle, Tag } from 'lucide-react';
import { Suggestion, QuestionDetectionResult, UiLanguage } from '@conversation-copilot/shared-types';
import { WidgetDimensions, WidgetPosition } from '../widget-state';
import { t } from '../../shared/i18n';

interface ResponsePanelWidgetProps {
  position: WidgetPosition;
  onPositionChange: (pos: WidgetPosition) => void;
  dimensions: WidgetDimensions;
  onDimensionsChange: (dimensions: WidgetDimensions) => void;
  suggestion?: Suggestion | null;
  suggestions?: Suggestion[];
  streamingContent: string;
  isStreaming: boolean;
  question: QuestionDetectionResult | null;
  onClose: () => void;
  onToggleMinimize: () => void;
  isMinimized: boolean;
  onSpeak: (text: string) => void;
  isSpeaking: boolean;
  onStopSpeech: () => void;
  activeSentenceIndex: number | null;
  opacity: number;
  uiLanguage?: UiLanguage;
}

export const ResponsePanelWidget: React.FC<ResponsePanelWidgetProps> = ({
  position,
  onPositionChange,
  dimensions,
  onDimensionsChange,
  suggestion = null,
  suggestions = [],
  streamingContent,
  isStreaming,
  question,
  onClose,
  onToggleMinimize,
  isMinimized,
  onSpeak,
  isSpeaking,
  onStopSpeech,
  activeSentenceIndex,
  opacity,
  uiLanguage = 'pt-BR'
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; width: number; height: number } | null>(null);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  // Lista combinada de sugestões em ordem cronológica (antiga -> recente)
  const allSuggestions: Suggestion[] = (suggestions.length > 0 ? suggestions : (suggestion ? [suggestion] : []))
    .slice()
    .reverse();

  // Efeito para auto-scroll suave até o item mais recente
  React.useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allSuggestions.length, isStreaming, streamingContent]);

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

  const handleCopyItem = (id: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeakItem = (id: string, text: string) => {
    if (isSpeaking && speakingId === id) {
      onStopSpeech();
      setSpeakingId(null);
    } else {
      onStopSpeech();
      setSpeakingId(id);
      onSpeak(text);
    }
  };

  // Se não houver pergunta nem sugestões nem streaming, mostra estado vazio
  const isEmpty = allSuggestions.length === 0 && !isStreaming && !question && !streamingContent;

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
        zIndex: 999999,
        opacity,
        transition: 'opacity 0.2s ease',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        userSelect: 'text'
      }}
    >
      <div
        style={{
          borderRadius: '16px',
          backgroundColor: 'rgba(15, 15, 35, 0.92)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header do Widget */}
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
              title="Arrastar Painel de Resposta"
            >
              <GripVertical size={14} />
            </span>
            <Sparkles size={14} color="#818cf8" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.3px' }}>
              {t('panel.title', uiLanguage)} {allSuggestions.length > 0 ? `(${allSuggestions.length})` : ''}
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
              title="Ocultar painel"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div ref={contentContainerRef} style={{ padding: '14px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Estado Vazio */}
            {isEmpty && (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8' }}>
                <Sparkles size={24} color="#6366f1" style={{ marginBottom: '8px', opacity: 0.6 }} />
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0' }}>Aguardando uma pergunta...</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  As sugestões de resposta encadeadas aparecerão automaticamente conforme as perguntas forem identificadas.
                </div>
              </div>
            )}

            {/* Lista Encadeada de Sugestões Concluídas */}
            {allSuggestions.map((sugg, itemIdx) => {
              const itemNum = itemIdx + 1;
              let starterSentence = sugg.structured?.opening || '';
              let fullAnswerText = sugg.structured?.answer || sugg.rawText || '';
              let keywords = sugg.structured?.keyPoints || [];

              if (!starterSentence && fullAnswerText) {
                const firstPeriod = fullAnswerText.indexOf('.');
                if (firstPeriod > 10 && firstPeriod < 120) {
                  starterSentence = fullAnswerText.substring(0, firstPeriod + 1);
                  fullAnswerText = fullAnswerText.substring(firstPeriod + 1).trim();
                }
              }

              const sentences: string[] = fullAnswerText ? fullAnswerText.match(/[^.!?]+[.!?]+/g) || [fullAnswerText] : [];
              const isItemSpeaking = isSpeaking && speakingId === sugg.id;
              const isCopied = copiedId === sugg.id;

              return (
                <div
                  key={sugg.id || itemIdx}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(99, 102, 241, 0.2)'
                  }}
                >
                  {/* Cabeçalho da Pergunta Encadeada */}
                  {sugg.question && (
                    <div
                      style={{
                        marginBottom: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px'
                      }}
                    >
                      <HelpCircle size={15} color="#f59e0b" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          PERGUNTA #{itemNum}
                        </div>
                        <div style={{ fontSize: '13px', color: '#fef3c7', fontWeight: 500 }}>{sugg.question}</div>
                      </div>
                    </div>
                  )}

                  {/* Nível 1: Frase de Abertura */}
                  {starterSentence && (
                    <div
                      style={{
                        marginBottom: '10px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        borderLeft: '4px solid #6366f1',
                        border: '1px solid rgba(99, 102, 241, 0.3)'
                      }}
                    >
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                        COMO COMEÇAR
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', lineHeight: 1.4 }}>
                        "{starterSentence}"
                      </div>
                    </div>
                  )}

                  {/* Nível 2: Resposta Principal */}
                  {fullAnswerText && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        RESPOSTA #{itemNum}
                      </div>
                      <div style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: 1.6 }}>
                        {sentences.map((sent: string, idx: number) => {
                          const isActive = isItemSpeaking && activeSentenceIndex === idx;
                          return (
                            <span
                              key={idx}
                              style={{
                                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                                borderLeft: isActive ? '3px solid #6366f1' : 'none',
                                paddingLeft: isActive ? '4px' : '0px',
                                borderRadius: isActive ? '4px' : '0px',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {sent}{' '}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Nível 3: Palavras-chave / Chips */}
                  {keywords.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {keywords.map((kw: string, i: number) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            color: '#a5b4fc',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                        >
                          <Tag size={10} />
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Barra de Ações Inferior do Item */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '8px',
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <button
                      onClick={() => handleCopyItem(sugg.id, sugg.rawText || fullAnswerText)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: 'transparent',
                        color: isCopied ? '#4ade80' : '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{isCopied ? t('panel.copied', uiLanguage) : t('panel.copy', uiLanguage)}</span>
                    </button>

                    <button
                      onClick={() => handleSpeakItem(sugg.id, sugg.rawText || fullAnswerText)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: isItemSpeaking ? 'rgba(239, 68, 68, 0.2)' : '#6366f1',
                        color: isItemSpeaking ? '#fca5a5' : '#ffffff',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {isItemSpeaking ? <Pause size={12} /> : <Volume2 size={12} />}
                      <span>{isItemSpeaking ? 'Pausar TTS' : 'Ler em Voz Alta'}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Gerando resposta / Streaming do Item Atual no final da lista */}
            {(isStreaming || (question && !allSuggestions.some(s => s.question === question.questionText))) && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}
              >
                {question && (
                  <div
                    style={{
                      marginBottom: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px'
                    }}
                  >
                    <HelpCircle size={15} color="#f59e0b" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        PERGUNTA #{allSuggestions.length + 1} DETECTADA
                      </div>
                      <div style={{ fontSize: '13px', color: '#fef3c7', fontWeight: 500 }}>{question.questionText}</div>
                    </div>
                  </div>
                )}

                {isStreaming && (
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      GERANDO RESPOSTA...
                    </div>
                    <div style={{ fontSize: '14px', color: '#f8fafc', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {streamingContent || 'Preparando a melhor sugestão...'}
                      <span className="copilot-cursor">▍</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Elemento de referência para auto-scroll */}
            <div ref={listEndRef} />
          </div>
        )}

        {!isMinimized && (
          <span
            onPointerDown={handleResizeStart}
            title="Redimensionar painel"
            aria-label="Redimensionar painel"
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
