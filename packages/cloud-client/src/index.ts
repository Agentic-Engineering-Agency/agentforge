/**
 * AgentForge Cloud Client
 *
 * HTTP client for deploying agents to AgentForge Cloud.
 */

export const DEFAULT_CLOUD_URL = 'https://cloud.agentforge.io';

/**
 * Configuration options for the CloudClient
 */
export interface CloudClientConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the Cloud API (defaults to production) */
  baseUrl?: string;
}

/**
 * Agent configuration from the CLI project
 */
export interface AgentConfig {
  /** Unique identifier for the agent */
  id: string;
  /** Human-readable name */
  name: string;
  /** LLM model identifier (e.g., 'gpt-4o') */
  model: string;
  /** System instructions/prompt */
  instructions: string;
  /** Optional tools configuration */
  tools?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
}

/**
 * CLI Project configuration
 */
export interface CLIProject {
  /** Project name */
  name: string;
  /** Project version */
  version?: string;
  /** Agents in the project */
  agents: AgentConfig[];
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Cloud Agent representation (transformed from AgentConfig)
 */
export interface CloudAgent {
  /** Unique identifier */
  agentId: string;
  /** Human-readable name */
  name: string;
  /** Model provider (e.g., 'openai', 'anthropic') */
  provider: string;
  /** Model identifier */
  model: string;
  /** System prompt */
  systemPrompt: string;
  /** Tool configurations */
  tools?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
}

/**
 * Deployment status
 */
export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'ready' | 'failed';

/**
 * Deployment information
 */
export interface Deployment {
  /** Deployment ID */
  id: string;
  /** Agent ID that was deployed */
  agentId: string;
  /** Current status */
  status: DeploymentStatus;
  /** URL where the agent is accessible */
  url?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Error message if failed */
  error?: string;
}

/**
 * API Error response
 */
export interface APIError {
  error: string;
  message: string;
  code?: string;
}

/**
 * HTTP client for AgentForge Cloud API
 */
export class CloudClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: CloudClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_CLOUD_URL;
  }

  /**
   * Make an authenticated request to the Cloud API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw new CloudAPIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }
      return {} as T;
    }

    const data = await response.json() as T | APIError;

    if (!response.ok) {
      const errorData = data as APIError;
      throw new CloudAPIError(
        errorData.message || errorData.error || `HTTP ${response.status}`,
        response.status,
        errorData.code
      );
    }

    return data as T;
  }

  /**
   * Validate the API key by making a test request
   */
  async authenticate(apiKey?: string): Promise<void> {
    const key = apiKey || this.apiKey;
    if (!key) {
      throw new CloudAPIError('API key is required', 401, 'MISSING_API_KEY');
    }

    // Validate API key format
    if (!key.startsWith('cloud_sk_')) {
      throw new CloudAPIError(
        'Invalid API key format. Expected key starting with "cloud_sk_"',
        401,
        'INVALID_API_KEY_FORMAT'
      );
    }

    try {
      // Try to list deployments as a lightweight auth check
      await this.request<{ deployments: Deployment[] }>('GET', '/deployments');
    } catch (error) {
      if (error instanceof CloudAPIError && error.statusCode === 401) {
        throw new CloudAPIError(
          'Invalid API key. Please check your AGENTFORGE_CLOUD_API_KEY environment variable.',
          401,
          'UNAUTHORIZED'
        );
      }
      throw error;
    }
  }

  /**
   * Create a new agent on the Cloud
   */
  async createAgent(config: AgentConfig): Promise<CloudAgent> {
    const cloudConfig = transformAgentConfig(config);
    return this.request<CloudAgent>('POST', '/agents', cloudConfig);
  }

  /**
   * Deploy a CLI project to the Cloud
   */
  async deployCLIProject(project: CLIProject): Promise<Deployment> {
    const cloudAgents = project.agents.map(transformAgentConfig);
    
    return this.request<Deployment>('POST', '/deployments', {
      name: project.name,
      version: project.version,
      agents: cloudAgents,
      env: project.env || {},
    });
  }

  /**
   * Get the status of a deployment
   */
  async getDeploymentStatus(deploymentId: string): Promise<Deployment> {
    return this.request<Deployment>('GET', `/deployments/${deploymentId}`);
  }

  /**
   * List all deployments
   */
  async listDeployments(): Promise<Deployment[]> {
    const response = await this.request<{ deployments: Deployment[] }>('GET', '/deployments');
    return response.deployments || [];
  }
}

/**
 * Custom error class for Cloud API errors
 */
export class CloudAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'CloudAPIError';
  }
}

/**
 * Transform AgentConfig to CloudAgent format
 */
export function transformAgentConfig(config: AgentConfig): CloudAgent {
  // Parse model to extract provider
  let provider = 'openai';
  let model = config.model;

  if (config.model.includes(':')) {
    const [p, m] = config.model.split(':');
    provider = p;
    model = m;
  } else if (config.model.includes('/')) {
    const [p, m] = config.model.split('/');
    provider = p;
    model = m;
  }

  return {
    agentId: config.id,
    name: config.name,
    provider,
    model,
    systemPrompt: config.instructions,
    tools: config.tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  };
}

/**
 * Transform CloudAgent back to AgentConfig format
 */
export function transformToAgentConfig(cloudAgent: CloudAgent): AgentConfig {
  return {
    id: cloudAgent.agentId,
    name: cloudAgent.name,
    model: `${cloudAgent.provider}/${cloudAgent.model}`,
    instructions: cloudAgent.systemPrompt,
    tools: cloudAgent.tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  };
}

// Re-export types
export type { CloudClientConfig as ClientConfig };
