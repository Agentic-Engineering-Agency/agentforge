import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, success, error, info, dim, colors } from '../lib/display.js';
import { ElevenLabsTTS, createTTSEngine } from '@agentforge-ai/core';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const MAX_TEXT_LENGTH = 5000;

function validateText(text: string | undefined): { valid: boolean; error?: string } {
  if (!text) return { valid: false, error: 'Text is required' };
  const trimmed = text.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Text cannot be empty' };
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` };
  }
  return { valid: true };
}

export function registerVoiceCommand(program: Command) {
  const voiceCmd = program
    .command('voice')
    .description('Voice synthesis commands');

  voiceCmd
    .command('say')
    .argument('<text>', 'Text to synthesize to speech')
    .option('-v, --voice <voiceId>', 'ElevenLabs voice ID (default: 21m00Tcm4TlvDq8ikWAM)')
    .option('-o, --output <file>', 'Output MP3 file path (default: speech-<timestamp>.mp3)')
    .option('--provider <provider>', 'TTS provider (elevenlabs, webspeech)', 'elevenlabs')
    .description('Synthesize text to speech')
    .action(async (text, opts) => {
      const validation = validateText(text);
      if (!validation.valid) {
        error(validation.error!);
        process.exit(1);
      }

      header('Voice Synthesis');

      if (opts.provider === 'webspeech') {
        info('Using Web Speech API (browser-only)');
        const engine = createTTSEngine({ provider: 'webspeech' });
        const result = engine.synthesize(text);
        console.log(result);
        success('Generated browser script. Include in HTML to play.');
        return;
      }

      // ElevenLabs provider
      const client = await createClient();

      // Get API key from Convex
      const apiKeyData = await safeCall(
        () => client.query('apiKeys:getDecryptedForProvider' as any, { provider: 'elevenlabs' }),
        'Failed to fetch ElevenLabs API key'
      );

      if (!apiKeyData || !apiKeyData.apiKey) {
        error('ElevenLabs API key not configured');
        info('Add it with: agentforge keys add elevenlabs');
        process.exit(1);
      }

      const outputFile = opts.output
        ? resolve(opts.output)
        : resolve(`speech-${Date.now()}.mp3`);

      dim(`Provider: ElevenLabs`);
      dim(`Voice: ${opts.voice || '21m00Tcm4TlvDq8ikWAM (default)'}`);
      dim(`Text: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
      console.log();

      try {
        const tts = new ElevenLabsTTS({
          apiKey: apiKeyData.apiKey,
          voiceId: opts.voice,
        });

        info('Synthesizing speech...');
        const audioBuffer = await tts.synthesize(text);

        await writeFile(outputFile, audioBuffer);
        success(`Saved audio to: ${colors.cyan}${outputFile}${colors.reset}`);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        error(`Synthesis failed: ${errMsg}`);
        process.exit(1);
      }
    });

  voiceCmd
    .command('list-voices')
    .description('List available ElevenLabs voices')
    .action(async () => {
      header('Available ElevenLabs Voices');
      info('Common voice IDs:');
      console.log();
      console.log(`  ${colors.cyan}21m00Tcm4TlvDq8ikWAM${colors.reset}  - Rachel (Default)`);
      console.log(`  ${colors.cyan}AZnzlk1XvdvUeBnXmlld${colors.reset}  - Dom`);
      console.log(`  ${colors.cyan}EXAVITQu4vr4xnSDxMaL${colors.reset}  - Bella`);
      console.log(`  ${colors.cyan}ErXwobaYi8WM5FbVDYjL${colors.reset}  - Elli`);
      console.log(`  ${colors.cyan}MF3mGyEYCl7XYWbV9V6O${colors.reset}  - Josh`);
      console.log();
      dim('Browse more voices at: https://elevenlabs.io/voice-library');
    });
}
