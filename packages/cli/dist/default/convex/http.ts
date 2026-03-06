"use node";

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

// Default allowed origins for local-first development
// Extend via environment variable: CONVEX_ALLOWED_ORIGINS=http://example.com,https://app.example.com
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://localhost:4321",
];

function corsHeaders(origin: string | null): Record<string, string> {
  // Parse allowed origins from env or use defaults
  const allowedOrigins = process.env.CONVEX_ALLOWED_ORIGINS
    ? process.env.CONVEX_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : DEFAULT_ALLOWED_ORIGINS;

  // Validate origin against allowed list
  const allowedOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0]; // Fallback to first allowed origin

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin", // Signal that response varies by Origin header
  };
}

// OPTIONS preflight handler for CORS
http.route({
  path: "/api/files/download",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get("Origin");
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }),
});

// File download endpoint — redirects to the stored file URL
http.route({
  path: "/api/files/download",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);
    const fileId = url.searchParams.get("id");
    if (!fileId) {
      return new Response("Missing file id", {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    const file = await ctx.runQuery(api.files.getDownloadUrl, {
      id: fileId as any,
    });

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders(origin),
        Location: file.url,
      },
    });
  }),
});

// TODO: A2A routes - requires a2aTasks.ts
// // OPTIONS preflight for /a2a/task
// http.route({
//   path: "/a2a/task",
//   method: "OPTIONS",
//   handler: httpAction(async (_ctx, request) => {
//     const origin = request.headers.get("Origin");
//     return new Response(null, {
//       status: 204,
//       headers: corsHeaders(origin),
//     });
//   }),
// });
//
// // POST /a2a/task — create a delegated A2A task
// http.route({
//   path: "/a2a/task",
//   method: "POST",
//   handler: httpAction(async (ctx, request) => {
//     const origin = request.headers.get("Origin");
//     const authHeader = request.headers.get("Authorization");
//     if (!authHeader) {
//       return new Response(JSON.stringify({ error: "Unauthorized" }), {
//         status: 401,
//         headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//       });
//     }
//
//     let body: Record<string, unknown>;
//     try {
//       body = await request.json();
//     } catch {
//       return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
//         status: 400,
//         headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//       });
//     }
//
//     const { from, to, instruction, context, constraints, callbackUrl, projectId } = body as {
//       from?: unknown;
//       to?: unknown;
//       instruction?: unknown;
//       context?: unknown;
//       constraints?: unknown;
//       callbackUrl?: unknown;
//       projectId?: unknown;
//     };
//
//     if (typeof from !== "string" || typeof to !== "string" || typeof instruction !== "string") {
//       return new Response(
//         JSON.stringify({ error: "Missing required fields: from, to, instruction" }),
//         {
//           status: 400,
//           headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         }
//       );
//     }
//
//     if (instruction.length > 10000) {
//       return new Response(
//         JSON.stringify({ error: "instruction exceeds maximum length of 10000 characters" }),
//         {
//           status: 400,
//           headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         }
//       );
//     }
//
//     const agentIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;
//     if (!agentIdPattern.test(from)) {
//       return new Response(
//         JSON.stringify({ error: "Invalid from agent ID format" }),
//         {
//           status: 400,
//           headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         }
//       );
//     }
//     if (!agentIdPattern.test(to)) {
//       return new Response(
//         JSON.stringify({ error: "Invalid to agent ID format" }),
//         {
//           status: 400,
//           headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//         }
//       );
//     }
//
//     const taskId = crypto.randomUUID();
//
//     await ctx.runMutation(api.a2aTasks.createTask, {
//       taskId,
//       fromAgentId: from,
//       toAgentId: to,
//       instruction,
//       context: context ?? undefined,
//       constraints: constraints as Parameters<typeof api.a2aTasks.createTask>[0]["constraints"] ?? undefined,
//       callbackUrl: typeof callbackUrl === "string" ? callbackUrl : undefined,
//       projectId: projectId ?? undefined,
//     });
//
//     return new Response(JSON.stringify({ taskId, status: "pending" }), {
//       status: 202,
//       headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//     });
//   }),
// });
//
// // GET /a2a/task — check task status by ?id=<taskId>
// http.route({
//   path: "/a2a/task",
//   method: "GET",
//   handler: httpAction(async (ctx, request) => {
//     const origin = request.headers.get("Origin");
//     const url = new URL(request.url);
//     const taskId = url.searchParams.get("id");
//     if (!taskId) {
//       return new Response(JSON.stringify({ error: "Missing query param: id" }), {
//         status: 400,
//         headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//       });
//     }
//
//     const task = await ctx.runQuery(api.a2aTasks.getTask, { taskId });
//     if (!task) {
//       return new Response(JSON.stringify({ error: "Task not found" }), {
//         status: 404,
//         headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//       });
//     }
//
//     return new Response(JSON.stringify(task), {
//       status: 200,
//       headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
//     });
//   }),
// });

