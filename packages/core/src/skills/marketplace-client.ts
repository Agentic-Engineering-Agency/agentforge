import { z } from 'zod';

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const marketplaceSkillSchema = z.object({
  _id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  downloads: z.number(),
  featured: z.boolean(),
  skillMdContent: z.string(),
  readmeContent: z.string().optional(),
  repositoryUrl: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type MarketplaceSkill = z.infer<typeof marketplaceSkillSchema>;

export const publishSkillInputSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9-]*/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1),
  author: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()),
  skillMdContent: z.string().min(1),
  readmeContent: z.string().optional(),
  repositoryUrl: z.string().url().optional(),
});

export type PublishSkillInput = z.infer<typeof publishSkillInputSchema>;

// ─── Error Class ──────────────────────────────────────────────────────────────

export class MarketplaceError extends Error {
  constructor(
    message: string,
    public readonly code: 'NETWORK' | 'NOT_FOUND' | 'VALIDATION' | 'SERVER',
  ) {
    super(message);
    this.name = 'MarketplaceError';
  }
}

// ─── Convex HTTP helper ───────────────────────────────────────────────────────

const QUERY_FUNCTIONS = new Set([
  'skillMarketplace:listSkills',
  'skillMarketplace:getSkill',
  'skillMarketplace:getFeaturedSkills',
]);

async function convexQuery(
  convexUrl: string,
  functionPath: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const endpoint = QUERY_FUNCTIONS.has(functionPath) ? 'query' : 'mutation';
  const url = `${convexUrl.replace(/\/$/, '')}/api/${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionPath, args }),
    });
  } catch (err) {
    throw new MarketplaceError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
      'NETWORK',
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new MarketplaceError(
      `Convex API error (${response.status}): ${text}`,
      'SERVER',
    );
  }

  const result = (await response.json()) as { status?: string; errorMessage?: string; value?: unknown };
  if (result.status === 'error') {
    throw new MarketplaceError(result.errorMessage ?? 'Unknown server error', 'SERVER');
  }
  return result.value;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch featured skills from the marketplace.
 */
export async function fetchFeaturedSkills(convexUrl: string): Promise<MarketplaceSkill[]> {
  const result = await convexQuery(convexUrl, 'skillMarketplace:getFeaturedSkills');
  return z.array(marketplaceSkillSchema).parse(result);
}

/**
 * Search skills in the marketplace.
 */
export async function searchSkills(
  query: string,
  convexUrl: string,
  category?: string,
): Promise<MarketplaceSkill[]> {
  const result = await convexQuery(convexUrl, 'skillMarketplace:listSkills', {
    query: query || undefined,
    category: category || undefined,
  });
  return z.array(marketplaceSkillSchema).parse(result);
}

/**
 * Get a single skill by name. Returns null if not found.
 */
export async function getSkill(
  name: string,
  convexUrl: string,
): Promise<MarketplaceSkill | null> {
  const result = await convexQuery(convexUrl, 'skillMarketplace:getSkill', { name });
  if (!result) return null;
  return marketplaceSkillSchema.parse(result);
}

/**
 * Publish a skill to the marketplace. Returns the new skill ID.
 */
export async function publishSkill(
  input: PublishSkillInput,
  convexUrl: string,
): Promise<string> {
  const validated = publishSkillInputSchema.parse(input);
  const result = await convexQuery(convexUrl, 'skillMarketplace:publishSkill', validated);
  return result as string;
}

/**
 * Install a skill from the marketplace to a local directory.
 * Writes SKILL.md (and README.md if available) into `targetDir/<name>/`.
 * Also reads references/ directory if it exists and includes in the payload.
 * Node.js only — uses dynamic import for `node:fs`.
 */
export async function installFromMarketplace(
  name: string,
  targetDir: string,
  convexUrl: string,
): Promise<{ skillDir: string; skill: MarketplaceSkill; references?: Array<{ name: string; content: string }> }> {
  const skill = await getSkill(name, convexUrl);
  if (!skill) {
    throw new MarketplaceError(`Skill "${name}" not found in marketplace`, 'NOT_FOUND');
  }

  const fs = await import('node:fs');
  const path = await import('node:path');

  const skillDir = path.join(targetDir, name);

  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true });
  }

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill.skillMdContent, 'utf-8');

  if (skill.readmeContent) {
    fs.writeFileSync(path.join(skillDir, 'README.md'), skill.readmeContent, 'utf-8');
  }

  // Read references/ directory if it exists
  const referencesDir = path.join(skillDir, 'references');
  const references: Array<{ name: string; content: string }> = [];
  if (fs.existsSync(referencesDir)) {
    const refFiles = fs.readdirSync(referencesDir);
    for (const refFile of refFiles) {
      const refPath = path.join(referencesDir, refFile);
      const stat = fs.statSync(refPath);
      if (stat.isFile()) {
        const content = fs.readFileSync(refPath, 'utf-8');
        references.push({ name: refFile, content });
      }
    }
  }

  // Best-effort download tracking — don't fail install if this errors
  try {
    await convexQuery(convexUrl, 'skillMarketplace:incrementDownloads', { name });
  } catch {
    // intentionally ignored
  }

  return { skillDir, skill, references };
}
