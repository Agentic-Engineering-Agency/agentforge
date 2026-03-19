---
title: "Deployment Guide"
description: "Deploy your AgentForge project to production using the CLI, CI/CD, or manual Convex deployment."
---

# Deployment Guide

This guide covers deploying your AgentForge project to production.

## Prerequisites

- A Convex account (https://convex.dev)
- The Convex CLI installed (`npm install -g convex`)
- An AgentForge project created with `agentforge create`

## 1. Production Environment File

Create a `.env.production` file in the root of your project. This file will contain the environment variables for your production deployment.

```.env.production
# .env.production

OPENAI_API_KEY="sk-..."
# Other production secrets
```

**IMPORTANT**: Do not commit this file to version control. Add `.env.production` to your `.gitignore` file.

## 2. Deploying with the CLI

The easiest way to deploy is with the `agentforge deploy` command.

```bash
agentforge deploy
```

This command will:

1.  Read the variables from your `.env.production` file.
2.  Push them to your Convex production environment.
3.  Deploy your Convex backend (`convex/` directory).

### Dry Run

To preview what will be deployed without making any changes, use the `--dry-run` flag:

```bash
agentforge deploy --dry-run
```

### Rollback

If a deployment introduces a bug, you can quickly revert to the previous version:

```bash
agentforge deploy --rollback
```

## 3. CI/CD Deployment

For automated deployments (e.g., from GitHub Actions), you can use the `--force` flag to skip interactive prompts.

You will also need to set your Convex deployment credentials as secrets in your CI/CD environment.

- `CONVEX_DEPLOY_KEY`: Your Convex deployment key.

### Example GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml

name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Install AgentForge CLI
        run: pnpm add -g @agentforge-ai/cli

      - name: Create production env file
        run: |
          echo "OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}" > .env.production

      - name: Deploy to Convex
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
        run: agentforge deploy --force
```

## 4. Manual Deployment

If you prefer to deploy manually, you can use the Convex CLI directly.

1.  **Set Environment Variables**

    ```bash
    npx convex env set OPENAI_API_KEY "your-key"
    ```

2.  **Deploy**

    ```bash
    npx convex deploy
    ```
