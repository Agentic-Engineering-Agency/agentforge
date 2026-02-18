import type { Credentials } from './credentials.js';
import { getCloudUrl, getApiKey, readCredentials } from './credentials.js';

/**
 * AgentForge Cloud API Client
 * 
 * Handles all HTTP communication with the AgentForge Cloud API.
 * Supports both REST API endpoints and Convex HTTP actions.
 */

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentConfig {
  id?: string;
  name: string;
  description?: string;
  instructions: string;
  model: string;
  provider?: string;
  tools?: any;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  config?: Record<string, any>;
}

export interface Deployment {
  id: string;
  projectId: string;
  status: 'pending' | 'building' | 'deploying' | 'completed' | 'failed' | 'rolled_back';
  version: string;
  agents: AgentConfig[];
  url?: string;
  createdAt: number;
  updatedAt: number;
  errorMessage?: string;
}

export interface CreateDeploymentRequest {
  projectId: string;
  agents: AgentConfig[];
  version: string;
}

export interface CreateDeploymentResponse {
  deploymentId: string;
  status: string;
  url?: string;
}

export interface DeploymentStatusResponse {
  id: string;
  status: string;
  url?: string;
  errorMessage?: string;
  progress?: number;
}

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
}

export interface CloudApiError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Cloud API Error class for typed error handling
 */
export class CloudClientError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'CloudClientError';
  }
}

/**
 * AgentForge Cloud API Client
 */
export class CloudClient {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || 'https://cloud.agentforge.ai';
    this.apiKey = apiKey || null;
  }

  /**
   * Initialize the client with stored credentials
   */
  async initialize(): Promise<void> {
    this.baseUrl = await getCloudUrl();
    this.apiKey = await getApiKey();
  }

  /**
   * Set the API key directly
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Set the base URL directly
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Get the full API URL for an endpoint
   */
  private getUrl(endpoint: string): string {
    const base = this.baseUrl.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
  }

  /**
   * Get request headers with authentication
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Version': '0.5.1',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Make an HTTP request to the Cloud API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = this.getUrl(endpoint);
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (error: any) {
      throw new CloudClientError(
        `Network error: ${error.message || 'Failed to connect to AgentForge Cloud'}`,
        'NETWORK_ERROR'
      );
    }

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      const errorBody: CloudApiError | null = isJson ? (await response.json()) as CloudApiError : null;
      const message = errorBody?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new CloudClientError(
        message,
        errorBody?.code || `HTTP_${response.status}`,
        response.status
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    if (!isJson) {
      const text = await response.text();
      return { text } as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Check if credentials are valid
   */
  async authenticate(): Promise<UserInfo> {
    if (!this.apiKey) {
      throw new CloudClientError(
        'No API key configured. Run "agentforge login" to authenticate.',
        'NO_CREDENTIALS',
        401
      );
    }

    try {
      const user = await this.request<UserInfo>('GET', '/api/auth/me');
      return user;
    } catch (error: any) {
      if (error.status === 401) {
        throw new CloudClientError(
          'Invalid API key. Run "agentforge login" to re-authenticate.',
          'UNAUTHORIZED',
          401
        );
      }
      throw error;
    }
  }

  /**
   * List all projects for the authenticated user
   */
  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>('GET', '/api/projects');
  }

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>('GET', `/api/projects/${projectId}`);
  }

  /**
   * Upload agent configuration to Cloud
   */
  async uploadAgentConfig(
    projectId: string,
    agentConfig: AgentConfig
  ): Promise<{ agentId: string }> {
    return this.request<{ agentId: string }>(
      'POST',
      `/api/projects/${projectId}/agents`,
      agentConfig
    );
  }

  /**
   * Create a new deployment
   */
  async createDeployment(
    request: CreateDeploymentRequest
  ): Promise<CreateDeploymentResponse> {
    return this.request<CreateDeploymentResponse>(
      'POST',
      '/api/deployments/create',
      request
    );
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(
    deploymentId: string
  ): Promise<DeploymentStatusResponse> {
    return this.request<DeploymentStatusResponse>(
      'GET',
      `/api/deployments/${deploymentId}/status`
    );
  }

  /**
   * Get deployment details
   */
  async getDeployment(deploymentId: string): Promise<Deployment> {
    return this.request<Deployment>('GET', `/api/deployments/${deploymentId}`);
  }

  /**
   * Rollback a deployment
   */
  async rollbackDeployment(deploymentId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      'POST',
      `/api/deployments/${deploymentId}/rollback`
    );
  }

  /**
   * List deployments for a project
   */
  async listDeployments(projectId: string): Promise<Deployment[]> {
    return this.request<Deployment[]>('GET', `/api/projects/${projectId}/deployments`);
  }
}

/**
 * Create a CloudClient with credentials from storage
 */
export async function createCloudClient(): Promise<CloudClient> {
  const client = new CloudClient();
  await client.initialize();
  return client;
}