// OPTIONS preflight for /api/stream
http.route({
  path: "/api/stream",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get("Origin");
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }),
});

// POST /api/stream — SSE streaming endpoint for agent responses
// Returns token-by-token streaming via text/event-stream format
http.route({
  path: "/api/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const { agentId, message, threadId, userId } = body as {
      agentId?: unknown;
      message?: unknown;
      threadId?: unknown;
      userId?: unknown;
    };

    if (typeof agentId !== "string" || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required fields: agentId, message" }),
        {
          status: 400,
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Get agent configuration
          const agent = await ctx.runQuery(api.agents.get, { id: agentId });
          if (!agent) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Agent not found" })}\n\n`));
            controller.close();
            return;
          }

          // Create or get thread
          let currentThreadId = threadId as string | undefined;
          if (!currentThreadId) {
            currentThreadId = await ctx.runMutation(api.threads.createThread, {
              agentId,
            });
          }

          // Add user message to thread
          await ctx.runMutation(api.messages.add, {
            threadId: currentThreadId as any,
            role: "user",
            content: message,
          });

          // Create session
          const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await ctx.runMutation(api.sessions.create, {
            sessionId,
            threadId: currentThreadId as any,
            agentId,
            userId: typeof userId === "string" ? userId : undefined,
            channel: "api",
          });

          // Import Agent class for streaming
          const { Agent: AgentClass } = await import("./lib/agent");
          const { getBaseModelId, getProviderBaseUrl } = await import("./lib/agent");

          // Get API key for provider
          const apiKeyData = await ctx.runAction(internal.apiKeys.getDecryptedForProvider, {
            provider: agent.provider || "openrouter",
          });

          if (!apiKeyData || !apiKeyData.apiKey) {
            throw new Error(`No API key found for provider: ${agent.provider}`);
          }

          // Create agent instance
          const mastraAgent = new AgentClass({
            id: agentId,
            name: agent.name,
            instructions: agent.instructions || "You are a helpful AI assistant.",
            model: {
              providerId: agent.provider || "openrouter",
              modelId: getBaseModelId(agent.provider || "openrouter", agent.model || "gpt-4o-mini"),
              apiKey: apiKeyData.apiKey,
              url: getProviderBaseUrl(agent.provider || "openrouter"),
            },
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
          });

          // Stream the response
          let fullResponse = "";
          for await (const chunk of mastraAgent.stream(message)) {
            const text = chunk.content;
            fullResponse += text;

            // Send SSE event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text-delta", textDelta: text })}\n\n`)
            );
          }

          // Add assistant message to thread
          await ctx.runMutation(api.messages.add, {
            threadId: currentThreadId as any,
            role: "assistant",
            content: fullResponse,
          });

          // Update session status
          await ctx.runMutation(api.sessions.updateStatus, {
            sessionId,
            status: "completed",
          });

          // Send done event
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }),
});

// OPTIONS preflight for /api/voice/synthesize
http.route({
  path: "/api/voice/synthesize",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get("Origin");
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }),
});

