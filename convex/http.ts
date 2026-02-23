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

export default http;
