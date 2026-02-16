# NPM Publish Instructions for v0.3.0

## Prerequisites

1. **npm Account**: Ensure you have access to the `@agentforge-ai` organization on npm
2. **npm Authentication**: Run `npm login` to authenticate
3. **Build Completed**: Packages are already built

## Publishing Steps

### 1. Verify Builds

```bash
# Check that builds are successful
ls -la packages/core/dist
ls -la packages/cli/dist
```

Expected output:
- `packages/core/dist/` should contain `.js`, `.d.ts`, and `.map` files
- `packages/cli/dist/` should contain `index.js`, `index.d.ts`, and `.map` files

### 2. Publish Core Package

```bash
cd packages/core
npm publish --access public
```

Expected output:
```
+ @agentforge-ai/core@0.3.0
```

### 3. Publish CLI Package

```bash
cd ../cli
npm publish --access public
```

Expected output:
```
+ @agentforge-ai/cli@0.3.0
```

### 4. Publish Web Package (Optional)

The web package is currently for development only and doesn't need to be published to npm. Users will clone the repo to use the dashboard.

If you want to publish it later:

```bash
cd ../web
pnpm build
npm publish --access public
```

### 5. Verify Publication

Visit npm to verify:
- https://www.npmjs.com/package/@agentforge-ai/core
- https://www.npmjs.com/package/@agentforge-ai/cli

Check that version 0.3.0 is listed.

### 6. Test Installation

```bash
# Create a test directory
mkdir /tmp/test-agentforge
cd /tmp/test-agentforge

# Install the CLI
npm install -g @agentforge-ai/cli@0.3.0

# Verify version
agentforge --version
# Should output: 0.3.0

# Create a test project
agentforge create test-project
cd test-project

# Verify core package
cat package.json | grep @agentforge-ai/core
# Should show: "@agentforge-ai/core": "^0.3.0"
```

## Troubleshooting

### Authentication Error

```bash
npm login
```

Enter your npm credentials.

### Permission Error

Ensure you have publish access to the `@agentforge-ai` organization:

```bash
npm access ls-packages @agentforge-ai
```

If you don't have access, ask the organization owner to add you:

```bash
npm owner add <your-username> @agentforge-ai/core
npm owner add <your-username> @agentforge-ai/cli
```

### Build Error

If builds fail, run:

```bash
cd packages/core
pnpm install
pnpm build

cd ../cli
pnpm install
pnpm build
```

### Version Conflict

If npm says the version already exists:

1. Check if v0.3.0 is already published
2. If it is, you can't republish the same version
3. If you need to make changes, bump to v0.3.1

## Post-Publication

### 1. Update Documentation

Ensure the following links work:
- npm package pages
- Installation instructions in README
- Getting started guide

### 2. Announce Release

- GitHub Releases: https://github.com/Agentic-Engineering-Agency/agentforge/releases
- Twitter/X: @AgenticEng
- Discord: Coming soon
- Email newsletter: Coming soon

### 3. Monitor Issues

Watch for:
- Installation issues
- Breaking changes
- Bug reports

## GitHub Release

Create a GitHub release:

1. Go to https://github.com/Agentic-Engineering-Agency/agentforge/releases
2. Click "Draft a new release"
3. Choose tag: `v0.3.0`
4. Release title: `v0.3.0 - Web Dashboard, Mastra Integration, and Comprehensive Backend`
5. Copy content from `RELEASE_v0.3.0.md`
6. Attach any relevant files (optional)
7. Click "Publish release"

## Rollback (If Needed)

If there's a critical issue:

```bash
# Deprecate the version
npm deprecate @agentforge-ai/core@0.3.0 "Critical bug, use 0.3.1 instead"
npm deprecate @agentforge-ai/cli@0.3.0 "Critical bug, use 0.3.1 instead"

# Publish a patch version
# ... bump version to 0.3.1
# ... fix the issue
# ... publish 0.3.1
```

## Checklist

- [ ] Builds are successful
- [ ] npm authentication is set up
- [ ] Published `@agentforge-ai/core@0.3.0`
- [ ] Published `@agentforge-ai/cli@0.3.0`
- [ ] Verified on npm website
- [ ] Tested installation
- [ ] Created GitHub release
- [ ] Updated documentation
- [ ] Announced release

## Notes

- The web package (`@agentforge-ai/web`) is not published to npm in this release
- Users will clone the repo to use the web dashboard
- Future releases may include a standalone web package or Docker image

## Support

If you encounter any issues during publishing:

- Email: hello@agenticengineering.agency
- GitHub Issues: https://github.com/Agentic-Engineering-Agency/agentforge/issues
