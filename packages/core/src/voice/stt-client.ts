/**
 * OpenAI Whisper STT Client for AgentForge.
 *
 * Sends audio data to the OpenAI Whisper transcription API.
 * API Reference: https://platform.openai.com/docs/guides/speech-to-text
 */

import { MAX_STT_FILE_SIZE } from './voice-config.js';

const OPENAI_API_BASE = 'https://api.openai.com/v1';

export interface SttRequest {
  /** Audio data as ArrayBuffer or Uint8Array (cross-platform; no Node.js Buffer) */
  audio: ArrayBuffer | Uint8Array;
  /** Audio file name with extension (used for MIME type detection). Default: 'audio.ogg' */
  fileName?: string;
  /** Language hint (ISO-639-1 code). Optional. */
  language?: string;
  /** Whisper model to use. Default: 'whisper-1' */
  model?: string;
}

export interface SttResponse {
  /** Transcribed text */
  text: string;
  /** Language detected or used */
  language?: string;
}

/**
 * Transcribe audio to text using the OpenAI Whisper API.
 *
 * @throws Error if OPENAI_API_KEY is not set
 * @throws Error if the API request fails
 * @throws Error if audio exceeds size limit
 */
export async function speechToText(request: SttRequest): Promise<SttResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required for STT. ' +
      'Get your key at https://platform.openai.com'
    );
  }

  // Normalize to a plain ArrayBuffer (cross-platform — no SharedArrayBuffer, no Node Buffer)
  const audioBuffer: ArrayBuffer = (() => {
    if (request.audio instanceof ArrayBuffer) return request.audio;
    const copy = new ArrayBuffer(request.audio.byteLength);
    new Uint8Array(copy).set(request.audio);
    return copy;
  })();

  if (audioBuffer.byteLength > MAX_STT_FILE_SIZE) {
    throw new Error(
      `Audio file exceeds maximum size of ${MAX_STT_FILE_SIZE / (1024 * 1024)}MB ` +
      `(got ${(audioBuffer.byteLength / (1024 * 1024)).toFixed(1)}MB)`
    );
  }

  if (audioBuffer.byteLength === 0) {
    throw new Error('Audio data is empty');
  }

  const fileName = request.fileName || 'audio.ogg';
  const model = request.model || 'whisper-1';

  // Build multipart form data
  const blob = new Blob([audioBuffer], { type: getMimeType(fileName) });
  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('model', model);

  if (request.language) {
    formData.append('language', request.language);
  }

  const response = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `OpenAI Whisper STT API error (${response.status}): ${errorText}`
    );
  }

  const result = await response.json() as { text: string; language?: string };

  return {
    text: result.text,
    language: result.language ?? request.language,
  };
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    mpeg: 'audio/mpeg',
    mpga: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    flac: 'audio/flac',
  };
  return mimeMap[ext || ''] || 'audio/ogg';
}
