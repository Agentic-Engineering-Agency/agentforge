# MCP Troubleshooting

## First checks

- Confirm `npx -y convex@latest mcp start` runs locally.
- Confirm required environment variables are present when talking to a deployment.
- Confirm the task actually needs MCP, not just normal `convex dev`.

## Common mistakes

- Using `convex deploy` as a development step.
- Assuming agent mode is required for local work.
- Treating Cursor plugin files as if they are portable runtime config for this repo.

## Decision rule

- If the need is schema and function iteration, use normal Convex development.
- If the need is deployment introspection or MCP-based tooling, set up MCP explicitly.