// POST /api/voice/synthesize — Text-to-speech synthesis endpoint
// Uses ElevenLabs API directly
http.route({
  path: "/api/voice/synthesize",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const { text, voiceId } = body as {
      text?: unknown;
      voiceId?: unknown;
    };

    if (typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required field: text" }),
        {
          status: 400,
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    }

    if (text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Text exceeds maximum length of 5000 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    }

    try {
      // Import TTS engine from local lib
      const { ElevenLabsTTS } = await import("./lib/tts");

      // Get ElevenLabs API key
      const apiKeyData = await ctx.runAction(internal.apiKeys.getDecryptedForProvider, {
        provider: "elevenlabs",
      });

      if (!apiKeyData || !apiKeyData.apiKey) {
        return new Response(
          JSON.stringify({ error: "ElevenLabs API key not configured" }),
          {
            status: 500,
            headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
          }
        );
      }

      // Create TTS engine and synthesize
      const tts = new ElevenLabsTTS({
        apiKey: apiKeyData.apiKey,
        voiceId: typeof voiceId === "string" ? voiceId : undefined,
      });

      const audioBuffer = await tts.synthesize(text);

      return new Response(audioBuffer, {
        status: 200,
        headers: {
          ...corsHeaders(origin),
          "Content-Type": "audio/mpeg",
          "Content-Disposition": `attachment; filename="speech-${Date.now()}.mp3"`,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(
        JSON.stringify({ error: `TTS synthesis failed: ${errorMessage}` }),
        {
          status: 500,
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// =====================================================
// Telegram Webhook Endpoint
// =====================================================

// OPTIONS preflight for /telegram/:connectionId
http.route({
  path: "/telegram/:connectionId",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get("Origin");
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }),
});

// POST /telegram/:connectionId — Receive Telegram webhook events
http.route({
  path: "/telegram/:connectionId",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const connectionId = parts[parts.length - 1];

    // Get connection data
    const connection = await ctx.runQuery(api.channelConnections.getById, {
      id: connectionId as any,
    });

    if (!connection) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (connection.channel !== "telegram") {
      return new Response(JSON.stringify({ error: "Invalid connection type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse Telegram Update
    const body = await request.json();
    const update = body as {
      update_id: number;
      message?: {
        message_id: number;
        from: { id: number; first_name: string; username?: string };
        chat: { id: number; type: string };
        text: string;
      };
      callback_query?: {
        id: string;
        from: { id: number; first_name: string; username?: string };
        message: {
          message_id: number;
          chat: { id: number };
          text: string;
        };
        data: string;
      };
    };

    // Extract message data
    let text = "";
    let chatId = "";
    let userId = "";
    let senderName = "";

    if (update.message) {
      text = update.message.text;
      chatId = String(update.message.chat.id);
      userId = String(update.message.from.id);
      senderName = update.message.from.first_name;
    } else if (update.callback_query) {
      // Handle callback_query (button clicks)
      text = update.callback_query.data;
      chatId = String(update.callback_query.message.chat.id);
      userId = String(update.callback_query.from.id);
      senderName = update.callback_query.from.first_name;
    } else {
      return new Response(JSON.stringify({ error: "Unsupported update type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create or get thread - use telegram chatId as userId for thread isolation
    const threadId = `telegram-${chatId}`;
    let actualThreadId;

    // Try to find existing thread by agentId and userId
    const threads = await ctx.runQuery(api.threads.listThreads, {});

    const filtered = threads.filter((t: any) =>
      t.agentId === connection.agentId && t.userId === `telegram-${chatId}`
    );

    if (filtered && filtered.length > 0) {
      actualThreadId = filtered[0]._id;
    } else {
      // Create new thread for this Telegram chat
      const newThreadId = await ctx.runMutation(api.threads.createThread, {
        agentId: connection.agentId,
        name: senderName ? `Telegram: ${senderName}` : `Telegram Chat ${chatId}`,
      });
      if (!newThreadId) {
        throw new Error('Failed to create thread');
      }
      actualThreadId = newThreadId;
    }

    // Execute agent
    const result = await ctx.runAction(api.mastraIntegration.executeAgent, {
      agentId: connection.agentId,
      prompt: text,
      threadId: actualThreadId,
      userId: `telegram-${chatId}`,
    });

    // Send reply via Telegram Bot API
    try {
      // Get decrypted bot token
      const botTokenData = await ctx.runQuery(internal.channelConnections.getDecryptedBotToken, {
        connectionId: connectionId as any,
      });

      // Send message to Telegram
      const telegramApiUrl = `https://api.telegram.org/bot${botTokenData.botToken}/sendMessage`;
      await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: parseInt(chatId, 10),
          text: result.response,
        }),
      });

      // Update connection activity
      await ctx.runMutation(api.channelConnections.updateActivity, {
        id: connectionId as any,
      });
    } catch (error) {
      console.error("Failed to send Telegram reply:", error);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
