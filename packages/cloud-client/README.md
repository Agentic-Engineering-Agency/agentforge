# @agentforge-ai/cloud-client

HTTP client library for deploying agents to AgentForge Cloud.

## Installation

```bash
npm install @agentforge-ai/cloud-client
```

## Usage

```typescript
import { CloudClient } from '@agentforge-ai/cloud-client';

// Initialize client
const client = new CloudClient({
  apiKey: 'cloud_sk_your_api_key',
});

// Authenticate (validate API key)
await client.authenticate();

// Deploy a project
const deployment = await client.deployCLIProject({
  name: 'my-project',
  version: '1.0.0',
  agents: [
    {
      id: 'my-agent',
      name: 'My Agent',
      model: 'gpt-4o',
      instructions: 'You are a helpful assistant.',
    },
  ],
});

console.log(`Deployed to: ${deployment.url}`);
```

## API Reference

### `CloudClient`

#### Constructor

```typescript
new CloudClient(config: {
  apiKey: string;
  baseUrl?: string; // defaults to https://cloud.agentforge.io
})
```

#### Methods

- `authenticate(apiKey?: string): Promise<void>` - Validate API key
- `createAgent(config: AgentConfig): Promise<CloudAgent>` - Create a single agent
- `deployCLIProject(project: CLIProject): Promise<Deployment>` - Deploy a full project
- `getDeploymentStatus(deploymentId: string): Promise<Deployment>` - Check deployment status
- `listDeployments(): Promise<Deployment[]>` - List all deployments

### Types

#### `AgentConfig`

```typescript
interface AgentConfig {
  id: string;
  name: string;
  model: string;        // e.g., 'gpt-4o' or 'openai:gpt-4o'
  instructions: string; // system prompt
  tools?: ToolConfig[];
}
```

#### `CLIProject`

```typescript
interface CLIProject {
  name: string;
  version?: string;
  agents: AgentConfig[];
  env?: Record<string, string>;
}
```

#### `Deployment`

```typescript
interface Deployment {
  id: string;
  agentId: string;
  status: 'pending' | 'building' | 'deploying' | 'ready' | 'failed';
  url?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}
```

## Error Handling

```typescript
import { CloudClient, CloudAPIError } from '@agentforge-ai/cloud-client';

try {
  await client.authenticate();
} catch (error) {
  if (error instanceof CloudAPIError) {
    console.error(`API Error ${error.statusCode}: ${error.message}`);
    console.error(`Error Code: ${error.code}`);
  }
}
```

## License

Apache-2.0
