"use node";

/**
 * TTS (Text-to-Speech) Engine for AgentForge
 *
 * Provides TTS functionality using direct API integrations.
 * Currently supports ElevenLabs API.
 */

export interface TTSEngineConfig {
  apiKey: string;
  voiceId?: string;
  model?: string;
}

export interface TTSResult {
  audioBuffer: ArrayBuffer;
  contentType: string;
}

/**
 * ElevenLabs TTS implementation.
 */
export class ElevenLabsTTS {
  private readonly apiKey: string;
  private readonly voiceId: string;
  private readonly model: string;
  private readonly baseUrl = "https://api.elevenlabs.io";

  constructor(config: TTSEngineConfig) {
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default "Rachel" voice
    this.model = config.model || "eleven_multilingual_v2";
  }

  /**
   * Synthesize speech from text.
   */
  async synthesize(text: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/v1/text-to-speech/${this.voiceId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: this.model,
        output_format: "mp3_22050_32",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.arrayBuffer();
  }

  /**
   * Get available voices.
   */
  async getVoices(): Promise<Array<{ voice_id: string; name: string }>> {
    const url = `${this.baseUrl}/v1/voices`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "xi-api-key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices || [];
  }
}

/**
 * Create a TTS engine based on the provider.
 */
export async function createTTSEngine(config: { provider: string; apiKey: string; voiceId?: string }): Promise<{
  synthesize: (text: string) => Promise<ArrayBuffer>;
}> {
  switch (config.provider) {
    case "elevenlabs":
      const tts = new ElevenLabsTTS({
        apiKey: config.apiKey,
        voiceId: config.voiceId,
      });
      return {
        synthesize: (text) => tts.synthesize(text),
      };
    default:
      throw new Error(`Unsupported TTS provider: ${config.provider}`);
  }
}
