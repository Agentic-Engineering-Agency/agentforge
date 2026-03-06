#!/usr/bin/env node

// src/lib/http-channel.ts
import { createServer } from "http";
import { ConvexHttpClient } from "convex/browser";
var MAX_BODY_BYTES = 1 * 1024 * 1024;
var STATIC_MODELS = {
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o3", "o4-mini"],
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
  xai: ["grok-3", "grok-3-mini", "grok-2"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  openrouter: ["openrouter/auto", "openai/gpt-4o", "anthropic/claude-sonnet-4-6", "google/gemini-2.5-flash"],
  groq: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b", "qwen-qwq-32b"],
  together: ["meta-llama/Llama-4-Scout-17B-16E-Instruct", "deepseek-ai/DeepSeek-R1", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
  perplexity: ["sonar-pro", "sonar", "sonar-reasoning-pro"]
};
var modelsCache = /* @__PURE__ */ new Map();
var MODELS_CACHE_TTL_MS = 5 * 60 * 1e3;
async function fetchModels(provider, apiKey) {
  const cached = modelsCache.get(provider);
  if (cached && Date.now() - cached.fetchedAt < MODELS_CACHE_TTL_MS) {
    return cached.models;
  }
  let models = STATIC_MODELS[provider] ?? [];
  try {
    if (provider === "openai" && apiKey) {
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5e3)
      });
      if (resp.ok) {
        const data = await resp.json();
        const EXCLUDE = ["audio", "realtime", "transcribe", "tts", "embedding", "moderation", "vision", "dall-e", "whisper", "instruct", "search", "codex", "image"];
        const chatModels = data.data.filter(
          (m) => /^(gpt-|o\d|chatgpt)/i.test(m.id) && !EXCLUDE.some((ex) => m.id.toLowerCase().includes(ex))
        ).sort((a, b) => b.created - a.created).map((m) => m.id).slice(0, 24);
        if (chatModels.length > 0) models = chatModels;
      }
    } else if (provider === "google" && apiKey) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(5e3) }
      );
      if (resp.ok) {
        const data = await resp.json();
        const chatModels = (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace("models/", "")).filter((id) => id.startsWith("gemini")).slice(0, 20);
        if (chatModels.length > 0) models = chatModels;
      }
    }
  } catch {
  }
  modelsCache.set(provider, { models, fetchedAt: Date.now() });
  return models;
}
function estimateCost(provider, model, promptTokens, completionTokens) {
  const pricing = {
    "gpt-4o": [2.5, 10],
    "gpt-4o-mini": [0.15, 0.6],
    "gpt-4.1": [2, 8],
    "gpt-4.1-mini": [0.4, 1.6],
    "gpt-4.1-nano": [0.1, 0.4],
    "o3": [10, 40],
    "o4-mini": [1.1, 4.4],
    "claude-opus-4-6": [15, 75],
    "claude-sonnet-4-6": [3, 15],
    "claude-haiku-4-5": [0.8, 4],
    "gemini-2.5-pro": [1.25, 5],
    "gemini-2.5-flash": [0.075, 0.3],
    "gemini-2.0-flash": [0.1, 0.4]
  };
  const key = Object.keys(pricing).find((k) => model.includes(k));
  if (!key) return 0;
  const [inputPer1M, outputPer1M] = pricing[key];
  return promptTokens / 1e6 * inputPer1M + completionTokens / 1e6 * outputPer1M;
}
async function startHttpChannel(port, agents, convexUrl, dev = false, agentConfigs = []) {
  const agentMap = /* @__PURE__ */ new Map();
  for (const agent of agents) {
    agentMap.set(agent.id, agent);
  }
  const configMap = /* @__PURE__ */ new Map();
  for (const cfg of agentConfigs) {
    configMap.set(cfg.id, cfg);
  }
  const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;
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
              const text = chunk.type === "text-delta" ? chunk.payload?.text ?? chunk.textDelta ?? "" : null;
              if (text !== null && text !== "") {
                const data = JSON.stringify({
                  id: `chatcmpl-${Date.now()}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1e3),
                  model: agentId,
                  choices: [{
                    index: 0,
                    delta: { content: text },
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
    if (url.pathname === "/api/models" && req.method === "GET") {
      const provider = url.searchParams.get("provider")?.toLowerCase() ?? "";
      if (!provider) {
        const all = {};
        for (const p of Object.keys(STATIC_MODELS)) {
          all[p] = STATIC_MODELS[p];
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ providers: all }));
        return;
      }
      const apiKey = process.env[getProviderEnvKey(provider)];
      const models = await fetchModels(provider, apiKey);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ provider, models, cached: modelsCache.has(provider) }));
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
          if (convex && threadId) {
            try {
              await convex.mutation("messages:create", {
                threadId,
                role: "user",
                content: message
              });
            } catch (_e) {
              if (dev) console.warn("[api/chat] Failed to store user message:", _e);
            }
          }
          const result = await agent.generate([{ role: "user", content: message }]);
          const reply = result?.text ?? result?.content ?? String(result ?? "");
          const usage = result?.usage ?? result?.rawResponse?.usage ?? null;
          const promptTokens = usage?.promptTokens ?? usage?.inputTokens ?? usage?.prompt_tokens ?? 0;
          const completionTokens = usage?.completionTokens ?? usage?.outputTokens ?? usage?.completion_tokens ?? 0;
          const totalTokens = promptTokens + completionTokens;
          if (convex && threadId) {
            try {
              await convex.mutation("messages:create", {
                threadId,
                role: "assistant",
                content: reply
              });
            } catch (_e) {
              if (dev) console.warn("[api/chat] Failed to store assistant message:", _e);
            }
          }
          if (convex && agent.id) {
            try {
              const cfg = configMap.get(agent.id) ?? { provider: "openai", model: agent.model ?? "unknown" };
              const cost = estimateCost(cfg.provider, cfg.model, promptTokens, completionTokens);
              await convex.mutation("usage:record", {
                agentId: agent.id,
                provider: cfg.provider,
                model: cfg.model,
                promptTokens,
                completionTokens,
                totalTokens,
                cost
              });
            } catch (_e) {
              if (dev) console.warn("[api/chat] Failed to record usage:", _e);
            }
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ reply, threadId: threadId ?? `thread-${Date.now()}`, agentId: agent.id, usage: { promptTokens, completionTokens, totalTokens } }));
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
function getProviderEnvKey(provider) {
  const map = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_GENERATIVE_AI_API_KEY",
    xai: "XAI_API_KEY",
    mistral: "MISTRAL_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    groq: "GROQ_API_KEY",
    together: "TOGETHER_API_KEY",
    perplexity: "PERPLEXITY_API_KEY"
  };
  return map[provider] ?? `${provider.toUpperCase()}_API_KEY`;
}
export {
  startHttpChannel
};
//# sourceMappingURL=http-channel.js.map