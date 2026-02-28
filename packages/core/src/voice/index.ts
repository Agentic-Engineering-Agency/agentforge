/**
 * Voice tools for AgentForge — ElevenLabs TTS + OpenAI Whisper STT.
 * Previously @agentforge-ai/tools-voice (merged into core).
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

// TTS Engine Classes
export { ElevenLabsTTS, WebSpeechTTS, createTTSEngine } from './tts.js';
export type { TTSEngine, TTSEngineConfig } from './tts.js';
