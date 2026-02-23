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

export default http;
