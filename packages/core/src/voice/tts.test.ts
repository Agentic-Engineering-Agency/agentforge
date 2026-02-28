import { describe, it, expect, vi } from 'vitest'
import { ElevenLabsTTS, WebSpeechTTS, createTTSEngine } from './tts.js'

describe('ElevenLabsTTS', () => {
  it('instantiates with API key', () => {
    const tts = new ElevenLabsTTS({ apiKey: 'test-key' })
    expect(tts).toBeTruthy()
  })

  it('has synthesize method', () => {
    const tts = new ElevenLabsTTS({ apiKey: 'test' })
    expect(typeof tts.synthesize).toBe('function')
  })

  it('synthesize calls ElevenLabs API', async () => {
    const tts = new ElevenLabsTTS({ apiKey: 'test' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
      headers: { get: () => 'audio/mpeg' }
    }) as any
    const result = await tts.synthesize('Hello world')
    expect(result).toBeInstanceOf(Buffer)
  })

  it('uses custom voiceId when provided', async () => {
    const tts = new ElevenLabsTTS({ apiKey: 'test', voiceId: 'custom-voice-123' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
      headers: { get: () => 'audio/mpeg' }
    }) as any
    await tts.synthesize('Test')
    expect(global.fetch).toHaveBeenCalled()
    const callArgs = (global.fetch as any).mock.calls[0]
    expect(callArgs[0]).toContain('custom-voice-123')
  })
})

describe('WebSpeechTTS', () => {
  it('instantiates without API key', () => {
    const tts = new WebSpeechTTS()
    expect(tts).toBeTruthy()
  })

  it('has synthesize method that returns browser script', () => {
    const tts = new WebSpeechTTS()
    const result = tts.synthesize('Hello world')
    expect(typeof result).toBe('string')
    expect(result).toContain('speechSynthesis')
    expect(result).toContain('Hello world')
  })

  it('marks itself as browser-only', () => {
    const tts = new WebSpeechTTS()
    expect(tts.isBrowserOnly).toBe(true)
  })
})

describe('createTTSEngine', () => {
  it('returns ElevenLabsTTS when apiKey provided', () => {
    const engine = createTTSEngine({ provider: 'elevenlabs', apiKey: 'key' })
    expect(engine).toBeInstanceOf(ElevenLabsTTS)
  })

  it('returns WebSpeechTTS when provider is webspeech', () => {
    const engine = createTTSEngine({ provider: 'webspeech' })
    expect(engine).toBeInstanceOf(WebSpeechTTS)
  })

  it('returns WebSpeechTTS by default when no apiKey', () => {
    const engine = createTTSEngine({})
    expect(engine).toBeInstanceOf(WebSpeechTTS)
  })
})
