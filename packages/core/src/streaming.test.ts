import { describe, it, expect } from 'vitest'
import { SSEStreamParser } from './streaming.js'

describe('SSEStreamParser', () => {
  it('parses SSE text/event-stream data lines', () => {
    const parser = new SSEStreamParser()
    const chunks: string[] = []
    parser.onChunk = (text) => chunks.push(text)
    parser.feed('data: {"type":"text-delta","textDelta":"Hello"}\n\n')
    expect(chunks).toEqual(['Hello'])
  })

  it('handles done event', () => {
    const parser = new SSEStreamParser()
    let done = false
    parser.onDone = () => { done = true }
    parser.feed('data: [DONE]\n\n')
    expect(done).toBe(true)
  })

  it('handles multi-chunk messages', () => {
    const parser = new SSEStreamParser()
    const chunks: string[] = []
    parser.onChunk = (text) => chunks.push(text)
    parser.feed('data: {"type":"text-delta","textDelta":"He"}\n\n')
    parser.feed('data: {"type":"text-delta","textDelta":"llo"}\n\n')
    expect(chunks).toEqual(['He', 'llo'])
  })

  it('handles error events', () => {
    const parser = new SSEStreamParser()
    let caughtError: Error | null = null
    parser.onError = (err) => { caughtError = err }
    parser.feed('data: {"type":"error","error":"Test error"}\n\n')
    expect(caughtError).toBeTruthy()
    expect(caughtError!.message).toBe('Test error')
  })

  it('handles partial data lines', () => {
    const parser = new SSEStreamParser()
    const chunks: string[] = []
    parser.onChunk = (text) => chunks.push(text)
    // Feed partial line
    parser.feed('data: {"type":"text-delta","textDelta":"Hel')
    parser.feed('lo"}\n\n')
    expect(chunks).toEqual(['Hello'])
  })

  it('ignores non-data SSE lines', () => {
    const parser = new SSEStreamParser()
    const chunks: string[] = []
    parser.onChunk = (text) => chunks.push(text)
    parser.feed('event: message\n')
    parser.feed('id: 123\n')
    parser.feed('retry: 1000\n')
    parser.feed('data: {"type":"text-delta","textDelta":"Hi"}\n\n')
    expect(chunks).toEqual(['Hi'])
  })

  it('handles empty data lines', () => {
    const parser = new SSEStreamParser()
    const chunks: string[] = []
    parser.onChunk = (text) => chunks.push(text)
    parser.feed('data: \n\n')
    expect(chunks).toEqual([])
  })
})
