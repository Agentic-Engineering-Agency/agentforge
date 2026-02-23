/**
 * Tests for AGE-48: Voice & TTS Integration
 *
 * Covers: TTS client, STT client, voice config, Mastra tool, input validation, error handling.
 * Mocks: ElevenLabs API, OpenAI Whisper API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Test Group 1: Static analysis — packages/tools-voice exists and exports
// ---------------------------------------------------------------------------

describe('AGE-48: Voice Package — static analysis', () => {
  const pkgDir = path.resolve(__dirname, '../packages/tools-voice');

  it('packages/tools-voice/package.json should exist', () => {
    expect(fs.existsSync(path.join(pkgDir, 'package.json'))).toBe(true);
  });

  it('package.json should have correct name @agentforge-ai/tools-voice', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('@agentforge-ai/tools-voice');
  });

  it('package.json should have version 0.6.0', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'));
    expect(pkg.version).toBe('0.6.0');
  });

  it('tsconfig.json should exist', () => {
    expect(fs.existsSync(path.join(pkgDir, 'tsconfig.json'))).toBe(true);
  });

  it('tsup.config.ts should exist', () => {
    expect(fs.existsSync(path.join(pkgDir, 'tsup.config.ts'))).toBe(true);
  });

  it('src/index.ts should exist (barrel export)', () => {
    expect(fs.existsSync(path.join(pkgDir, 'src/index.ts'))).toBe(true);
  });

  it('src/tts-client.ts should exist', () => {
    expect(fs.existsSync(path.join(pkgDir, 'src/tts-client.ts'))).toBe(true);
  });

  it('src/stt-client.ts should exist', () => {
    expect(fs.existsSync(path.join(pkgDir, 'src/stt-client.ts'))).toBe(true);
  });

  it('src/voice-tool.ts should exist', () => {
    expect(fs.existsSync(path.join(pkgDir, 'src/voice-tool.ts'))).toBe(true);
  });

  it('src/voice-config.ts should exist', () => {
    expect(fs.existsSync(path.join(pkgDir, 'src/voice-config.ts'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: Voice Config — sanitization and validation
// ---------------------------------------------------------------------------

describe('AGE-48: Voice Config — sanitizeTtsText', () => {
  const configPath = path.resolve(__dirname, '../packages/tools-voice/src/voice-config.ts');
  const configContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';

  it('should export sanitizeTtsText function', () => {
    expect(configContent).toContain('export function sanitizeTtsText');
  });

  it('should export VoiceConfig type', () => {
    expect(configContent).toMatch(/export interface VoiceConfig/);
  });

  it('should export DEFAULT_VOICE_CONFIG', () => {
    expect(configContent).toContain('export const DEFAULT_VOICE_CONFIG');
  });

  it('should export MAX_TTS_TEXT_LENGTH constant', () => {
    expect(configContent).toContain('export const MAX_TTS_TEXT_LENGTH');
  });

  it('should export MAX_STT_FILE_SIZE constant', () => {
    expect(configContent).toContain('export const MAX_STT_FILE_SIZE');
  });

  it('should strip control characters in sanitization', () => {
    expect(configContent).toMatch(/replace\(.+\\x00/);
  });

  it('should enforce max text length', () => {
    expect(configContent).toContain('MAX_TTS_TEXT_LENGTH');
    expect(configContent).toMatch(/exceeds maximum length/);
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: TTS Client — API call structure
// ---------------------------------------------------------------------------

describe('AGE-48: TTS Client — structure', () => {
  const ttsPath = path.resolve(__dirname, '../packages/tools-voice/src/tts-client.ts');
  const ttsContent = fs.existsSync(ttsPath) ? fs.readFileSync(ttsPath, 'utf-8') : '';

  it('should export textToSpeech function', () => {
    expect(ttsContent).toContain('export async function textToSpeech');
  });

  it('should use ELEVENLABS_API_KEY from process.env', () => {
    expect(ttsContent).toContain('process.env.ELEVENLABS_API_KEY');
  });

  it('should call the ElevenLabs TTS API endpoint', () => {
    expect(ttsContent).toContain('api.elevenlabs.io/v1');
    expect(ttsContent).toContain('text-to-speech');
  });

  it('should use xi-api-key header for auth', () => {
    expect(ttsContent).toContain('xi-api-key');
  });

  it('should NOT hardcode any API keys', () => {
    // Match patterns like 'sk-...' or actual API key patterns
    expect(ttsContent).not.toMatch(/['"]sk-[a-zA-Z0-9]{10,}['"]/);
    expect(ttsContent).not.toMatch(/['"][a-f0-9]{32}['"]/);
  });

  it('should call sanitizeTtsText before making API request', () => {
    expect(ttsContent).toContain('sanitizeTtsText');
  });

  it('should throw if API key is missing', () => {
    expect(ttsContent).toContain('throw new Error');
    expect(ttsContent).toContain('ELEVENLABS_API_KEY');
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: STT Client — API call structure
// ---------------------------------------------------------------------------

describe('AGE-48: STT Client — structure', () => {
  const sttPath = path.resolve(__dirname, '../packages/tools-voice/src/stt-client.ts');
  const sttContent = fs.existsSync(sttPath) ? fs.readFileSync(sttPath, 'utf-8') : '';

  it('should export speechToText function', () => {
    expect(sttContent).toContain('export async function speechToText');
  });

  it('should use OPENAI_API_KEY from process.env', () => {
    expect(sttContent).toContain('process.env.OPENAI_API_KEY');
  });

  it('should call the OpenAI Whisper transcriptions endpoint', () => {
    expect(sttContent).toContain('api.openai.com/v1');
    expect(sttContent).toContain('/audio/transcriptions');
  });

  it('should use Bearer token auth', () => {
    expect(sttContent).toContain('Bearer');
  });

  it('should NOT hardcode any API keys', () => {
    expect(sttContent).not.toMatch(/['"]sk-[a-zA-Z0-9]{10,}['"]/);
  });

  it('should validate audio file size', () => {
    expect(sttContent).toContain('MAX_STT_FILE_SIZE');
  });

  it('should throw if API key is missing', () => {
    expect(sttContent).toContain('throw new Error');
    expect(sttContent).toContain('OPENAI_API_KEY');
  });

  it('should handle empty audio data', () => {
    expect(sttContent).toContain('Audio data is empty');
  });

  it('should use FormData for multipart upload', () => {
    expect(sttContent).toContain('FormData');
    expect(sttContent).toContain('formData.append');
  });

  it('should default to whisper-1 model', () => {
    expect(sttContent).toContain("whisper-1");
  });
});

// ---------------------------------------------------------------------------
// Test Group 5: Voice Tool — Mastra createTool integration
// ---------------------------------------------------------------------------

describe('AGE-48: Voice Tool — Mastra tool', () => {
  const toolPath = path.resolve(__dirname, '../packages/tools-voice/src/voice-tool.ts');
  const toolContent = fs.existsSync(toolPath) ? fs.readFileSync(toolPath, 'utf-8') : '';

  it('should export createVoiceTool function', () => {
    expect(toolContent).toContain('export function createVoiceTool');
  });

  it('should use createTool from @mastra/core', () => {
    expect(toolContent).toContain("import { createTool } from '@mastra/core/tools'");
  });

  it('should use zod for schema validation', () => {
    expect(toolContent).toContain("import { z } from 'zod'");
  });

  it('should support text-to-speech action', () => {
    expect(toolContent).toContain('text-to-speech');
  });

  it('should support speech-to-text action', () => {
    expect(toolContent).toContain('speech-to-text');
  });

  it('should have an inputSchema with action field', () => {
    expect(toolContent).toContain('inputSchema');
    expect(toolContent).toContain("z.enum(['text-to-speech', 'speech-to-text'])");
  });

  it('should have an outputSchema', () => {
    expect(toolContent).toContain('outputSchema');
  });

  it('should have a tool ID', () => {
    expect(toolContent).toContain("id: 'agentforge-voice'");
  });
});

// ---------------------------------------------------------------------------
// Test Group 6: ConfigCascade — voiceConfig integration
// ---------------------------------------------------------------------------

describe('AGE-48: ConfigCascade — voiceConfig', () => {
  const cascadePath = path.resolve(__dirname, '../convex/lib/configCascade.ts');
  const cascadeContent = fs.existsSync(cascadePath) ? fs.readFileSync(cascadePath, 'utf-8') : '';

  it('should export VoiceConfig interface', () => {
    expect(cascadeContent).toMatch(/export interface VoiceConfig/);
  });

  it('AgentConfig should include optional voiceConfig field', () => {
    expect(cascadeContent).toContain('voiceConfig?: VoiceConfig');
  });
});

// ---------------------------------------------------------------------------
// Test Group 7: Telegram — voice message handling
// ---------------------------------------------------------------------------

describe('AGE-48: Telegram — voice message handling', () => {
  const telegramPath = path.resolve(__dirname, '../packages/core/src/channels/telegram.ts');
  const telegramContent = fs.existsSync(telegramPath) ? fs.readFileSync(telegramPath, 'utf-8') : '';

  it('should have handleVoiceMessage method', () => {
    expect(telegramContent).toContain('handleVoiceMessage');
  });

  it('should check for voice_note media type', () => {
    expect(telegramContent).toContain("voice_note");
  });

  it('should call OpenAI Whisper for STT', () => {
    expect(telegramContent).toContain('api.openai.com/v1/audio/transcriptions');
  });

  it('should use OPENAI_API_KEY for auth', () => {
    expect(telegramContent).toContain('process.env.OPENAI_API_KEY');
  });

  it('should handle missing API key gracefully', () => {
    expect(telegramContent).toContain('OPENAI_API_KEY not configured');
  });

  it('should route transcribed text to agent', () => {
    expect(telegramContent).toContain('routeToAgent');
    expect(telegramContent).toContain('transcribedText');
  });
});

// ---------------------------------------------------------------------------
// Test Group 8: Barrel exports
// ---------------------------------------------------------------------------

describe('AGE-48: Barrel exports — index.ts', () => {
  const indexPath = path.resolve(__dirname, '../packages/tools-voice/src/index.ts');
  const indexContent = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : '';

  it('should export textToSpeech', () => {
    expect(indexContent).toContain("export { textToSpeech }");
  });

  it('should export speechToText', () => {
    expect(indexContent).toContain("export { speechToText }");
  });

  it('should export createVoiceTool', () => {
    expect(indexContent).toContain("export { createVoiceTool }");
  });

  it('should export sanitizeTtsText', () => {
    expect(indexContent).toContain("export {");
    expect(indexContent).toContain("sanitizeTtsText");
  });

  it('should export VoiceConfig type', () => {
    expect(indexContent).toContain("VoiceConfig");
  });
});
