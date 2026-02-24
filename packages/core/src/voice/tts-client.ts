/**
 * ElevenLabs TTS Client for AgentForge.
 *
 * Sends text to the ElevenLabs text-to-speech API and returns audio data.
 * API Reference: https://elevenlabs.io/docs/api-reference/text-to-speech
 */

import { DEFAULT_VOICE_CONFIG, sanitizeTtsText } from './voice-config.js';
import type { VoiceConfig } from './voice-config.js';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

export interface TtsRequest {
  /** Text to convert to speech */
  text: string;
  /** Voice configuration overrides */
  config?: Partial<VoiceConfig>;
}

export interface TtsResponse {
  /** Audio data as ArrayBuffer */
  audio: ArrayBuffer;
  /** Content type of the audio (e.g., 'audio/mpeg') */
  contentType: string;
  /** Character count of the input text */
  characterCount: number;
}

/**
 * Convert text to speech using the ElevenLabs API.
 *
 * @throws Error if ELEVENLABS_API_KEY is not set
 * @throws Error if the API request fails
 * @throws Error if text validation fails
 */
export async function textToSpeech(request: TtsRequest): Promise<TtsResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY environment variable is required for TTS. ' +
      'Get your key at https://elevenlabs.io'
    );
  }

  const sanitizedText = sanitizeTtsText(request.text);

  const config = {
    voiceId: request.config?.voiceId ?? DEFAULT_VOICE_CONFIG.voiceId,
    model: request.config?.model ?? DEFAULT_VOICE_CONFIG.model,
    speed: request.config?.speed ?? DEFAULT_VOICE_CONFIG.speed,
    language: request.config?.language ?? DEFAULT_VOICE_CONFIG.language,
  };

  const url = `${ELEVENLABS_API_BASE}/text-to-speech/${config.voiceId}`;

  const body = {
    text: sanitizedText,
    model_id: config.model,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      speed: config.speed,
    },
    ...(config.language !== 'en' ? { language_code: config.language } : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `ElevenLabs TTS API error (${response.status}): ${errorText}`
    );
  }

  const audio = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'audio/mpeg';

  return {
    audio,
    contentType,
    characterCount: sanitizedText.length,
  };
}
