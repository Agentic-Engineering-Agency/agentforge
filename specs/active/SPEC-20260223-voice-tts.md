# SPEC-20260223-voice-tts: Voice & TTS Integration (AGE-48)

## Summary
Add ElevenLabs TTS and OpenAI Whisper STT as a new `@agentforge-ai/tools-voice` package, exposable as a Mastra tool for agents.

## Requirements

### TTS (Text-to-Speech)
- POST to `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with JSON body
- Support configurable voice ID, model, speed, language
- Return audio buffer (mp3/wav)
- API key from `process.env.ELEVENLABS_API_KEY`
- Input validation: sanitize text (max 5000 chars, strip control characters)

### STT (Speech-to-Text)
- POST to `https://api.openai.com/v1/audio/transcriptions` with multipart/form-data
- Support audio file (Buffer) + optional language hint
- Return transcription text
- API key from `process.env.OPENAI_API_KEY`
- Model: `whisper-1`

### Mastra Tool Registration
- `createVoiceTool()` returns a Mastra `createTool` compatible tool
- Two actions: `text-to-speech` and `speech-to-text`
- Zod input/output schemas
- Error handling: throw descriptive errors for missing API keys, API failures

### Voice Config
- `VoiceConfig` type: `{ voiceId, speed, model, provider, language }`
- Optional field on `AgentConfig` in `convex/lib/configCascade.ts`

### Telegram Integration
- When inbound message has voice_note media, download audio → STT → process as text
- Graceful fallback: if STT fails, inform user

### Security
- No hardcoded API keys
- Sanitize TTS input text (prevent injection via control chars)
- Validate audio buffer size for STT (max 25MB per OpenAI limit)

## Acceptance Criteria
- [x] TTS client sends correct request to ElevenLabs API
- [x] STT client sends correct multipart request to Whisper API
- [x] Mastra tool wraps both TTS + STT with proper schemas
- [x] VoiceConfig added to AgentConfig cascade
- [x] Telegram channel handles voice notes via STT
- [x] All API keys sourced from environment variables
- [x] Input validation on TTS text
- [x] ≥15 tests passing
