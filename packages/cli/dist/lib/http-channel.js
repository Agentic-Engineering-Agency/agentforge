#!/usr/bin/env node

// src/lib/http-channel.ts
import { createServer } from "http";
var MAX_BODY_BYTES = 1 * 1024 * 1024;
async function startHttpChannel(port, agents, _convexUrl, dev = false) {
  const agentMap = /* @__PURE__ */ new Map();
  for (const agent of agents) {
    agentMap.set(agent.id, agent);
  }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        agents: agents.length,
        agentIds: Array.from(agentMap.keys()),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }));
      return;
    }
    if (url.pathname === "/v1/chat/completions") {
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end("Method not allowed");
        return;
      }
      let body = "";
      let bodyBytes = 0;
      let bodyLimitExceeded = false;
      req.on("error", (err) => {
        if (!res.headersSent && !res.writableEnded) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: err.message, type: "bad_request" } }));
        }
      });
      req.on("data", (chunk) => {
        if (bodyLimitExceeded) return;
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          bodyLimitExceeded = true;
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "Request body too large", type: "bad_request" } }));
          req.destroy();
          return;
        }
        body += chunk.toString();
      });
      req.on("end", async () => {
        if (res.writableEnded) return;
        try {
          const requestData = JSON.parse(body);
          const agentId = requestData.model?.split(":")[1] || agents[0]?.id;
          const agent = agentMap.get(agentId) || agents[0];
          if (!agent) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Agent not found" }));
            return;
          }
          const messages = requestData.messages.map((m) => ({
            role: m.role,
            content: m.content
          }));
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          });
          try {
            const stream = await agent.stream(messages);
            for await (const chunk of stream.fullStream) {
              if (chunk.type === "text-delta") {
                const data = JSON.stringify({
                  id: `chatcmpl-${Date.now()}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1e3),
                  model: agentId,
                  choices: [{
                    index: 0,
                    delta: { content: chunk.textDelta },
                    finish_reason: null
                  }]
                });
                res.write(`data: ${data}

`);
              }
            }
            const finalData = JSON.stringify({
              id: `chatcmpl-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1e3),
              model: agentId,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: "stop"
              }]
            });
            res.write(`data: ${finalData}

`);
            res.write("data: [DONE]\n\n");
          } catch (streamErr) {
            res.write(`data: ${JSON.stringify({ error: String(streamErr) })}

`);
          }
          res.end();
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: {
              message: err instanceof Error ? err.message : String(err),
              type: "internal_error"
            }
          }));
        }
      });
      return;
    }
    if (url.pathname === "/api/agents" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name ?? a.id,
          model: a.model ?? "unknown"
        }))
      }));
      return;
    }
    if (url.pathname === "/api/chat" && req.method === "POST") {
      let body = "";
      let bodyBytes = 0;
      req.on("data", (chunk) => {
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          req.destroy();
          return;
        }
        body += chunk.toString();
      });
      req.on("end", async () => {
        if (res.writableEnded) return;
        try {
          const { agentId, message, threadId } = JSON.parse(body);
          const agent = (agentId ? agentMap.get(agentId) : null) ?? agents[0];
          if (!agent) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Agent not found" }));
            return;
          }
          const result = await agent.generate([{ role: "user", content: message }]);
          const reply = result?.text ?? result?.content ?? String(result ?? "");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ reply, threadId: threadId ?? `thread-${Date.now()}`, agentId: agent.id }));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      if (dev) {
        console.log(`[HttpChannel] Listening on http://localhost:${port}`);
      }
      resolve();
    });
  });
  return () => new Promise((resolve) => {
    server.close(() => resolve());
  });
}
export {
  startHttpChannel
};
//# sourceMappingURL=http-channel.js.map