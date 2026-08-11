import { MeetingMode } from '@conversation-copilot/shared-types';

const VALID_MODES: readonly MeetingMode[] = ['technical_interview', 'system_design', 'code_review', 'general'];

/**
 * Normaliza qualquer valor armazenado de MeetingMode para um modo válido.
 * Modos legados (ex: transcription_only) são consolidados em 'general'.
 */
export function normalizeMeetingMode(value: string | null | undefined): MeetingMode {
  if (value === 'transcription_only') {
    return 'general';
  }
  return VALID_MODES.includes(value as MeetingMode) ? (value as MeetingMode) : 'technical_interview';
}
