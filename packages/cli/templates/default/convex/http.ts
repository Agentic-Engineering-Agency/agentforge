"use node";

/**
 * Convex HTTP Actions for SSE Streaming
 *
 * AGE-173: Real token-by-token streaming via Convex HTTP actions + SSE.
 *
 * This module exposes HTTP endpoints for streaming agent responses:
 * - POST /stream-agent: Streams agent responses as SSE events
 *
 * SSE Event Format:
 * - Token:   data: {"token":"..."}\n\n
 * - Done:    data: {"done":true}\n\n
 * - Error:   data: {"error":"..."}\n\n
 *
 * Security:
 * - Input validation on agentId, message, threadId
 * - CORS headers for cross-origin requests
 * - No sensitive data in responses
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Agent } from "@mastra/core/agent";
import type { MessageListInput } from "@mastra/core/agent/message-list";

const http = httpRouter();

/**
 * Strip provider prefix from modelId to prevent double-prefixing.
 */
function getBaseModelId(provider: string, modelId: string): string {
  const prefix = `${provider}/`;
  return modelId.startsWith(prefix) ? modelId.slice(prefix.length) : modelId;
}

/**
 * Return custom base URL for providers that aren't natively supported by Mastra.
 */
function getProviderBaseUrl(provider: string): string | undefined {
  const urls: Record<string, string> = {
    openrouter: "https://openrouter.ai/api/v1",
    mistral:    "https://api.mistral.ai/v1",
    deepseek:   "https://api.deepseek.com",
    xai:        "https://api.x.ai/v1",
    cohere:     "https://api.cohere.ai/v1",
  };
  return urls[provider];
}

/**
 * Build the Mastra OpenAICompatibleConfig for BYOK.
 */
function buildModelConfig(
  provider: string,
  modelId: string,
  apiKey: string
): { providerId: string; modelId: string; apiKey: string; url?: string } {
  const baseModelId = getBaseModelId(provider, modelId);
  const baseUrl = getProviderBaseUrl(provider);
  return {
    providerId: provider,
    modelId: baseModelId,
    apiKey,
    ...(baseUrl ? { url: baseUrl } : {}),
  };
}

/**
 * Build MCP tool context string from active connections.
 */
function buildMcpToolContext(
  connections: Array<{ name: string; capabilities?: string[] }>
): string {
  if (connections.length === 0) return "";
  const toolsList = connections
    .map((c) => `${c.name} (${(c.capabilities || []).join(", ")})`)
    .join(", ");
  return `You have access to these MCP tools: ${toolsList}. Use them when relevant.`;
}

/**
 * Validate input for security.
 * Returns an error message if validation fails, null otherwise.
 */
function validateInput(
  agentId: unknown,
  message: unknown,
  threadId: unknown
): string | null {
  if (typeof agentId !== "string" || !agentId.trim()) {
    return "Missing required field: agentId";
  }
  if (typeof message !== "string" || !message.trim()) {
    return "Missing required field: message";
  }
  if (threadId !== undefined && typeof threadId !== "string") {
    return "Invalid threadId format";
  }

  // Basic injection protection - agentId should be alphanumeric with dashes/underscores
  const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!safeIdPattern.test(agentId as string)) {
    return "Invalid agentId format";
  }

  // Message length limit (prevent abuse)
  if ((message as string).length > 50000) {
    return "Message too long (max 50000 characters)";
  }

  return null;
}

/**
 * POST /stream-agent
 *
 * Streams agent responses as Server-Sent Events (SSE).
 *
 * Request body:
 * - agentId: string (required) - The agent ID to use
 * - message: string (required) - The user message
 * - threadId: string (optional) - Thread ID for conversation context
 *
 * Response: SSE stream with:
 * - data: {"token":"..."} for each text chunk
 * - data: {"done":true} when complete
 * - data: {"error":"..."} on error
 */
http.route({
  path: "/stream-agent",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Parse request body
    let body: { agentId?: string; message?: string; threadId?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { agentId, message, threadId } = body;

    // Validate input
    const validationError = validateInput(agentId, message, threadId);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Get agent from DB
    const agent = await ctx.runQuery(internal.agents.get, { id: agentId });
    if (!agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Get API key for the provider
    const provider = agent.provider || "openrouter";
    const apiKey = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider });
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `No API key configured for provider: ${provider}` }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Get MCP tool context
    const mcpConnections = await ctx.runQuery(internal.mcpConnections.list, { isEnabled: true });
    const mcpToolContext = buildMcpToolContext(
      mcpConnections as Array<{ name: string; capabilities?: string[] }>
    );

    // Get conversation history if threadId provided
    let conversationMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
    if (threadId) {
      const history = await ctx.runQuery(internal.messages.list, { threadId: threadId as any });
      conversationMessages = (history as Array<{ role: string; content: string }>)
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));
    }

    // Add current user message
    conversationMessages.push({ role: "user", content: message! });

    // Build full instructions with MCP tool context
    const baseInstructions = agent.instructions || "You are a helpful AI assistant.";
    const fullInstructions = mcpToolContext
      ? `${baseInstructions}\n\n${mcpToolContext}`
      : baseInstructions;

    // Build model config
    const modelId = agent.model || "auto";
    const modelConfig = buildModelConfig(provider, modelId, apiKey);

    // Create Mastra agent
    const mastraAgent = new Agent({
      id: "agentforge-streamer",
      name: "agentforge-streamer",
      instructions: fullInstructions,
      model: modelConfig,
    });

    // Create SSE stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start streaming in background
    (async () => {
      try {
        const stream = await mastraAgent.stream(
          conversationMessages as unknown as MessageListInput
        );

        // Stream text chunks
        for await (const chunk of stream.textStream) {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ token: chunk })}\n\n`)
          );
        }

        // Send completion event
        await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
        );
      } finally {
        await writer.close();
      }
    })();

    // Return SSE response
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

/**
 * OPTIONS /stream-agent
 *
 * Pre-flight request handler for CORS.
 */
http.route({
  path: "/stream-agent",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    return new Response();
  }),
});

export default http;
