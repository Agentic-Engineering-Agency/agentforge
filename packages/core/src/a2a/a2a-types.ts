export interface A2ATask {
  id: string;
  from: string;
  to: string;
  instruction: string;
  context?: A2AContext;
  constraints?: A2AConstraints;
  callbackUrl?: string;
  createdAt: number;
}

export interface A2AContext {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  memory?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface A2AConstraints {
  maxTokens?: number;
  timeoutMs?: number;
  maxCost?: number;
}

export interface A2AResult {
  taskId: string;
  status: "success" | "error" | "timeout";
  output?: string;
  artifacts?: A2AArtifact[];
  usage?: { inputTokens: number; outputTokens: number; cost: number };
  durationMs: number;
}

export interface A2AArtifact {
  type: "text" | "code" | "file" | "data";
  content: string;
  mimeType?: string;
  name?: string;
}

export interface A2AStreamChunk {
  taskId: string;
  type: "text" | "artifact" | "status";
  content: string;
}

export interface A2AServerConfig {
  /** Max instruction length to prevent injection */
  maxInstructionLength?: number;
  /** Require auth token on incoming tasks */
  requireAuth?: boolean;
  /** Allowed source agent IDs (whitelist) */
  allowedAgents?: string[];
}
