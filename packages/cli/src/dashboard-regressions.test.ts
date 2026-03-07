import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const cliRoot = path.resolve(path.dirname(__filename), '..');
const repoRoot = path.resolve(cliRoot, '..', '..');
const templateDashboardRoot = path.join(repoRoot, 'packages/cli/templates/default/dashboard/app/routes');
const templateConvexRoot = path.join(repoRoot, 'packages/cli/templates/default/convex');

describe('dashboard and convex regressions', () => {
  it('uses the shared model catalog instead of route-local hardcoded provider/model lists', () => {
    const agentsSource = readFileSync(path.join(templateDashboardRoot, 'agents.tsx'), 'utf-8');
    const settingsSource = readFileSync(path.join(templateDashboardRoot, 'settings.tsx'), 'utf-8');
    const chatSource = readFileSync(path.join(templateDashboardRoot, 'chat.tsx'), 'utf-8');
    const filesSource = readFileSync(path.join(templateDashboardRoot, 'files.tsx'), 'utf-8');
    const projectsSource = readFileSync(path.join(templateDashboardRoot, 'projects.tsx'), 'utf-8');
    const usageSource = readFileSync(path.join(templateDashboardRoot, 'usage.tsx'), 'utf-8');

    expect(agentsSource).not.toContain('const providers = [');
    expect(agentsSource).not.toContain('const FALLBACK_MODELS');
    expect(agentsSource).toContain('useModelCatalog');

    expect(settingsSource).not.toContain('const AI_PROVIDERS = [');
    expect(settingsSource).not.toContain('const FALLBACK: Record<string, string[]> =');
    expect(settingsSource).toContain('useModelCatalog');

    expect(chatSource).not.toContain('currentAgent?.provider === "openai"');
    expect(chatSource).toContain('providerMeta');

    expect(filesSource).toContain('useConvex');
    expect(filesSource).toContain("convex.query(api.files.getFileUrl, { storageId: file.storageId as string })");
    expect(filesSource).not.toContain("useQuery(api.files.getFileUrl, files.length > 0 && files[0].storageId");
    expect(filesSource).toContain('const confirmUpload = useMutation(api.files.confirmUpload);');
    expect(filesSource).not.toContain('const createFile = useMutation(api.files.create);');
    expect(filesSource).not.toContain('url: uploadUrl.split(\'?\')[0]');

    expect(projectsSource).toContain('stripProviderPrefix');
    expect(projectsSource).toContain('joinProviderModel');

    expect(usageSource).toContain('useModelCatalog');
    expect(usageSource).toContain('activeModels');
    expect(usageSource).not.toContain('const HIDDEN_DEPRECATED_MODELS');
  });

  it('keeps project settings fields in the project schema', () => {
    const schemaSource = readFileSync(path.join(templateConvexRoot, 'schema.ts'), 'utf-8');
    expect(schemaSource).toContain('defaultModel: v.optional(v.string())');
    expect(schemaSource).toContain('defaultProvider: v.optional(v.string())');
    expect(schemaSource).toContain('systemPrompt: v.optional(v.string())');
  });

  it('keeps project settings updates backward-compatible with older dashboard payloads', () => {
    const projectsSource = readFileSync(path.join(templateConvexRoot, 'projects.ts'), 'utf-8');
    expect(projectsSource).toContain('settings: v.optional(');
    expect(projectsSource).toContain('const normalizedSettings = {');
    expect(projectsSource).toContain('...(args.settings ?? {})');
  });

  it('deletes sessions by sessionId rather than the Convex document id', () => {
    const sessionsSource = readFileSync(path.join(templateDashboardRoot, 'sessions.tsx'), 'utf-8');
    expect(sessionsSource).toContain('removeSession({ sessionId: session.sessionId })');
  });

  it('schedules cron jobs when Run now is clicked', () => {
    const cronSource = readFileSync(path.join(templateConvexRoot, 'cronJobs.ts'), 'utf-8');
    expect(cronSource).toContain('export const triggerNow = mutation');
    expect(cronSource).toContain('await ctx.scheduler.runAfter(0, internal.cronJobs.executeJob');
  });

  it('uses current-generation OpenAI defaults across the canonical template', () => {
    const configSource = readFileSync(path.join(repoRoot, 'packages/cli/templates/default/agentforge.config.ts'), 'utf-8');
    const providersSource = readFileSync(path.join(templateConvexRoot, 'llmProviders.ts'), 'utf-8');
    const contextSource = readFileSync(path.join(templateConvexRoot, 'context.ts'), 'utf-8');
    const researchSource = readFileSync(path.join(templateConvexRoot, 'lib/research.ts'), 'utf-8');

    expect(configSource).toContain("defaultModel: 'openai/gpt-5.4'");
    expect(configSource).not.toContain('gpt-4o-mini');
    expect(configSource).not.toContain('gpt-4.1-mini');

    expect(providersSource).toContain('openai/gpt-5.4');
    expect(providersSource).toContain('openai/gpt-5.1-codex-mini');
    expect(providersSource).not.toContain('openai/gpt-4o-mini');
    expect(providersSource).not.toContain('openai/gpt-4.1-mini');

    expect(contextSource).toContain('process.env.OPENAI_SUMMARIZER_MODEL ?? "gpt-5.1-chat-latest"');
    expect(researchSource).toContain('config.modelId ?? "gpt-5.1-chat-latest"');
  });
});
