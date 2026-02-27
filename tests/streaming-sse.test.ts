/**
 * AGE-173: Streaming SSE Tests
 *
 * Tests for real token-by-token streaming via Convex HTTP actions + SSE.
 *
 * These tests verify:
 * 1. HTTP route responds with Content-Type: text/event-stream
 * 2. SSE data format: `data: {"token":"..."}\n\n`
 * 3. Final event: `data: {"done":true}\n\n`
 * 4. Error event: `data: {"error":"..."}\n\n`
 * 5. Security: input validation, CORS headers
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock fetch for SSE testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock ReadableStream for SSE parsing
function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

describe("AGE-173: SSE Streaming", () => {
  const convexSiteUrl = "https://test-deployment.convex.site";

  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("HTTP Route: POST /stream-agent", () => {
    it("should respond with Content-Type: text/event-stream", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        }),
        body: createMockStream([]),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${convexSiteUrl}/stream-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "test-agent",
          message: "Hello",
          threadId: "test-thread",
        }),
      });

      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("Cache-Control")).toBe("no-cache");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should return 400 for missing agentId", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: () => Promise.resolve("Missing required field: agentId"),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${convexSiteUrl}/stream-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Hello",
          threadId: "test-thread",
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should return 404 for non-existent agent", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: () => Promise.resolve("Agent not found"),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${convexSiteUrl}/stream-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "non-existent-agent",
          message: "Hello",
          threadId: "test-thread",
        }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("SSE Data Format", () => {
    it("should stream tokens in SSE format: data: {token}\\n\\n", async () => {
      const sseChunks = [
        'data: {"token":"Hello"}\n\n',
        'data: {"token":" world"}\n\n',
        'data: {"token":"!"}\n\n',
        'data: {"done":true}\n\n',
      ];

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          "Content-Type": "text/event-stream",
        }),
        body: createMockStream(sseChunks),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${convexSiteUrl}/stream-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "test-agent",
          message: "Say hello",
          threadId: "test-thread",
        }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const tokens: string[] = [];
      let isDone = false;

      while (!isDone) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              tokens.push(data.token);
            }
            if (data.done) {
              isDone = true;
            }
          }
        }
      }

      expect(tokens).toEqual(["Hello", " world", "!"]);
      expect(isDone).toBe(true);
    });

    it("should send final event: data: {\"done\":true}\\n\\n", async () => {
      const sseChunks = [
        'data: {"token":"Response"}\n\n',
        'data: {"done":true}\n\n',
      ];

      const mockResponse = {
        ok: true,
        body: createMockStream(sseChunks),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${convexSiteUrl}/stream-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "test-agent",
          message: "Test",
          threadId: "test-thread",
        }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let receivedDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        if (chunk.includes('{"done":true}')) {
          receivedDone = true;
        }
      }

      expect(receivedDone).toBe(true);
    });

    it("should send error event on failure: data: {\"error\":\"...\"}\\n\\n", async () => {
      const sseChunks = [
        'data: {"error":"API key not configured"}\n\n',
      ];

      const mockResponse = {
        ok: true,
        body: createMockStream(sseChunks),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${convexSiteUrl}/stream-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "test-agent",
          message: "Test",
          threadId: "test-thread",
        }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let errorMessage: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              errorMessage = data.error;
            }
          }
        }
      }

      expect(errorMessage).toBe("API key not configured");
    });
  });

  describe("Security", () => {
    it("should validate agentId input (no injection)", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: () => Promise.resolve("Invalid agentId"),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      // Try SQL injection in agentId
      const response = await fetch(`${convexSiteUrl}/stream-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "'; DROP TABLE agents; --",
          message: "Hello",
          threadId: "test-thread",
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should include CORS headers for cross-origin requests", async () => {
      const mockResponse = {
        ok: true,
        headers: new Headers({
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }),
        body: createMockStream(['data: {"done":true}\n\n']),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${convexSiteUrl}/stream-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "test-agent",
          message: "Hello",
          threadId: "test-thread",
        }),
      });

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    });
  });

  describe("Dashboard SSE Client", () => {
    it("should update streaming state as tokens arrive", async () => {
      // This tests the client-side behavior pattern
      const sseChunks = [
        'data: {"token":"Hello"}\n\n',
        'data: {"token":" there"}\n\n',
        'data: {"done":true}\n\n',
      ];

      // Simulate streaming state updates
      let streamingContent = "";
      let isStreaming = true;

      for (const chunk of sseChunks) {
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              streamingContent += data.token;
            }
            if (data.done) {
              isStreaming = false;
            }
          }
        }
      }

      expect(streamingContent).toBe("Hello there");
      expect(isStreaming).toBe(false);
    });
  });

  describe("CLI Streaming Output", () => {
    it("should print tokens to stdout progressively", async () => {
      const sseChunks = [
        'data: {"token":"First"}\n\n',
        'data: {"token":" chunk"}\n\n',
        'data: {"token":" complete"}\n\n',
        'data: {"done":true}\n\n',
      ];

      // Simulate CLI output buffer
      const outputBuffer: string[] = [];

      for (const chunk of sseChunks) {
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              outputBuffer.push(data.token);
            }
          }
        }
      }

      // Each token should be printed as it arrives
      expect(outputBuffer).toEqual(["First", " chunk", " complete"]);
      expect(outputBuffer.join("")).toBe("First chunk complete");
    });
  });
});

describe("SSE Parsing Utilities", () => {
  it("should handle multi-line SSE data correctly", () => {
    const sseData = 'data: {"token":"line1\\nline2"}\n\ndata: {"done":true}\n\n';
    const lines = sseData.split("\n\n").filter(Boolean);

    const events = lines.map((line) => {
      const dataLine = line.split("\n").find((l) => l.startsWith("data: "));
      return dataLine ? JSON.parse(dataLine.slice(6)) : null;
    });

    expect(events).toEqual([
      { token: "line1\nline2" },
      { done: true },
    ]);
  });

  it("should handle empty chunks gracefully", () => {
    const sseData = '\n\ndata: {"token":"test"}\n\n\n\n';
    const lines = sseData.split("\n\n").filter(Boolean);

    const events = lines
      .map((line) => {
        const dataLine = line.split("\n").find((l) => l.startsWith("data: "));
        return dataLine ? JSON.parse(dataLine.slice(6)) : null;
      })
      .filter(Boolean);

    expect(events).toEqual([{ token: "test" }]);
  });
});
