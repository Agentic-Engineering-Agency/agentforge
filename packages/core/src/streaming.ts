/**
 * Server-Sent Events (SSE) Stream Parser
 *
 * Parses SSE text/event-stream data and emits callbacks for:
 * - text chunks (type: "text-delta")
 * - completion (data: [DONE])
 * - errors (type: "error")
 */

export interface SSEChunk {
  type: 'text-delta' | 'error' | 'done' | 'metadata'
  textDelta?: string
  error?: string
  [key: string]: unknown
}

/**
 * Parser for SSE text/event-stream responses.
 * Call feed() with chunks of data as they arrive.
 */
export class SSEStreamParser {
  private buffer = ''
  onChunk?: (text: string) => void
  onDone?: () => void
  onError?: (err: Error) => void

  /**
   * Feed a chunk of data to the parser.
   * Can be called multiple times as data arrives.
   */
  feed(chunk: string): void {
    this.buffer += chunk
    this.processBuffer()
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n')
    // Keep the last line in buffer if it doesn't end with newline
    const lastLine = lines[lines.length - 1]
    if (!this.buffer.endsWith('\n')) {
      this.buffer = lastLine
    } else {
      this.buffer = ''
    }

    let currentData = ''

    for (let i = 0; i < lines.length - (this.buffer ? 1 : 0); i++) {
      const line = lines[i]!

      // Skip comments
      if (line.startsWith(':')) continue

      // Parse SSE field: value
      if (line.includes(':')) {
        const colonIndex = line.indexOf(':')
        const field = line.slice(0, colonIndex).trim()
        const value = line.slice(colonIndex + 1).trim()

        if (field === 'data') {
          if (currentData) {
            currentData += '\n'
          }
          currentData += value
        }
        // Other SSE fields (event, id, retry) are ignored for now
      } else if (line.trim() === '' && currentData) {
        // Empty line signals end of message
        this.parseDataMessage(currentData)
        currentData = ''
      }
    }

    // Handle any remaining data
    if (currentData) {
      this.buffer = `data: ${currentData}\n` + this.buffer
    }
  }

  private parseDataMessage(data: string): void {
    const trimmed = data.trim()

    // Check for [DONE] marker
    if (trimmed === '[DONE]') {
      this.onDone?.()
      return
    }

    // Parse JSON data
    try {
      const parsed: SSEChunk = JSON.parse(trimmed)

      switch (parsed.type) {
        case 'text-delta':
          if (parsed.textDelta) {
            this.onChunk?.(parsed.textDelta)
          }
          break
        case 'error':
          const errorMsg = parsed.error || 'Unknown error'
          this.onError?.(new Error(errorMsg))
          break
        case 'done':
          this.onDone?.()
          break
        case 'metadata':
          // Metadata events, ignore for now
          break
      }
    } catch (error) {
      console.warn('[SSEParser] Failed to parse data:', trimmed, error)
    }
  }

  /** Reset the parser state */
  reset(): void {
    this.buffer = ''
  }
}

/**
 * Convert a fetch Response with SSE streaming to an async iterator.
 * Yields text chunks as they arrive.
 *
 * @example
 * ```ts
 * for await (const text of streamToAsyncIterator(response)) {
 *   process.stdout.write(text)
 * }
 * ```
 */
export async function* streamToAsyncIterator(
  response: Response
): AsyncGenerator<string, void, unknown> {
  const parser = new SSEStreamParser()
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      parser.feed(chunk)

      // Wait for next tick to allow callbacks to process
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Convert a fetch Response with SSE streaming to a promise that resolves with full text.
 *
 * @example
 * ```ts
 * const text = await consumeStream(response)
 * console.log(text)
 * ```
 */
export async function consumeStream(response: Response): Promise<string> {
  const chunks: string[] = []
  const parser = new SSEStreamParser()

  parser.onChunk = (text) => chunks.push(text)

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      parser.feed(chunk)
    }
  } finally {
    reader.releaseLock()
  }

  return chunks.join('')
}
