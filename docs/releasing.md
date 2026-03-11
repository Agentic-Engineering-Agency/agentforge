# Releasing AgentForge

AgentForge release tags track the synchronized npm package version for:

- `@agentforge-ai/cli`
- `@agentforge-ai/core`
- `@agentforge-ai/runtime`

The current release line is `v0.12.22`.

## Prerequisites

- `main` contains the release commit.
- GitHub repository secret `NPM_TOKEN` is configured.
- CI is green for the release commit.

## Release Flow

1. Update the package versions together if they are not already aligned.
2. Merge the release commit to `main`.
3. Create and push the tag:

```bash
git tag v0.12.22
git push origin v0.12.22
```

4. Create or publish the GitHub release for `v0.12.22`.
5. The `Publish Packages` GitHub Actions workflow publishes any missing package versions in order: core, runtime, cli.

## Manual Retry

If the publish workflow needs to be retried after the tag already exists, run `Publish Packages` with the `version` input set to `v0.12.22` or `0.12.22`.

## Notes

- Publishing is idempotent. The workflow skips packages already present on npm at the tagged version.
- The workflow validates that the tag version matches the package versions before publishing.
- `NPM_TOKEN` is required for the publish step; without it the workflow exits with a clear error.
