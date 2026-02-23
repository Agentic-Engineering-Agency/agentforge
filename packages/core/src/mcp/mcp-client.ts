import { z } from 'zod';
import { spawn, type ChildProcess } from 'child_process';

// === Schemas (Zod) ===
export const mcpTransportConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stdio'),
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    cwd: z.string().optional(),
  }),
  z.object({
    type: z.literal('http'),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
    timeout: z.number().positive().optional(),
  }),
  z.object({
    type: z.literal('sse'),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
    reconnectInterval: z.number().positive().optional(),
    maxReconnectAttempts: z.number().nonnegative().optional(),
  }),
]);

export type MCPTransportConfig = z.infer<typeof mcpTransportConfigSchema>;

// MCP Protocol types
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}

export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // base64
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
  };
}

// Client configuration
export interface MCPClientConfig {
  transport: MCPTransportConfig;
  clientInfo?: {
    name: string;
    version: string;
  };
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  requestTimeout?: number; // ms, default 30000
}

// Connection state
export type MCPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Events
export type MCPClientEvent =
  | { type: 'connected'; serverInfo: { name: string; version: string } }
  | { type: 'disconnected'; reason?: string }
  | { type: 'error'; error: Error }
  | { type: 'toolsChanged' }
  | { type: 'resourcesChanged' };

export type MCPClientEventHandler = (event: MCPClientEvent) => void;

// === Transport Interface ===
export interface MCPTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: MCPJsonRpcRequest): Promise<MCPJsonRpcResponse>;
  onNotification?(handler: (notification: MCPJsonRpcNotification) => void): void;
  isConnected(): boolean;
}

// JSON-RPC types for MCP protocol
export interface MCPJsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPJsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPJsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// === StdioTransport ===

export class StdioTransport implements MCPTransport {
  private process: ChildProcess | null = null;
  private connected = false;
  private pendingRequests = new Map<
    string | number,
    { resolve: (res: MCPJsonRpcResponse) => void; reject: (err: Error) => void }
  >();
  private notificationHandler: ((n: MCPJsonRpcNotification) => void) | undefined;
  private buffer = '';

  constructor(private readonly config: Extract<MCPTransportConfig, { type: 'stdio' }>) {}

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      const env = this.config.env
        ? { ...process.env, ...this.config.env }
        : process.env;

      this.process = spawn(this.config.command, this.config.args ?? [], {
        cwd: this.config.cwd,
        env: env as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.on('error', (err) => {
        this.connected = false;
        reject(new Error(`Failed to spawn process "${this.config.command}": ${err.message}`));
      });

      this.process.stdout!.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString('utf8');
        this.flushBuffer();
      });

      this.process.stderr!.on('data', (_chunk: Buffer) => {
        // stderr is informational; ignore for protocol
      });

      this.process.on('exit', (code) => {
        this.connected = false;
        const reason = `Process exited with code ${code}`;
        for (const pending of this.pendingRequests.values()) {
          pending.reject(new Error(reason));
        }
        this.pendingRequests.clear();
      });

