/**
 * Bundled Skills Registry
 *
 * Simple registry for built-in skills that ship with AgentForge.
 * These are lightweight, standalone capabilities that agents can use.
 */

import type { BundledSkill } from './types.js';
import { WebSearchSkill } from './web-search.js';
import { CalculatorSkill } from './calculator.js';
import { DateTimeSkill } from './datetime.js';
import { UrlFetchSkill } from './url-fetch.js';
import { FileReaderSkill } from './file-reader.js';

/**
 * All bundled skills that ship with AgentForge.
 */
export const BUNDLED_SKILLS: BundledSkill[] = [
  WebSearchSkill,
  CalculatorSkill,
  DateTimeSkill,
  UrlFetchSkill,
  FileReaderSkill,
];

/**
 * Simple registry for bundled skills.
 */
export class BundledSkillRegistry {
  private skills: Map<string, BundledSkill> = new Map();

  constructor() {
    // Auto-register all bundled skills
    for (const skill of BUNDLED_SKILLS) {
      this.skills.set(skill.name, skill);
    }
  }

  /**
   * Get a skill by name.
   * Returns undefined if not found.
   */
  get(name: string): BundledSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * List all bundled skills.
   */
  list(): BundledSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Check if a skill exists.
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Get skills by category.
   */
  getByCategory(category: BundledSkill['category']): BundledSkill[] {
    return this.list().filter((s) => s.category === category);
  }

  /**
   * Execute a skill by name with given arguments.
   */
  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const skill = this.get(name);
    if (!skill) {
      return JSON.stringify({ error: `Skill not found: ${name}` });
    }
    return skill.execute(args);
  }

  /**
   * Get the count of registered skills.
   */
  get size(): number {
    return this.skills.size;
  }
}

/**
 * Global singleton registry instance.
 */
export const bundledSkillRegistry = new BundledSkillRegistry();
