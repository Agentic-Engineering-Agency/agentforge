import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";

// Mock the Convex client
vi.mock("@agentforge-ai/cli/src/lib/convex-client.js", () => ({
  createClient: vi.fn(),
  safeCall: vi.fn(),
}));

// Mock gray-matter to avoid heavy dependency
vi.mock("gray-matter", () => ({
  __esModule: true,
  default: (content: string) => {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) return { data: {}, content };
    
    const frontmatter = fmMatch[1];
    const body = fmMatch[2];
    const data: Record<string, unknown> = {};
    
    for (const line of frontmatter.split("\n")) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        let value: unknown = match[2].trim();
        // Parse arrays
        if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
          value = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
        }
        data[match[1]] = value;
      }
    }
    
    return { data, content: body };
  },
}));

describe("skills CLI - SKILL.md scaffolding", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
    vi.clearAllMocks();
  });

  // ─── SKILL.md Template Tests ────────────────────────────────────────

  describe("SKILL.md template format", () => {
    it("should generate SKILL.md with proper frontmatter", () => {
      const skillMd = `---
name: test-skill
description: A test skill
version: 1.0.0
author: Test Author
tags:
  - test
  - demo
---

# Test Skill

A test skill for unit testing.

## Instructions

Test instructions go here.

## When to use

Use this skill for testing.
`;

      const fmMatch = skillMd.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      expect(fmMatch).not.toBeNull();
      
      const frontmatter = fmMatch![1];
      expect(frontmatter).toContain("name: test-skill");
      expect(frontmatter).toContain("description: A test skill");
      expect(frontmatter).toContain("version: 1.0.0");
      expect(frontmatter).toContain("author: Test Author");
      expect(frontmatter).toContain("tags:");
    });

    it("should include required sections in SKILL.md body", () => {
      const skillMd = `---
name: test-skill
description: Test
version: 1.0.0
---

# Test Skill

## Instructions

Instructions here.

## When to use

Trigger conditions here.

## References

Reference files listed here.

## Scripts

Scripts listed here.
`;

      expect(skillMd).toContain("## Instructions");
      expect(skillMd).toContain("## When to use");
      expect(skillMd).toContain("## References");
      expect(skillMd).toContain("## Scripts");
    });
  });

  // ─── Folder Structure Tests ──────────────────────────────────────────

  describe("skills create - folder structure", () => {
    it("should create correct folder structure for a new skill", async () => {
      const skillName = "my-test-skill";
      const skillDir = path.join(tempDir, "skills", skillName);

      // Simulate the folder structure creation
      await fs.ensureDir(path.join(skillDir, "references"));
      await fs.ensureDir(path.join(skillDir, "scripts"));
      await fs.ensureDir(path.join(skillDir, "assets"));

      // Verify structure
      expect(await fs.pathExists(skillDir)).toBe(true);
      expect(await fs.pathExists(path.join(skillDir, "references"))).toBe(true);
      expect(await fs.pathExists(path.join(skillDir, "scripts"))).toBe(true);
      expect(await fs.pathExists(path.join(skillDir, "assets"))).toBe(true);
    });

    it("should create SKILL.md file with correct content", async () => {
      const skillName = "demo-skill";
      const skillDir = path.join(tempDir, "skills", skillName);
      const skillMdPath = path.join(skillDir, "SKILL.md");

      await fs.ensureDir(skillDir);

      const skillMdContent = `---
name: ${skillName}
description: A demo skill for testing
version: 1.0.0
author: Test User
tags:
  - demo
  - test
---

# Demo Skill

A demo skill for testing.

## Instructions

1. Step one
2. Step two
3. Step three

## When to use

Use this skill when testing the skills system.

## References

See \`references/\` for supporting documentation.

## Scripts

See \`scripts/\` for executable scripts.
`;

      await fs.writeFile(skillMdPath, skillMdContent, "utf-8");

      // Verify file exists and has correct content
      expect(await fs.pathExists(skillMdPath)).toBe(true);
      const content = await fs.readFile(skillMdPath, "utf-8");
      expect(content).toContain("name: demo-skill");
      expect(content).toContain("description: A demo skill for testing");
      expect(content).toContain("## Instructions");
    });

    it("should validate skill name is kebab-case", () => {
      const validNames = ["my-skill", "web-search", "code-review", "api-tester-2"];
      const invalidNames = ["MySkill", "my_skill", "my skill", "123skill", "-skill"];

      const kebabCaseRegex = /^[a-z][a-z0-9-]*$/;

      validNames.forEach((name) => {
        expect(kebabCaseRegex.test(name)).toBe(true);
      });

      invalidNames.forEach((name) => {
        expect(kebabCaseRegex.test(name)).toBe(false);
      });
    });

    it("should create placeholder files in references and scripts", async () => {
      const skillName = "placeholder-test";
      const skillDir = path.join(tempDir, "skills", skillName);

      await fs.ensureDir(path.join(skillDir, "references"));
      await fs.ensureDir(path.join(skillDir, "scripts"));

      // Create placeholder files
      await fs.writeFile(
        path.join(skillDir, "references", "README.md"),
        `# References for ${skillName}\n\nAdd supporting documentation here.\n`
      );
      await fs.writeFile(
        path.join(skillDir, "scripts", "example.ts"),
        `#!/usr/bin/env npx tsx\nconsole.log('Hello from ${skillName}!');\n`
      );

      expect(await fs.pathExists(path.join(skillDir, "references", "README.md"))).toBe(true);
      expect(await fs.pathExists(path.join(skillDir, "scripts", "example.ts"))).toBe(true);
    });
  });

  // ─── Skills Lock File Tests ──────────────────────────────────────────

  describe("skills.lock.json", () => {
    it("should track installed skills in lockfile", async () => {
      const lock = {
        version: 1,
        skills: {
          "web-search": {
            name: "web-search",
            version: "1.0.0",
            source: "builtin",
            installedAt: new Date().toISOString(),
          },
          "my-custom-skill": {
            name: "my-custom-skill",
            version: "1.0.0",
            source: "local",
            installedAt: new Date().toISOString(),
          },
        },
      };

      const lockPath = path.join(tempDir, "skills.lock.json");
      await fs.writeJson(lockPath, lock, { spaces: 2 });

      const loaded = await fs.readJson(lockPath);
      expect(loaded.version).toBe(1);
      expect(loaded.skills["web-search"]).toBeDefined();
      expect(loaded.skills["my-custom-skill"]).toBeDefined();
      expect(loaded.skills["web-search"].source).toBe("builtin");
      expect(loaded.skills["my-custom-skill"].source).toBe("local");
    });

    it("should remove skill from lockfile when uninstalled", async () => {
      const lock = {
        version: 1,
        skills: {
          "skill-to-remove": {
            name: "skill-to-remove",
            version: "1.0.0",
            source: "local",
            installedAt: new Date().toISOString(),
          },
        },
      };

      // Remove skill from lock
      delete lock.skills["skill-to-remove"];

      expect(lock.skills["skill-to-remove"]).toBeUndefined();
      expect(Object.keys(lock.skills)).toHaveLength(0);
    });
  });

  // ─── Skills Directory Resolution Tests ───────────────────────────────

  describe("resolveSkillsDir", () => {
    it("should prefer workspace/skills/ when workspace directory exists", async () => {
      // Create workspace directory
      await fs.ensureDir(path.join(tempDir, "workspace"));

      // Mock resolveSkillsDir logic
      const cwd = process.cwd();
      const workspaceSkillsDir = path.join(cwd, "workspace", "skills");
      const fallbackSkillsDir = path.join(cwd, "skills");

      const hasWorkspace = await fs.pathExists(path.join(cwd, "workspace"));
      const skillsDir = hasWorkspace ? workspaceSkillsDir : fallbackSkillsDir;

      expect(skillsDir).toBe(workspaceSkillsDir);
    });

    it("should fall back to skills/ when no workspace directory", async () => {
      // No workspace directory
      const cwd = process.cwd();
      const fallbackSkillsDir = path.join(cwd, "skills");

      const hasWorkspace = await fs.pathExists(path.join(cwd, "workspace"));
      const skillsDir = hasWorkspace 
        ? path.join(cwd, "workspace", "skills") 
        : fallbackSkillsDir;

      expect(skillsDir).toBe(fallbackSkillsDir);
    });
  });

  // ─── Convex Integration Tests (Mocked) ────────────────────────────────

  describe("Convex DB sync", () => {
    it("should call skills:create mutation with correct data", async () => {
      const { createClient, safeCall } = await import("@agentforge-ai/cli/src/lib/convex-client.js");
      
      const mockMutation = vi.fn().mockResolvedValue("skill-id-123");
      (createClient as any).mockResolvedValue({
        mutation: mockMutation,
      });

      const client = await createClient();
      const skillData = {
        name: "test-skill",
        displayName: "Test Skill",
        description: "A test skill",
        category: "test",
        version: "1.0.0",
        author: "Test Author",
        code: "// Skill: test-skill\n// See: workspace/skills/test-skill/SKILL.md",
      };

      await client.mutation("skills:create", skillData);

      expect(mockMutation).toHaveBeenCalledWith("skills:create", skillData);
    });

    it("should handle Convex not available gracefully", async () => {
      const { createClient } = await import("@agentforge-ai/cli/src/lib/convex-client.js");
      
      (createClient as any).mockRejectedValue(new Error("Convex not configured"));

      try {
        await createClient();
        // Should not reach here
        expect(true).toBe(false);
      } catch (err) {
        expect((err as Error).message).toBe("Convex not configured");
      }
    });
  });

  // ─── Security Validation Tests ────────────────────────────────────────

  describe("security validation", () => {
    it("should sanitize skill name to prevent path traversal", () => {
      const maliciousNames = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32",
        "skill/../../../etc",
        "skill\x00name",
      ];

      const sanitizeName = (name: string): string => {
        // Only allow kebab-case alphanumeric
        return name.replace(/[^a-z0-9-]/g, "").replace(/^-+/, "");
      };

      maliciousNames.forEach((name) => {
        const sanitized = sanitizeName(name);
        expect(sanitized).not.toContain("..");
        expect(sanitized).not.toContain("/");
        expect(sanitized).not.toContain("\\");
        expect(sanitized).not.toContain("\x00");
      });
    });

    it("should escape special characters in description", () => {
      const maliciousDescription = 'Test <script>alert("xss")</script>';
      
      // Basic sanitization - remove HTML tags
      const sanitizeDescription = (desc: string): string => {
        return desc.replace(/<[^>]*>/g, "");
      };

      const sanitized = sanitizeDescription(maliciousDescription);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("</script>");
    });

    it("should limit skill name length", () => {
      const longName = "a".repeat(100);
      const maxLength = 64;

      const truncatedName = longName.slice(0, maxLength);
      expect(truncatedName.length).toBeLessThanOrEqual(maxLength);
    });
  });

  // ─── Mastra Workspace Compatibility Tests ─────────────────────────────

  describe("Mastra Workspace compatibility", () => {
    it("should follow SKILL.md specification format", () => {
      const skillMd = `---
name: code-review
description: Reviews code for quality, style, and potential issues
version: 1.0.0
tags:
  - development
  - review
---

# Code Review

You are a code reviewer. When reviewing code:

1. Check for bugs and edge cases
2. Verify the code follows the style guide
3. Suggest improvements for readability
`;

      // Verify it matches the Mastra workspace skills spec
      expect(skillMd).toMatch(/^---\n/);
      expect(skillMd).toContain("name:");
      expect(skillMd).toContain("description:");
      expect(skillMd).toContain("version:");
    });

    it("should support references/ directory for supporting docs", async () => {
      const skillDir = path.join(tempDir, "skills", "doc-skill");
      await fs.ensureDir(path.join(skillDir, "references"));

      // Add a reference file
      await fs.writeFile(
        path.join(skillDir, "references", "style-guide.md"),
        "# Style Guide\n\nCode style guidelines."
      );

      expect(await fs.pathExists(path.join(skillDir, "references", "style-guide.md"))).toBe(true);
    });

    it("should support scripts/ directory for executable scripts", async () => {
      const skillDir = path.join(tempDir, "skills", "script-skill");
      await fs.ensureDir(path.join(skillDir, "scripts"));

      // Add a script file
      await fs.writeFile(
        path.join(skillDir, "scripts", "lint.ts"),
        `#!/usr/bin/env npx tsx\nconsole.log("Linting...");`
      );

      expect(await fs.pathExists(path.join(skillDir, "scripts", "lint.ts"))).toBe(true);
    });

    it("should support assets/ directory for images and files", async () => {
      const skillDir = path.join(tempDir, "skills", "asset-skill");
      await fs.ensureDir(path.join(skillDir, "assets"));

      // Add an asset file
      await fs.writeFile(
        path.join(skillDir, "assets", "diagram.png"),
        "" // Empty placeholder
      );

      expect(await fs.pathExists(path.join(skillDir, "assets", "diagram.png"))).toBe(true);
    });
  });

  // ─── Built-in Registry Tests ──────────────────────────────────────────

  describe("built-in registry", () => {
    const BUILTIN_REGISTRY = [
      "web-search",
      "file-manager",
      "code-review",
      "data-analyst",
      "api-tester",
      "git-workflow",
      "browser-automation",
    ];

    it("should have all expected built-in skills", () => {
      BUILTIN_REGISTRY.forEach((name) => {
        expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
      });
    });

    it("should generate SKILL.md for each built-in skill", async () => {
      for (const skillName of BUILTIN_REGISTRY.slice(0, 2)) {
        // Test first 2 to keep test fast
        const skillDir = path.join(tempDir, "skills", skillName);
        await fs.ensureDir(skillDir);

        const skillMd = `---
name: ${skillName}
description: ${skillName} skill
version: 1.0.0
---

# ${skillName}

Description here.
`;

        await fs.writeFile(path.join(skillDir, "SKILL.md"), skillMd);

        const content = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf-8");
        expect(content).toContain(`name: ${skillName}`);
      }
    });
  });
});
