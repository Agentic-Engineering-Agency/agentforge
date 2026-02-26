import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Sparkles, Download, Trash2, Plus, Search, X, Check, Code, Globe, Calculator, FileText, Database, Mail, Wrench } from 'lucide-react';

export const Route = createFileRoute('/skills')({ component: SkillsPage });

// ─── Prebuilt Skills Catalog ─────────────────────────────────────
const PREBUILT_SKILLS = [
  {
    name: 'web-search',
    displayName: 'Web Search',
    description: 'Search the web using DuckDuckGo and return structured results. Supports query refinement and result filtering.',
    category: 'Tools',
    version: '1.0.0',
    author: 'AgentForge',
    icon: Globe,
    code: `import { createTool } from '@mastra/core';
import { z } from 'zod';

export const webSearch = createTool({
  id: 'web-search',
  description: 'Search the web and return results',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    maxResults: z.number().default(5).describe('Maximum results to return'),
  }),
  execute: async ({ context }) => {
    const url = \`https://api.duckduckgo.com/?q=\${encodeURIComponent(context.query)}&format=json&no_redirect=1\`;
    const res = await fetch(url);
    const data = await res.json();
    return { results: data.RelatedTopics?.slice(0, context.maxResults) || [], source: 'duckduckgo' };
  },
});`,
  },
  {
    name: 'code-executor',
    displayName: 'Code Executor',
    description: 'Execute JavaScript/TypeScript code snippets via the AgentForge sandbox API and return the output.',
    category: 'Tools',
    version: '1.0.0',
    author: 'AgentForge',
    icon: Code,
    code: `import { createTool } from '@mastra/core';
import { z } from 'zod';

export const codeExecutor = createTool({
  id: 'code-executor',
  description: 'Execute JavaScript code via the sandbox API and return the result',
  inputSchema: z.object({
    code: z.string().describe('JavaScript code to execute'),
    language: z.enum(['javascript', 'typescript']).default('javascript'),
  }),
  execute: async ({ context }) => {
    // Code is executed server-side via the AgentForge sandbox API,
    // not via eval or Function constructor, to prevent arbitrary code execution risks.
    const response = await fetch('/api/sandbox/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: context.code, language: context.language }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: err.error ?? 'Sandbox execution failed' };
    }
    const data = await response.json();
    return { success: true, output: String(data.output ?? '') };
  },
});`,
  },
  {
    name: 'calculator',
    displayName: 'Calculator',
    description: 'Perform mathematical calculations. Supports basic arithmetic, trigonometry, and common math functions.',
    category: 'Tools',
    version: '1.0.0',
    author: 'AgentForge',
    icon: Calculator,
    code: `import { createTool } from '@mastra/core';
import { z } from 'zod';

// Safe arithmetic evaluator — no eval or Function constructor used.
function evaluateExpression(expr: string): number {
  // Allow only digits, operators, parentheses, dots, and whitespace.
  if (!/^[0-9+\\-*/().%\\s]+$/.test(expr)) {
    throw new Error('Expression contains invalid characters');
  }
  // Recursive descent parser for: expr = term (('+' | '-') term)*
  let pos = 0;
  const peek = () => expr[pos] ?? '';
  const consume = () => expr[pos++];
  const skipWs = () => { while (peek() === ' ') consume(); };

  function parseNumber(): number {
    skipWs();
    let num = '';
    if (peek() === '(') { consume(); const v = parseExpr(); skipWs(); consume(); return v; }
    while (/[0-9.]/.test(peek())) num += consume();
    if (num === '') throw new Error('Expected number');
    return parseFloat(num);
  }

  function parseFactor(): number {
    skipWs();
    if (peek() === '-') { consume(); return -parseFactor(); }
    return parseNumber();
  }

  function parseTerm(): number {
    let left = parseFactor();
    skipWs();
    while (peek() === '*' || peek() === '/') {
      const op = consume(); skipWs();
      const right = parseFactor();
      left = op === '*' ? left * right : left / right;
      skipWs();
    }
    return left;
  }

  function parseExpr(): number {
    let left = parseTerm();
    skipWs();
    while (peek() === '+' || peek() === '-') {
      const op = consume(); skipWs();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
      skipWs();
    }
    return left;
  }

  const result = parseExpr();
  if (pos !== expr.length) throw new Error('Unexpected token at position ' + pos);
  return result;
}

export const calculator = createTool({
  id: 'calculator',
  description: 'Evaluate a mathematical expression safely',
  inputSchema: z.object({
    expression: z.string().describe('Math expression to evaluate, e.g. "2 + 2 * 3"'),
  }),
  execute: async ({ context }) => {
    try {
      const result = evaluateExpression(context.expression.trim());
      return { result: Number(result), expression: context.expression };
    } catch (error: any) {
      return { error: 'Invalid expression: ' + error.message };
    }
  },
});`,
  },
  {
    name: 'text-summarizer',
    displayName: 'Text Summarizer',
    description: 'Summarize long text into concise bullet points or paragraphs using extractive summarization.',
    category: 'Knowledge',
    version: '1.0.0',
    author: 'AgentForge',
    icon: FileText,
    code: `import { createTool } from '@mastra/core';
import { z } from 'zod';

export const textSummarizer = createTool({
  id: 'text-summarizer',
  description: 'Summarize text into key points',
  inputSchema: z.object({
    text: z.string().describe('Text to summarize'),
    maxSentences: z.number().default(3).describe('Maximum sentences in summary'),
  }),
  execute: async ({ context }) => {
    const sentences = context.text.match(/[^.!?]+[.!?]+/g) || [context.text];
    const scored = sentences.map((s, i) => ({
      text: s.trim(),
      score: s.split(' ').length * (i === 0 ? 1.5 : 1),
    }));
    scored.sort((a, b) => b.score - a.score);
    return { summary: scored.slice(0, context.maxSentences).map(s => s.text).join(' ') };
  },
});`,
  },
  {
    name: 'json-transformer',
    displayName: 'JSON Transformer',
    description: 'Parse, validate, and transform JSON data. Extract fields, flatten nested objects, and convert formats.',
    category: 'Tools',
    version: '1.0.0',
    author: 'AgentForge',
    icon: Database,
    code: `import { createTool } from '@mastra/core';
import { z } from 'zod';

export const jsonTransformer = createTool({
  id: 'json-transformer',
  description: 'Parse and transform JSON data',
  inputSchema: z.object({
    json: z.string().describe('JSON string to transform'),
    operation: z.enum(['parse', 'flatten', 'extract']).describe('Operation to perform'),
    path: z.string().optional().describe('JSON path for extraction (e.g. "data.users")'),
  }),
  execute: async ({ context }) => {
    const data = JSON.parse(context.json);
    if (context.operation === 'parse') return { result: data };
    if (context.operation === 'extract' && context.path) {
      const keys = context.path.split('.');
      let val = data;
      for (const k of keys) val = val?.[k];
      return { result: val };
    }
    if (context.operation === 'flatten') {
      const flat: Record<string, any> = {};
      const recurse = (obj: any, prefix = '') => {
        for (const [k, v] of Object.entries(obj)) {
          const key = prefix ? prefix + '.' + k : k;
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) recurse(v, key);
          else flat[key] = v;
        }
      };
      recurse(data);
      return { result: flat };
    }
    return { error: 'Unknown operation' };
  },
});`,
  },
  {
    name: 'email-drafter',
    displayName: 'Email Drafter',
    description: 'Generate professional email drafts based on context, tone, and recipient information.',
    category: 'Workflows',
    version: '1.0.0',
    author: 'AgentForge',
    icon: Mail,
    code: `import { createTool } from '@mastra/core';
import { z } from 'zod';

export const emailDrafter = createTool({
  id: 'email-drafter',
  description: 'Draft a professional email',
  inputSchema: z.object({
    to: z.string().describe('Recipient name or role'),
    subject: z.string().describe('Email subject'),
    context: z.string().describe('What the email should convey'),
    tone: z.enum(['formal', 'casual', 'friendly']).default('formal'),
  }),
  execute: async ({ context: ctx }) => {
    const greeting = ctx.tone === 'formal' ? 'Dear' : ctx.tone === 'friendly' ? 'Hi' : 'Hello';
    const closing = ctx.tone === 'formal' ? 'Best regards' : ctx.tone === 'friendly' ? 'Cheers' : 'Thanks';
    return {
      draft: \`Subject: \${ctx.subject}\\n\\n\${greeting} \${ctx.to},\\n\\n\${ctx.context}\\n\\n\${closing}\`,
      metadata: { tone: ctx.tone, to: ctx.to },
    };
  },
});`,
  },
];

