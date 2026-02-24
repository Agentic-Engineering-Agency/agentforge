/**
 * Mastra Voice Tool for AgentForge.
 *
 * Wraps ElevenLabs TTS and OpenAI Whisper STT as a Mastra-compatible tool.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { textToSpeech } from './tts-client.js';
import { speechToText } from './stt-client.js';
import type { VoiceConfig } from './voice-config.js';

/**
 * Create a Mastra voice tool that provides TTS and STT capabilities.
 *
 * @param defaultConfig - Default voice configuration for TTS
 * @returns A Mastra tool with text-to-speech and speech-to-text actions
 *
 * @example
 * ```typescript
 * import { createVoiceTool } from '@agentforge-ai/tools-voice';
 *
 * const voiceTool = createVoiceTool({ voiceId: 'custom-voice-id' });
 * // Register with Mastra agent
 * ```
 */
export function createVoiceTool(defaultConfig?: Partial<VoiceConfig>) {
  return createTool({
    id: 'agentforge-voice',
    description:
      'Voice capabilities: convert text to speech (TTS) using ElevenLabs, ' +
      'or transcribe speech to text (STT) using OpenAI Whisper.',
    inputSchema: z.object({
      action: z.enum(['text-to-speech', 'speech-to-text']).describe(
        'The voice action to perform'
      ),
      text: z.string().optional().describe(
        'Text to convert to speech (required for text-to-speech action)'
      ),
      audioBase64: z.string().optional().describe(
        'Base64-encoded audio data (required for speech-to-text action)'
      ),
      fileName: z.string().optional().describe(
        'Audio file name with extension for STT (e.g., "audio.ogg")'
      ),
      language: z.string().optional().describe(
        'Language code (e.g., "en", "es"). Used for both TTS language and STT hint.'
      ),
      voiceId: z.string().optional().describe(
        'ElevenLabs voice ID override'
      ),
      speed: z.number().min(0.5).max(2.0).optional().describe(
        'Speech speed multiplier (0.5–2.0)'
      ),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      action: z.string(),
      text: z.string().optional(),
      audioBase64: z.string().optional(),
      contentType: z.string().optional(),
      characterCount: z.number().optional(),
      error: z.string().optional(),
    }),
    execute: async (inputData) => {
      try {
        if (inputData.action === 'text-to-speech') {
          if (!inputData.text) {
            return {
              success: false,
              action: 'text-to-speech',
              error: 'Text is required for text-to-speech action',
            };
          }

          const result = await textToSpeech({
            text: inputData.text,
            config: {
              ...defaultConfig,
              ...(inputData.voiceId ? { voiceId: inputData.voiceId } : {}),
              ...(inputData.speed ? { speed: inputData.speed } : {}),
              ...(inputData.language ? { language: inputData.language } : {}),
            },
          });

          // Convert ArrayBuffer to base64 (Web Crypto-compatible, no Buffer)
          const bytes = new Uint8Array(result.audio);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]!);
          }
          const audioBase64 = btoa(binary);

          return {
            success: true,
            action: 'text-to-speech',
            audioBase64,
            contentType: result.contentType,
            characterCount: result.characterCount,
          };
        }

        if (inputData.action === 'speech-to-text') {
          if (!inputData.audioBase64) {
            return {
              success: false,
              action: 'speech-to-text',
              error: 'audioBase64 is required for speech-to-text action',
            };
          }

          // Decode base64 to Uint8Array (cross-platform — no Buffer)
          const binaryString = atob(inputData.audioBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const result = await speechToText({
            audio: bytes,
            fileName: inputData.fileName,
            language: inputData.language,
          });

          return {
            success: true,
            action: 'speech-to-text',
            text: result.text,
          };
        }

        return {
          success: false,
          action: inputData.action,
          error: `Unknown action: ${inputData.action}`,
        };
      } catch (error) {
        return {
          success: false,
          action: inputData.action,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}
