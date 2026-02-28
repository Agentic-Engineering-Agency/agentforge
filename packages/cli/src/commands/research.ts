import type { Command } from 'commander';
import fs from 'fs-extra';
import path from 'node:path';
import { header, success, error, info, dim, colors } from '../lib/display.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResearchOptions {
  topic: string;
  depth?: 'shallow' | 'standard' | 'deep';
  provider?: string;
  model?: string;
  key?: string;
}

// ─── Command Registration ─────────────────────────────────────────────────────

export function registerResearchCommand(program: Command): void {
  program
    .command('research')
    .description('Deep Research Mode — parallel multi-agent research')
    .argument('<topic>', 'Research topic or question')
    .option('-d, --depth <depth>', 'Research depth: shallow, standard, or deep', 'standard')
    .option('-p, --provider <provider>', 'LLM provider (default: openai)', 'openai')
    .option('-m, --model <model>', 'Model to use (default: gpt-4o-mini)', 'gpt-4o-mini')
    .option('-k, --key <key>', 'API key (default: from environment)')
    .action(async (topic: string, options: ResearchOptions) => {
      await runResearch(topic, options);
    });
}

// ─── Implementation ────────────────────────────────────────────────────────────

async function runResearch(topic: string, options: ResearchOptions): Promise<void> {
  header();

  const depth = options.depth || 'standard';
  const provider = options.provider || 'openai';
  const model = options.model || 'gpt-4o-mini';

  // Get API key from option or environment
  let apiKey = options.key;
  if (!apiKey) {
    const envVar = `${provider.toUpperCase()}_API_KEY`;
    apiKey = process.env[envVar] || '';
    if (!apiKey) {
      error(`API key not found. Set ${envVar} environment variable or use --key option.`);
      process.exit(1);
    }
  }

  info(`Starting Deep Research Mode`);
  dim(`Topic: ${topic}`);
  dim(`Depth: ${depth}`);
  dim(`Provider: ${provider}`);
  dim(`Model: ${model}`);

  // Import ResearchOrchestrator
  let ResearchOrchestrator: any;
  try {
    const researchModule = await import('@agentforge-ai/core');
    ResearchOrchestrator = researchModule.ResearchOrchestrator;
  } catch (err) {
    error('Failed to load ResearchOrchestrator. Make sure @agentforge-ai/core is installed.');
    process.exit(1);
  }

  // Create orchestrator
  const agentCount = depth === 'shallow' ? 3 : depth === 'standard' ? 5 : 10;
  dim(`Spawning ${agentCount} parallel research agents...`);

  const orchestrator = new ResearchOrchestrator({ topic, depth });

  try {
    // Run research
    info('Running research workflow...');
    dim('  Step 1: Planning — generating research questions...');

    const report: any = await orchestrator.run({
      providerId: provider,
      modelId: model,
      apiKey,
    });

    success('Research complete!');
    dim(`  Generated ${report.questions.length} research questions`);
    dim(`  Collected ${report.findings.length} findings`);
    dim(`  Synthesized comprehensive report`);

    // Generate report filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `research-${timestamp}.md`;
    const filepath = path.resolve(filename);

    // Write report
    const reportContent = formatReport(report);
    await fs.writeFile(filepath, reportContent, 'utf-8');

    console.log('\n' + reportContent);

    success(`Report saved to: ${filename}`);
  } catch (err) {
    error(`Research failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ─── Report Formatting ─────────────────────────────────────────────────────────

function formatReport(report: any): string {
  const lines: string[] = [];

  lines.push(`# Research Report: ${report.topic}`);
  lines.push('');
  lines.push(`**Depth:** ${report.depth}  |  **Date:** ${new Date(report.timestamp).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Research Questions
  lines.push('## Research Questions');
  lines.push('');
  for (const q of report.questions) {
    lines.push(`${q.id}. ${q.question}`);
  }
  lines.push('');

  lines.push('---');
  lines.push('');

  // Synthesis
  lines.push('## Synthesis');
  lines.push('');
  lines.push(report.synthesis);
  lines.push('');

  lines.push('---');
  lines.push('');

  // Individual Findings
  lines.push('## Individual Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`### ${finding.question}`);
    lines.push('');
    lines.push(finding.answer);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
