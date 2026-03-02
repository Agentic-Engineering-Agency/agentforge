import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// OPTIONS preflight handler for CORS
http.route({
  path: "/api/files/download",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

// File download endpoint — redirects to the stored file URL
http.route({
  path: "/api/files/download",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    const fileId = url.searchParams.get("id");
    if (!fileId) {
      return new Response("Missing file id", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const file = await ctx.runQuery(api.files.getDownloadUrl, {
      id: fileId as Parameters<typeof api.files.getDownloadUrl>[0]["id"],
    });

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders(),
        Location: file.url,
      },
    });
  }),
});

// OPTIONS preflight for /a2a/task
http.route({
  path: "/a2a/task",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

// POST /a2a/task — create a delegated A2A task
http.route({
  path: "/a2a/task",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const { from, to, instruction, context, constraints, callbackUrl, projectId } = body as {
      from?: unknown;
      to?: unknown;
      instruction?: unknown;
      context?: unknown;
      constraints?: unknown;
      callbackUrl?: unknown;
      projectId?: unknown;
    };

    if (typeof from !== "string" || typeof to !== "string" || typeof instruction !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required fields: from, to, instruction" }),
        {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    if (instruction.length > 10000) {
      return new Response(
        JSON.stringify({ error: "instruction exceeds maximum length of 10000 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    const agentIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;
    if (!agentIdPattern.test(from)) {
      return new Response(
        JSON.stringify({ error: "Invalid from agent ID format" }),
        {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }
    if (!agentIdPattern.test(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid to agent ID format" }),
        {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    const taskId = crypto.randomUUID();

    await ctx.runMutation(api.a2aTasks.createTask, {
      taskId,
      fromAgentId: from,
      toAgentId: to,
      instruction,
      context: context ?? undefined,
      constraints: constraints as Parameters<typeof api.a2aTasks.createTask>[0]["constraints"] ?? undefined,
      callbackUrl: typeof callbackUrl === "string" ? callbackUrl : undefined,
      projectId: projectId ?? undefined,
    });

    return new Response(JSON.stringify({ taskId, status: "pending" }), {
      status: 202,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }),
});

// GET /a2a/task — check task status by ?id=<taskId>
http.route({
  path: "/a2a/task",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const taskId = url.searchParams.get("id");
    if (!taskId) {
      return new Response(JSON.stringify({ error: "Missing query param: id" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const task = await ctx.runQuery(api.a2aTasks.getTask, { taskId });
    if (!task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(task), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }),
});

// OPTIONS preflight for /api/stream
http.route({
  path: "/api/stream",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

// POST /api/stream — SSE streaming endpoint for agent responses
// Returns token-by-token streaming via text/event-stream format
http.route({
  path: "/api/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
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
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
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
            currentThreadId = await ctx.runMutation(api.threads.create, {
              agentId,
              userId: typeof userId === "string" ? userId : undefined,
            });
          }

          // Add user message to thread
          await ctx.runMutation(api.messages.add, {
            threadId: currentThreadId,
            role: "user",
            content: message,
          });

          // Create session
          const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await ctx.runMutation(api.sessions.create, {
            sessionId,
            threadId: currentThreadId,
            agentId,
            userId: typeof userId === "string" ? userId : undefined,
            channel: "api",
          });

          // Import Agent class for streaming
          const { Agent: AgentClass } = await import("./lib/agent");
          const { getBaseModelId, getProviderBaseUrl } = await import("./lib/agent");

          // Get API key for provider
          const apiKeyData = await ctx.runQuery(api.apiKeys.getDecryptedForProvider, {
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
            threadId: currentThreadId,
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
        ...corsHeaders(),
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
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

// POST /api/voice/synthesize — Text-to-speech synthesis endpoint
// Uses ElevenLabs API directly
http.route({
  path: "/api/voice/synthesize",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
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
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    if (text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Text exceeds maximum length of 5000 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    try {
      // Import TTS engine from local lib
      const { ElevenLabsTTS } = await import("./lib/tts");

      // Get ElevenLabs API key
      const apiKeyData = await ctx.runQuery(api.apiKeys.getDecryptedForProvider, {
        provider: "elevenlabs",
      });

      if (!apiKeyData || !apiKeyData.apiKey) {
        return new Response(
          JSON.stringify({ error: "ElevenLabs API key not configured" }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
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
          ...corsHeaders(),
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
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