      // Give the process a tick to fail on spawn errors
      setImmediate(() => {
        if (this.process && !this.process.killed) {
          this.connected = true;
          resolve();
        }
      });
    });
  }

  private flushBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as MCPJsonRpcResponse | MCPJsonRpcNotification;
        if ('id' in msg && msg.id !== undefined && msg.id !== null) {
          const pending = this.pendingRequests.get((msg as MCPJsonRpcResponse).id);
          if (pending) {
            this.pendingRequests.delete((msg as MCPJsonRpcResponse).id);
            pending.resolve(msg as MCPJsonRpcResponse);
          }
        } else if ('method' in msg) {
          this.notificationHandler?.(msg as MCPJsonRpcNotification);
        }
      } catch {
        // Malformed JSON — skip
      }
    }
  }

  async disconnect(): Promise<void> {
    if (!this.process) return;
    this.connected = false;
    this.process.kill();
    this.process = null;
    this.pendingRequests.clear();
  }

  async send(message: MCPJsonRpcRequest): Promise<MCPJsonRpcResponse> {
    if (!this.connected || !this.process) {
      throw new Error('StdioTransport is not connected');
    }
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, { resolve, reject });
      const line = JSON.stringify(message) + '\n';
      this.process!.stdin!.write(line, (err) => {
        if (err) {
          this.pendingRequests.delete(message.id);
          reject(new Error(`Failed to write to stdin: ${err.message}`));
        }
      });
    });
  }

  onNotification(handler: (notification: MCPJsonRpcNotification) => void): void {
    this.notificationHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// === HttpTransport ===

export class HttpTransport implements MCPTransport {
  private connected = false;

  constructor(private readonly config: Extract<MCPTransportConfig, { type: 'http' }>) {}

  async connect(): Promise<void> {
    // HTTP is stateless; mark connected immediately
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async send(message: MCPJsonRpcRequest): Promise<MCPJsonRpcResponse> {
    if (!this.connected) {
      throw new Error('HttpTransport is not connected');
    }

    const timeout = this.config.timeout ?? 30_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `HTTP request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as MCPJsonRpcResponse;
      return data;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`HTTP request timed out after ${timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// === SSETransport ===

interface PendingSSERequest {
  resolve: (res: MCPJsonRpcResponse) => void;
  reject: (err: Error) => void;
}

export class SSETransport implements MCPTransport {
  private connected = false;
  private pendingRequests = new Map<string | number, PendingSSERequest>();
  private notificationHandler: ((n: MCPJsonRpcNotification) => void) | undefined;
  private abortController: AbortController | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageEndpoint: string;

  constructor(private readonly config: Extract<MCPTransportConfig, { type: 'sse' }>) {
    // Convention: SSE messages are sent via POST to <url>/message
    const base = config.url.replace(/\/$/, '');
    this.messageEndpoint = `${base}/message`;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.openSSEStream();
  }

  private async openSSEStream(): Promise<void> {
    this.abortController = new AbortController();

    const response = await fetch(this.config.url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...this.config.headers,
      },
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(
        `SSE connection failed: ${response.status} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error('SSE response has no body');
    }

    this.connected = true;
    this.reconnectAttempts = 0;

    // Parse SSE stream asynchronously
    void this.parseSSEStream(response.body);
  }

  private async parseSSEStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    const reader = body.getReader();
    let buffer = '';
    let eventData = '';
    let eventType = 'message';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line === '') {
            // Dispatch event
            if (eventData) {
              this.handleSSEEvent(eventType, eventData);
            }
            eventData = '';
            eventType = 'message';
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trimStart();
            eventData = eventData ? `${eventData}\n${data}` : data;
          } else if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          }
          // id: and retry: fields are parsed but not used in this implementation
        }
      }
    } catch (err) {
      const error = err as Error;
      if (error.name === 'AbortError') return;

      this.connected = false;
      await this.scheduleReconnect();
    } finally {
      reader.releaseLock();
    }

    // Stream ended normally — attempt reconnect
    if (this.connected) {
      this.connected = false;
      await this.scheduleReconnect();
    }
  }

  private handleSSEEvent(eventType: string, data: string): void {
    try {
      const msg = JSON.parse(data) as MCPJsonRpcResponse | MCPJsonRpcNotification;

      if ('id' in msg && msg.id !== undefined && msg.id !== null) {
        const pending = this.pendingRequests.get((msg as MCPJsonRpcResponse).id);
        if (pending) {
          this.pendingRequests.delete((msg as MCPJsonRpcResponse).id);
          pending.resolve(msg as MCPJsonRpcResponse);
        }
      } else if ('method' in msg && eventType !== 'response') {
        this.notificationHandler?.(msg as MCPJsonRpcNotification);
      }
    } catch {
      // Malformed JSON — skip
    }
  }

  private async scheduleReconnect(): Promise<void> {
    const maxAttempts = this.config.maxReconnectAttempts ?? 5;
    const interval = this.config.reconnectInterval ?? 3_000;

    if (this.reconnectAttempts >= maxAttempts) {
      const err = new Error(
        `SSE reconnection failed after ${maxAttempts} attempts`
      );
      for (const pending of this.pendingRequests.values()) {
        pending.reject(err);
      }
      this.pendingRequests.clear();
      return;
    }

    this.reconnectAttempts++;
    await new Promise<void>((resolve) => {
      this.reconnectTimer = setTimeout(resolve, interval);
    });

    try {
      await this.openSSEStream();
    } catch {
      await this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error('SSETransport disconnected'));
    }
    this.pendingRequests.clear();
  }

  async send(message: MCPJsonRpcRequest): Promise<MCPJsonRpcResponse> {
    if (!this.connected) {
      throw new Error('SSETransport is not connected');
    }

    // For SSE, responses arrive via the SSE stream; we POST the request separately
    return new Promise(async (resolve, reject) => {
      this.pendingRequests.set(message.id, { resolve, reject });
      try {
        const response = await fetch(this.messageEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
          },
          body: JSON.stringify(message),
        });
        if (!response.ok) {
          this.pendingRequests.delete(message.id);
          reject(
            new Error(
              `SSE message POST failed: ${response.status} ${response.statusText}`
            )
          );
        }
      } catch (err) {
        this.pendingRequests.delete(message.id);
        reject(err);
      }
    });
  }

  onNotification(handler: (notification: MCPJsonRpcNotification) => void): void {
    this.notificationHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// === Factory ===

function createTransport(config: MCPTransportConfig): MCPTransport {
  switch (config.type) {
    case 'stdio':
      return new StdioTransport(config);
    case 'http':
      return new HttpTransport(config);
    case 'sse':
      return new SSETransport(config);
  }
}

// === MCP Client Class ===

export class MCPClient {
  private transport: MCPTransport;
  private config: MCPClientConfig;
  private state: MCPConnectionState = 'disconnected';
  private serverInfo: { name: string; version: string } | null = null;
  private eventHandlers: Set<MCPClientEventHandler> = new Set();
  private requestCounter = 0;

  constructor(config: MCPClientConfig) {
    // Validate transport config
    mcpTransportConfigSchema.parse(config.transport);
    this.config = config;
    this.transport = createTransport(config.transport);

    // Wire up notifications
    this.transport.onNotification?.((notification) => {
      if (notification.method === 'notifications/tools/list_changed') {
        this.emit({ type: 'toolsChanged' });
      } else if (notification.method === 'notifications/resources/list_changed') {
        this.emit({ type: 'resourcesChanged' });
      }
    });
  }

  // === Lifecycle ===

  async connect(): Promise<void> {
    if (this.state === 'connected') return;

    this.state = 'connecting';
    try {
      await this.transport.connect();

      // MCP initialize handshake
      const initResult = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: this.config.capabilities?.tools !== false ? {} : undefined,
          resources: this.config.capabilities?.resources !== false ? {} : undefined,
          prompts: this.config.capabilities?.prompts !== false ? {} : undefined,
        },
        clientInfo: this.config.clientInfo ?? {
          name: 'agentforge-mcp-client',
          version: '1.0.0',
        },
      });

      const init = initResult as {
        protocolVersion: string;
        serverInfo: { name: string; version: string };
        capabilities?: Record<string, unknown>;
      };

      this.serverInfo = init.serverInfo;
      this.state = 'connected';

      // Send initialized notification (fire-and-forget)
      void this.sendNotification('notifications/initialized');

      this.emit({ type: 'connected', serverInfo: this.serverInfo });
    } catch (err) {
      this.state = 'error';
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
    this.state = 'disconnected';
    this.serverInfo = null;
    this.emit({ type: 'disconnected' });
  }

  getState(): MCPConnectionState {
    return this.state;
  }

  getServerInfo(): { name: string; version: string } | null {
    return this.serverInfo;
  }

  // === MCP Protocol Methods ===

  async listTools(): Promise<MCPToolDefinition[]> {
    const result = await this.sendRequest('tools/list');
    const typed = result as { tools: MCPToolDefinition[] };
    return typed.tools ?? [];
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<MCPToolResult> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args ?? {},
    });
    return result as MCPToolResult;
  }

  async listResources(): Promise<MCPResourceDefinition[]> {
    const result = await this.sendRequest('resources/list');
    const typed = result as { resources: MCPResourceDefinition[] };
    return typed.resources ?? [];
  }

  async readResource(uri: string): Promise<MCPResourceContent[]> {
    const result = await this.sendRequest('resources/read', { uri });
    const typed = result as { contents: MCPResourceContent[] };
    return typed.contents ?? [];
  }

  async listPrompts(): Promise<MCPPromptDefinition[]> {
    const result = await this.sendRequest('prompts/list');
    const typed = result as { prompts: MCPPromptDefinition[] };
    return typed.prompts ?? [];
  }

  async getPrompt(
    name: string,
    args?: Record<string, unknown>
  ): Promise<MCPPromptMessage[]> {
    const result = await this.sendRequest('prompts/get', {
      name,
      arguments: args ?? {},
    });
    const typed = result as { messages: MCPPromptMessage[] };
    return typed.messages ?? [];
  }

  // === Events ===

  on(handler: MCPClientEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  // === Internal ===

  private nextId(): string {
    this.requestCounter++;
    return crypto.randomUUID();
  }

  private async sendRequest(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const timeout = this.config.requestTimeout ?? 30_000;
    const id = this.nextId();

    const request: MCPJsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    const responsePromise = this.transport.send(request);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Request "${method}" timed out after ${timeout}ms`)),
        timeout
      )
    );

    const response = await Promise.race([responsePromise, timeoutPromise]);

    if (response.error) {
      throw new Error(
        `MCP error ${response.error.code}: ${response.error.message}`
      );
    }

    return response.result;
  }

  private async sendNotification(
    method: string,
    params?: Record<string, unknown>
  ): Promise<void> {
    // Notifications have no id and expect no response.
    // We construct a minimal message. For transports that require a request/response
    // cycle we send with a throwaway id and discard the response.
    const notification: MCPJsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined ? { params } : {}),
    };

    // HttpTransport and SSETransport require a JSON-RPC request with id.
    // We send as a request with a synthetic id and silently ignore the response.
    if (this.transport instanceof HttpTransport || this.transport instanceof SSETransport) {
      try {
        await this.transport.send({
          ...notification,
          id: crypto.randomUUID(),
        } as MCPJsonRpcRequest);
      } catch {
        // Notifications are fire-and-forget; swallow errors
      }
    } else if (this.transport instanceof StdioTransport) {
      // For stdio we can write the raw notification (no id)
      await this.transport.send({
        ...notification,
        id: crypto.randomUUID(),
      } as MCPJsonRpcRequest);
    }
  }

  private emit(event: MCPClientEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Swallow handler errors
      }
    }
  }
}
