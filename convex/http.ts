import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// File download endpoint — redirects to the stored file URL
http.route({
  path: "/api/files/download",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const fileId = url.searchParams.get("id");
    if (!fileId) {
      return new Response("Missing file id", { status: 400 });
    }

    const file = await ctx.runQuery(api.files.getDownloadUrl, {
      id: fileId as Parameters<typeof api.files.getDownloadUrl>[0]["id"],
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: file.url,
        "Content-Disposition": `attachment; filename="${file.name}"`,
      },
    });
  }),
});

export default http;
