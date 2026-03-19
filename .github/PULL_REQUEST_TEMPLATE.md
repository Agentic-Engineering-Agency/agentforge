## Summary

<!-- Brief description of what this PR does and why -->

## Changes

<!-- Bulleted list of key changes -->

-

## Related Issues

<!-- Link related issues: Fixes #123, Closes #456 -->

## Checklist

- [ ] `pnpm test` passes (all packages)
- [ ] `pnpm typecheck` passes (0 errors)
- [ ] No hardcoded secrets in diff

## Template Sync

<!-- If you changed any Convex or dashboard template files -->

- [ ] Changes applied to all 3 git-tracked locations (or N/A)
- [ ] `pnpm sync-templates` ran successfully (or N/A)

## Screenshots

<!-- If this PR includes UI changes, add before/after screenshots -->

## Security Checklist

<!-- If your PR touches auth, crypto, API keys, or public endpoints -->

- [ ] Sensitive operations use `internalMutation` / `internalAction` (not public)
- [ ] No secrets in logs or client-facing responses
- [ ] `pnpm audit` shows 0 high/critical vulnerabilities (or N/A)
