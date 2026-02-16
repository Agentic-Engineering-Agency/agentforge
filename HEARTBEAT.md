# AgentForge Heartbeat System

The Heartbeat system allows agents to maintain continuity across sessions, check on ongoing conversations, and resume unfinished tasks automatically.

## Overview

Similar to OpenClaw's HEARTBEAT.md, AgentForge implements a heartbeat mechanism that enables agents to:

1. **Check on ongoing conversations** - Periodically review active threads
2. **Resume unfinished tasks** - Continue work that was interrupted
3. **Maintain context** - Preserve conversation state across sessions
4. **Schedule follow-ups** - Set reminders for future actions

## How It Works

### 1. Heartbeat Registration

When an agent starts a conversation or task, it can register a heartbeat:

```typescript
import { api } from "./convex/_generated/api";

// Register a heartbeat for an ongoing task
await ctx.runMutation(api.heartbeat.register, {
  agentId: "my-agent",
  threadId: "thread_123",
  taskDescription: "Analyzing quarterly sales data",
  checkInterval: 3600, // Check every hour (in seconds)
  expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Expires in 24 hours
});
```

### 2. Heartbeat Checks

The system periodically checks for heartbeats that need attention:

```typescript
// Get pending heartbeats
const pending = await ctx.runQuery(api.heartbeat.getPending, {
  agentId: "my-agent",
});

for (const heartbeat of pending) {
  // Check the thread status
  const thread = await ctx.runQuery(api.threads.get, {
    id: heartbeat.threadId,
  });
  
  // Resume work if needed
  if (thread.status === "pending") {
    await resumeTask(heartbeat);
  }
}
```

### 3. Task Resumption

When a heartbeat triggers, the agent can resume its work:

```typescript
async function resumeTask(heartbeat: Heartbeat) {
  // Get conversation history
  const messages = await ctx.runQuery(api.messages.list, {
    threadId: heartbeat.threadId,
  });
  
  // Build context from history
  const context = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  
  // Continue the task
  const result = await ctx.runAction(api.mastraIntegration.executeAgent, {
    agentId: heartbeat.agentId,
    prompt: `Continue the following task: ${heartbeat.taskDescription}\n\nContext:\n${context}`,
    threadId: heartbeat.threadId,
  });
  
  // Update heartbeat status
  await ctx.runMutation(api.heartbeat.updateStatus, {
    id: heartbeat._id,
    status: "completed",
  });
}
```

## Use Cases

### 1. Long-Running Analysis

```typescript
// Agent starts a data analysis task
const threadId = await startAnalysis();

// Register heartbeat to check progress
await ctx.runMutation(api.heartbeat.register, {
  agentId: "data-analyst",
  threadId,
  taskDescription: "Analyzing customer churn patterns",
  checkInterval: 1800, // Check every 30 minutes
  expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

### 2. Scheduled Follow-ups

```typescript
// Agent schedules a follow-up after customer inquiry
await ctx.runMutation(api.heartbeat.register, {
  agentId: "customer-support",
  threadId: customerThreadId,
  taskDescription: "Follow up on customer issue #1234",
  checkInterval: 86400, // Check daily
  expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days
});
```

### 3. Workflow Continuity

```typescript
// Multi-step workflow with heartbeat checkpoints
const workflow = [
  { step: "data-collection", duration: 3600 },
  { step: "analysis", duration: 7200 },
  { step: "report-generation", duration: 1800 },
];

for (const step of workflow) {
  await ctx.runMutation(api.heartbeat.register, {
    agentId: "workflow-agent",
    threadId: workflowThreadId,
    taskDescription: `Complete ${step.step}`,
    checkInterval: step.duration,
    expiresAt: Date.now() + step.duration * 2,
  });
}
```

## Heartbeat States

| State | Description |
|-------|-------------|
| `pending` | Heartbeat is active and waiting for next check |
| `checking` | Heartbeat check is in progress |
| `completed` | Task associated with heartbeat is complete |
| `failed` | Heartbeat check or task resumption failed |
| `expired` | Heartbeat has passed its expiration time |

## Configuration

### Global Settings

Configure heartbeat behavior in your Convex functions:

```typescript
// convex/config.ts
export const heartbeatConfig = {
  defaultCheckInterval: 3600, // 1 hour
  maxCheckInterval: 86400, // 24 hours
  minCheckInterval: 300, // 5 minutes
  defaultExpiration: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxConcurrentChecks: 10,
};
```

### Per-Agent Settings

Override settings for specific agents:

```typescript
const agent = await ctx.runQuery(api.agents.get, { id: "my-agent" });

