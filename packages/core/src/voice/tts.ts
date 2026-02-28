/**
 * TTS Engine Classes — ElevenLabs API and Web Speech API.
 * Class-based abstraction for text-to-speech synthesis.
 */

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export interface TTSEngineConfig {
  provider?: 'elevenlabs' | 'webspeech';
  apiKey?: string;
  voiceId?: string;
}

export interface TTSEngine {
  synthesize(text: string, options?: { voiceId?: string }): Promise<Buffer> | string;
  isBrowserOnly?: boolean;
}

/**
 * ElevenLabs TTS Engine — server-side, high-quality synthesis.
 */
export class ElevenLabsTTS implements TTSEngine {
  private readonly apiKey: string;
  private readonly defaultVoiceId: string;

  constructor(config: { apiKey: string; voiceId?: string }) {
    this.apiKey = config.apiKey;
    this.defaultVoiceId = config.voiceId ?? DEFAULT_VOICE_ID;
  }

  /**
   * Synthesize speech using ElevenLabs API.
   * @returns Buffer containing MP3 audio data
   */
  async synthesize(text: string, options?: { voiceId?: string }): Promise<Buffer> {
    const voiceId = options?.voiceId ?? this.defaultVoiceId;

    const url = `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: 1.0,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `ElevenLabs TTS API error (${response.status}): ${errorText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

/**
 * Web Speech API TTS Engine — browser-only, free synthesis.
 * Returns HTML script tag for client-side execution.
 */
export class WebSpeechTTS implements TTSEngine {
  readonly isBrowserOnly = true;

  /**
   * Generate browser script for Web Speech API synthesis.
   * @returns HTML string containing script tag
   */
  synthesize(text: string): string {
    const escapedText = JSON.stringify(text);
    return `<script>
(function() {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(${escapedText});
    speechSynthesis.speak(utterance);
  } else {
    console.error('Web Speech API not supported in this browser');
  }
})();
</script>`;
  }
}

/**
 * Factory function to create appropriate TTS engine.
 */
export function createTTSEngine(config: TTSEngineConfig): TTSEngine {
  if (config.provider === 'webspeech') {
    return new WebSpeechTTS();
  }

  if (config.apiKey) {
    return new ElevenLabsTTS({
      apiKey: config.apiKey,
      voiceId: config.voiceId,
    });
  }

  // Default to WebSpeech for browser/fallback
  return new WebSpeechTTS();
}
