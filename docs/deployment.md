# Deployment Guide

This guide covers deploying AgentForge to production, with a focus on Cloudflare Pages deployment.

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- Cloudflare account
- Convex account
- API keys for LLM providers

## Convex Deployment

### 1. Create Convex Project

```bash
cd convex
npx convex dev
```

This will prompt you to create a new Convex project or link to an existing one.

### 2. Deploy to Production

```bash
npx convex deploy
```

This will give you a production deployment URL like `https://your-deployment.convex.cloud`.

### 3. Configure Environment Variables

In your Convex dashboard, add environment variables:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`
- `E2B_API_KEY`

## Web Dashboard Deployment

### Option 1: Cloudflare Pages (Recommended)

#### Via GitHub Integration

1. **Connect Repository**
   - Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
   - Click "Create a project"
   - Connect your GitHub account
   - Select the `agentforge` repository

2. **Configure Build Settings**
   - Build command: `cd packages/web && pnpm install && pnpm build`
   - Build output directory: `packages/web/.vinxi/output/public`
   - Root directory: `/`
   - Environment variables: Add all required env vars

3. **Deploy**
   - Click "Save and Deploy"
   - Your site will be available at `https://your-project.pages.dev`

#### Via Wrangler CLI

1. **Install Wrangler**
```bash
npm install -g wrangler
```

2. **Login to Cloudflare**
```bash
wrangler login
```

3. **Build the Project**
```bash
cd packages/web
pnpm build
```

4. **Deploy**
```bash
wrangler pages deploy .vinxi/output/public --project-name=agentforge-web
```

### Option 2: Vercel

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Deploy**
```bash
cd packages/web
vercel
```

3. **Configure Environment Variables**
```bash
vercel env add CONVEX_URL
vercel env add OPENAI_API_KEY
# Add other env vars...
```

### Option 3: Self-Hosted

1. **Build the Project**
```bash
cd packages/web
pnpm build
```

2. **Serve with Node.js**
```bash
node .vinxi/output/server/index.mjs
```

Or use a process manager like PM2:
```bash
pm2 start .vinxi/output/server/index.mjs --name agentforge-web
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `CONVEX_URL` | Convex deployment URL | `https://your-deployment.convex.cloud` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |

### Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-...` |
| `GOOGLE_API_KEY` | Google API key | `...` |
| `XAI_API_KEY` | xAI API key | `xai-...` |
| `E2B_API_KEY` | E2B API key for sandboxes | `e2b_...` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | `...` |
| `R2_ACCESS_KEY_ID` | R2 access key | `...` |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | `...` |
| `R2_BUCKET_NAME` | R2 bucket name | `agentforge-files` |

## Cloudflare R2 Setup (File Storage)

### 1. Create R2 Bucket

```bash
wrangler r2 bucket create agentforge-files
```

### 2. Generate Access Keys

1. Go to Cloudflare Dashboard > R2
2. Click "Manage R2 API Tokens"
3. Create a new API token with read/write permissions
4. Save the Access Key ID and Secret Access Key

### 3. Configure in Convex

Add R2 credentials to your Convex environment variables or use Cloudflare Workers bindings.

## Custom Domain

### Cloudflare Pages

1. Go to your Pages project settings
2. Click "Custom domains"
3. Add your domain (e.g., `app.yourdomain.com`)
4. Follow DNS configuration instructions

### Vercel

1. Go to your project settings
2. Click "Domains"
3. Add your domain
4. Configure DNS records

## SSL/TLS

Both Cloudflare Pages and Vercel provide automatic SSL/TLS certificates. No additional configuration needed.

## Monitoring

### Cloudflare Analytics

Available in the Cloudflare Pages dashboard:
- Page views
- Unique visitors
- Bandwidth usage
- Request count

### Convex Logs

View logs in the Convex dashboard:
- Function execution logs
- Error logs
- Performance metrics

### Sentry (Optional)

Add Sentry for error tracking:

```bash
npm install @sentry/react
```

Configure in your app:

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENVIRONMENT || "development",
});
```

## Scaling

### Cloudflare Pages

- Automatic scaling
- Global CDN distribution
- No configuration needed

### Convex

- Automatic scaling
- Pay-as-you-go pricing
- No infrastructure management

## Backup

### Convex Data

Export data using Convex CLI:

```bash
npx convex export --path ./backup
```

### R2 Files

Use rclone or AWS CLI to backup R2 bucket:

```bash
rclone sync cloudflare:agentforge-files ./backup/files
```

## Rollback

### Cloudflare Pages

1. Go to project deployments
2. Find previous deployment
3. Click "Rollback to this deployment"

### Convex

```bash
npx convex deploy --prod --snapshot <snapshot-id>
```

## Troubleshooting

### Build Fails

1. Check Node.js version (>= 18)
2. Clear build cache: `rm -rf .vinxi node_modules && pnpm install`
3. Check environment variables

### Runtime Errors

1. Check Convex logs
2. Verify environment variables
3. Check API key validity
4. Review Sentry errors (if configured)

### Performance Issues

1. Enable Cloudflare caching
2. Optimize images
3. Use Convex indexes
4. Monitor Convex function execution time

## Security

### API Keys

- Never commit API keys to Git
- Use environment variables
- Rotate keys regularly
- Use separate keys for dev/prod

### CORS

Configure CORS in Convex:

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";

const http = httpRouter();

http.route({
  path: "/api/*",
  method: "GET",
  handler: async (request, { runQuery }) => {
    const response = await runQuery(/* ... */);
    return new Response(JSON.stringify(response), {
      headers: {
        "Access-Control-Allow-Origin": "https://yourdomain.com",
        "Content-Type": "application/json",
      },
    });
  },
});

export default http;
```

### Rate Limiting

Implement rate limiting in Convex actions to prevent abuse.

## Cost Optimization

### Cloudflare Pages

- Free tier: 500 builds/month
- Unlimited bandwidth
- Unlimited requests

### Convex

- Free tier: 1M function calls/month
- Optimize queries to reduce function calls
- Use indexes for faster queries

### R2

- Free tier: 10 GB storage
- $0.015/GB/month after free tier
- No egress fees

## Support

- Documentation: https://github.com/Agentic-Engineering-Agency/agentforge
- Issues: https://github.com/Agentic-Engineering-Agency/agentforge/issues
- Email: hello@agenticengineering.agency
