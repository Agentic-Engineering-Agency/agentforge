/**
 * @agentforge-ai/tools-voice
 *
 * Voice tools for AgentForge agents — ElevenLabs TTS + OpenAI Whisper STT.
 *
 * @packageDocumentation
 */

export { textToSpeech } from './tts-client.js';
export type { TtsRequest, TtsResponse } from './tts-client.js';

export { speechToText } from './stt-client.js';
export type { SttRequest, SttResponse } from './stt-client.js';

export { createVoiceTool } from './voice-tool.js';

export {
  sanitizeTtsText,
  DEFAULT_VOICE_CONFIG,
  MAX_TTS_TEXT_LENGTH,
  MAX_STT_FILE_SIZE,
} from './voice-config.js';
export type { VoiceConfig } from './voice-config.js';
