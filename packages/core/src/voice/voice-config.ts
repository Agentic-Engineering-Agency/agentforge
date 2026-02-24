/**
 * Voice configuration types for AgentForge voice tools.
 */

export interface VoiceConfig {
  /** ElevenLabs voice ID */
  voiceId?: string;
  /** Speech speed multiplier (0.5–2.0). Default: 1.0 */
  speed?: number;
  /** TTS model ID (e.g., 'eleven_multilingual_v2'). Default: 'eleven_multilingual_v2' */
  model?: string;
  /** Voice provider. Default: 'elevenlabs' */
  provider?: 'elevenlabs';
  /** Language code (e.g., 'en', 'es'). Default: 'en' */
  language?: string;
}

export const DEFAULT_VOICE_CONFIG: Required<VoiceConfig> = {
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  speed: 1.0,
  model: 'eleven_multilingual_v2',
  provider: 'elevenlabs',
  language: 'en',
};

/** Maximum text length for TTS input (ElevenLabs limit) */
export const MAX_TTS_TEXT_LENGTH = 5000;

/** Maximum audio file size for STT (OpenAI Whisper limit: 25MB) */
export const MAX_STT_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Sanitize text input for TTS.
 * Strips control characters and trims whitespace.
 * Throws if text exceeds maximum length.
 */
export function sanitizeTtsText(text: string): string {
  if (!text || typeof text !== 'string') {
    throw new Error('TTS text must be a non-empty string');
  }

  // Strip control characters (except newline, tab)
  const sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

  if (sanitized.length === 0) {
    throw new Error('TTS text is empty after sanitization');
  }

  if (sanitized.length > MAX_TTS_TEXT_LENGTH) {
    throw new Error(
      `TTS text exceeds maximum length of ${MAX_TTS_TEXT_LENGTH} characters (got ${sanitized.length})`
    );
  }

  return sanitized;
}