await ctx.runMutation(api.heartbeat.register, {
  agentId: agent.id,
  threadId,
  taskDescription: "Custom task",
  checkInterval: agent.heartbeatInterval || 3600,
  expiresAt: Date.now() + (agent.heartbeatExpiration || 7 * 24 * 60 * 60 * 1000),
});
```

## Cron Integration

Heartbeats can be triggered by cron jobs for scheduled checks:

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check-heartbeats",
  { minutes: 5 }, // Check every 5 minutes
  internal.heartbeat.checkPending
);

export default crons;
```

## Best Practices

1. **Set Appropriate Intervals**: Choose check intervals based on task urgency
2. **Use Expiration Times**: Always set expiration to prevent indefinite checks
3. **Handle Failures Gracefully**: Implement retry logic for failed checks
4. **Clean Up Completed Heartbeats**: Remove old heartbeats to keep database clean
5. **Monitor Heartbeat Health**: Track heartbeat success rates and failures
6. **Limit Concurrent Checks**: Prevent system overload with rate limiting

## Monitoring

Track heartbeat health with usage queries:

```typescript
// Get heartbeat statistics
const stats = await ctx.runQuery(api.heartbeat.getStats, {
  agentId: "my-agent",
  startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
});

console.log({
  total: stats.total,
  pending: stats.pending,
  completed: stats.completed,
  failed: stats.failed,
  expired: stats.expired,
  successRate: (stats.completed / stats.total) * 100,
});
```

## Cleanup

Automatically clean up old heartbeats:

```typescript
// Run daily cleanup
crons.daily(
  "cleanup-heartbeats",
  { hourUTC: 2 }, // Run at 2 AM UTC
  internal.heartbeat.cleanup,
  {
    olderThan: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days
  }
);
```

## Advanced Features

### Conditional Heartbeats

Only trigger heartbeat if certain conditions are met:

```typescript
await ctx.runMutation(api.heartbeat.register, {
  agentId: "conditional-agent",
  threadId,
  taskDescription: "Check if data is ready",
  checkInterval: 600,
  expiresAt: Date.now() + 3600000,
  condition: {
    type: "query",
    query: "SELECT COUNT(*) FROM data WHERE status = 'ready'",
    expectedValue: "> 0",
  },
});
```

### Cascading Heartbeats

Create dependent heartbeats:

```typescript
const parentHeartbeat = await ctx.runMutation(api.heartbeat.register, {
  agentId: "parent-agent",
  threadId: parentThreadId,
  taskDescription: "Parent task",
  checkInterval: 3600,
});

await ctx.runMutation(api.heartbeat.register, {
  agentId: "child-agent",
  threadId: childThreadId,
  taskDescription: "Child task (depends on parent)",
  checkInterval: 1800,
  parentHeartbeatId: parentHeartbeat,
});
```

## Troubleshooting

### Heartbeat Not Triggering

1. Check that cron job is running
2. Verify `checkInterval` and `expiresAt` are correct
3. Ensure agent is active
4. Check for errors in heartbeat logs

### High Failure Rate

1. Review agent instructions and context
2. Check API key validity
3. Verify network connectivity
4. Increase retry attempts

### Memory Issues

1. Reduce concurrent heartbeat checks
2. Clean up old heartbeats more frequently
3. Limit message history in context

## Examples

See the [examples/heartbeat](examples/heartbeat/) directory for complete examples:

- [Basic Heartbeat](examples/heartbeat/basic.ts)
- [Scheduled Follow-up](examples/heartbeat/follow-up.ts)
- [Workflow Continuity](examples/heartbeat/workflow.ts)
- [Conditional Heartbeat](examples/heartbeat/conditional.ts)

## References

- [Convex Cron Jobs](https://docs.convex.dev/scheduling/cron-jobs)
- [Mastra Workflows](https://mastra.ai/docs/workflows)
- [OpenClaw HEARTBEAT.md](https://github.com/safeclaw/openclaw/blob/main/HEARTBEAT.md)
