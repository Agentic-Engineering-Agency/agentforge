# Runtime Map

## Key entrypoints

- `createStandardAgent()`: standard Mastra agent factory with memory and input processors.
- `AgentForgeDaemon`: agent registry plus channel orchestration.
- `HttpChannel`: OpenAI-compatible HTTP and SSE surface.

## Common tasks

- adding a new reusable runtime tool,
- changing default memory behavior,
- extending daemon startup or env validation,
- refining channel transport behavior.
