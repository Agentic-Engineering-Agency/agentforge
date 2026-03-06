/**
 * HTTP Channel for AgentForge Daemon
 *
 * Implements an HTTP server with OpenAI-compatible /v1/chat/completions endpoint.
 * Uses Server-Sent Events (SSE) for streaming responses.
 */
declare function startHttpChannel(port: number, agents: any[], convexUrl: string, dev?: boolean, 
/** Raw agent configs (with provider + model) — used for usage tracking & model API keys */
agentConfigs?: Array<{
    id: string;
    provider: string;
    model: string;
}>): Promise<() => Promise<void>>;

export { startHttpChannel };
