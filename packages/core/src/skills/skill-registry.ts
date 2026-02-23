import type { SkillDefinition } from './types.js';

export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();

  /** Register a skill. Throws if a skill with the same name is already registered. */
  register(skill: SkillDefinition): void {
    if (this.skills.has(skill.name)) {
      throw new Error(`Skill "${skill.name}" is already registered`);
    }
    this.skills.set(skill.name, skill);
  }

  /** Get a skill by name. Returns undefined if not found. */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /** List all registered skills. */
  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /** Remove a skill by name. Returns true if removed, false if not found. */
  remove(name: string): boolean {
    return this.skills.delete(name);
  }

  /** Check if a skill is registered. */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /** Get the count of registered skills. */
  get size(): number {
    return this.skills.size;
  }

  /** Clear all registered skills. */
  clear(): void {
    this.skills.clear();
  }
}