const CATEGORIES = ['All', 'Tools', 'Knowledge', 'Workflows'];

function SkillsPage() {
  const installedSkills = useQuery(api.skills.list, {}) ?? [];
  const installSkill = useMutation(api.skills.create);
  const removeSkill = useMutation(api.skills.remove);
  const toggleSkill = useMutation(api.skills.toggleEnabled);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [tab, setTab] = useState<'installed' | 'marketplace'>('marketplace');
  const [selectedSkill, setSelectedSkill] = useState<typeof PREBUILT_SKILLS[0] | null>(null);

  const installedNames = new Set(installedSkills.map((s: any) => s.name));

  const filteredMarketplace = useMemo(() => {
    let result = PREBUILT_SKILLS;
    if (categoryFilter !== 'All') result = result.filter(s => s.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.displayName.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    return result;
  }, [searchQuery, categoryFilter]);

  const filteredInstalled = useMemo(() => {
    let result = installedSkills;
    if (categoryFilter !== 'All') result = result.filter((s: any) => s.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s: any) => s.displayName.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    return result;
  }, [installedSkills, searchQuery, categoryFilter]);

  const handleInstall = async (skill: typeof PREBUILT_SKILLS[0]) => {
    await installSkill({
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      category: skill.category,
      version: skill.version,
      author: skill.author,
      code: skill.code,
    });
  };

  const [confirmingUninstallId, setConfirmingUninstallId] = useState<string | null>(null);

  const handleUninstall = async (id: string) => {
    if (confirmingUninstallId === id) {
      await removeSkill({ id });
      setConfirmingUninstallId(null);
    } else {
      setConfirmingUninstallId(id);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Skills</h1>
            <p className="text-muted-foreground">Install prebuilt skills or create your own to extend agent capabilities.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          <button onClick={() => setTab('marketplace')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'marketplace' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Sparkles className="w-4 h-4 inline mr-2" />Marketplace ({PREBUILT_SKILLS.length})
          </button>
          <button onClick={() => setTab('installed')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'installed' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Check className="w-4 h-4 inline mr-2" />Installed ({installedSkills.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search skills..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full" />
          </div>
          <div className="flex gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-3 py-1.5 rounded-lg text-sm ${categoryFilter === cat ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>{cat}</button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {tab === 'marketplace' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMarketplace.map(skill => {
              const isInstalled = installedNames.has(skill.name);
              const Icon = skill.icon;
              return (
                <div key={skill.name} className="bg-card border border-border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-4 h-4 text-primary" /></div>
                      <div>
                        <h3 className="font-semibold text-foreground">{skill.displayName}</h3>
                        <p className="text-xs text-muted-foreground">v{skill.version} by {skill.author}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">{skill.category}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{skill.description}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <button onClick={() => setSelectedSkill(skill)} className="text-xs text-primary hover:underline">View Code</button>
                    {isInstalled ? (
                      <span className="text-xs text-green-500 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Installed</span>
                    ) : (
                      <button onClick={() => handleInstall(skill)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs hover:bg-primary/90 flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" /> Install
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          filteredInstalled.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-lg">
              <Wrench className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No skills installed</h3>
              <p className="text-muted-foreground">Browse the marketplace to install skills for your agents.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInstalled.map((skill: any) => (
                <div key={skill._id} className="bg-card border border-border rounded-lg p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-foreground">{skill.displayName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${skill.isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>{skill.isEnabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{skill.description}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <button onClick={() => toggleSkill({ id: skill._id })} className="text-xs text-muted-foreground hover:text-foreground">{skill.isEnabled ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => handleUninstall(skill._id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Code Preview Modal */}
        {selectedSkill && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h2 className="text-lg font-bold">{selectedSkill.displayName} — Source Code</h2>
                <button onClick={() => setSelectedSkill(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono bg-background text-foreground">{selectedSkill.code}</pre>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setSelectedSkill(null)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">Close</button>
                {!installedNames.has(selectedSkill.name) && (
                  <button onClick={() => { handleInstall(selectedSkill); setSelectedSkill(null); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90">Install Skill</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
