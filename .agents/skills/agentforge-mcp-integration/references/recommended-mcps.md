# Recommended MCPs for AgentForge Development

## High-value MCPs

- Convex MCP
  - Best for schema, function, and deployment introspection.
  - Command: `npx -y convex@latest mcp start`
  - Source: [Convex docs](https://docs.convex.dev/ai/convex-mcp-server)

- GitHub MCP Server
  - Best for PRs, issues, Actions, repo inspection, and code security context.
  - Official server: [github/github-mcp-server](https://github.com/github/github-mcp-server)

- Cloudflare MCP Server
  - Best for docs and platform operations if AgentForge deployment or Cloudflare primitives are in scope.
  - Source: [cloudflare/mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare)

## Use with caution

- Filesystem MCP servers can be useful, but only with tight path scoping and a clear trust boundary.

## Repo-specific note

AgentForge already has native browser, git, and MCP abstractions. Do not add an external MCP just because one exists; prefer MCPs that add context the repo does not already expose well.
