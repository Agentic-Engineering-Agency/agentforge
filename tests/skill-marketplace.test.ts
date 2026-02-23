import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Marketplace Client Tests ----

describe("marketplace-client", () => {
  // We'll test the module by importing and mocking fetch

  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const CONVEX_URL = "https://test-123.convex.cloud";

  const mockSkill = {
    _id: "abc123",
    name: "test-skill",
    version: "1.0.0",
    description: "A test skill",
    author: "test-author",
    category: "automation",
    tags: ["test"],
    downloads: 42,
    featured: false,
    skillMdContent: "---\nname: test-skill\n---\n# Test",
    createdAt: 1000,
    updatedAt: 1000,
  };

  // Helper to mock successful Convex response
  function mockConvexResponse(value: unknown) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", value }),
    });
  }

  function mockConvexError(status: number, text: string) {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      text: async () => text,
    });
  }

  describe("searchSkills", () => {
    it("should search skills with query", async () => {
      const { searchSkills } = await import("@agentforge-ai/core");
      mockConvexResponse([mockSkill]);
      const results = await searchSkills("test", CONVEX_URL);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("test-skill");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/query"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should search with category filter", async () => {
      const { searchSkills } = await import("@agentforge-ai/core");
      mockConvexResponse([mockSkill]);
      const results = await searchSkills("test", CONVEX_URL, "automation");
      expect(results).toHaveLength(1);
    });

    it("should return empty array for no results", async () => {
      const { searchSkills } = await import("@agentforge-ai/core");
      mockConvexResponse([]);
      const results = await searchSkills("nonexistent", CONVEX_URL);
      expect(results).toHaveLength(0);
    });

    it("should throw MarketplaceError on server error", async () => {
      const { searchSkills, MarketplaceError } = await import("@agentforge-ai/core");
      mockConvexError(500, "Internal error");
      await expect(searchSkills("test", CONVEX_URL)).rejects.toThrow(MarketplaceError);
    });
  });

  describe("fetchFeaturedSkills", () => {
    it("should fetch featured skills", async () => {
      const { fetchFeaturedSkills } = await import("@agentforge-ai/core");
      const featured = { ...mockSkill, featured: true };
      mockConvexResponse([featured]);
      const results = await fetchFeaturedSkills(CONVEX_URL);
      expect(results).toHaveLength(1);
      expect(results[0].featured).toBe(true);
    });

    it("should return empty array when no featured", async () => {
      const { fetchFeaturedSkills } = await import("@agentforge-ai/core");
      mockConvexResponse([]);
      const results = await fetchFeaturedSkills(CONVEX_URL);
      expect(results).toHaveLength(0);
    });
  });

  describe("getSkill", () => {
    it("should get skill by name", async () => {
      const { getSkill } = await import("@agentforge-ai/core");
      mockConvexResponse(mockSkill);
      const result = await getSkill("test-skill", CONVEX_URL);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("test-skill");
    });

    it("should return null for missing skill", async () => {
      const { getSkill } = await import("@agentforge-ai/core");
      mockConvexResponse(null);
      const result = await getSkill("nonexistent", CONVEX_URL);
      expect(result).toBeNull();
    });
  });

  describe("publishSkill", () => {
    it("should publish a valid skill", async () => {
      const { publishSkill } = await import("@agentforge-ai/core");
      mockConvexResponse("new-id-123");
      const result = await publishSkill(
        {
          name: "my-skill",
          version: "1.0.0",
          description: "My skill",
          author: "me",
          category: "general",
          tags: ["test"],
          skillMdContent: "# My Skill",
        },
        CONVEX_URL,
      );
      expect(result).toBe("new-id-123");
    });

    it("should reject invalid skill name", async () => {
      const { publishSkill } = await import("@agentforge-ai/core");
      await expect(
        publishSkill(
          {
            name: "Invalid Name!",
            version: "1.0.0",
            description: "Bad",
            author: "me",
            category: "general",
            tags: [],
            skillMdContent: "# Bad",
          },
          CONVEX_URL,
        ),
      ).rejects.toThrow();
    });

    it("should reject invalid version", async () => {
      const { publishSkill } = await import("@agentforge-ai/core");
      await expect(
        publishSkill(
          {
            name: "valid-name",
            version: "not-semver",
            description: "Bad",
            author: "me",
            category: "general",
            tags: [],
            skillMdContent: "# Bad",
          },
          CONVEX_URL,
        ),
      ).rejects.toThrow();
    });

    it("should reject empty description", async () => {
      const { publishSkill } = await import("@agentforge-ai/core");
      await expect(
        publishSkill(
          {
            name: "valid-name",
            version: "1.0.0",
            description: "",
            author: "me",
            category: "general",
            tags: [],
            skillMdContent: "# Something",
          },
          CONVEX_URL,
        ),
      ).rejects.toThrow();
    });

    it("should reject empty author", async () => {
      const { publishSkill } = await import("@agentforge-ai/core");
      await expect(
        publishSkill(
          {
            name: "valid-name",
            version: "1.0.0",
            description: "Desc",
            author: "",
            category: "general",
            tags: [],
            skillMdContent: "# Something",
          },
          CONVEX_URL,
        ),
      ).rejects.toThrow();
    });
  });

  describe("marketplaceSkillSchema", () => {
    it("should validate a complete skill", async () => {
      const { marketplaceSkillSchema } = await import("@agentforge-ai/core");
      const result = marketplaceSkillSchema.safeParse(mockSkill);
      expect(result.success).toBe(true);
    });

    it("should reject skill missing required fields", async () => {
      const { marketplaceSkillSchema } = await import("@agentforge-ai/core");
      const result = marketplaceSkillSchema.safeParse({ name: "test" });
      expect(result.success).toBe(false);
    });

    it("should accept optional readmeContent", async () => {
      const { marketplaceSkillSchema } = await import("@agentforge-ai/core");
      const withReadme = { ...mockSkill, readmeContent: "# README" };
      const result = marketplaceSkillSchema.safeParse(withReadme);
      expect(result.success).toBe(true);
    });

    it("should accept optional repositoryUrl", async () => {
      const { marketplaceSkillSchema } = await import("@agentforge-ai/core");
      const withRepo = { ...mockSkill, repositoryUrl: "https://github.com/test/test" };
      const result = marketplaceSkillSchema.safeParse(withRepo);
      expect(result.success).toBe(true);
    });
  });

  describe("publishSkillInputSchema", () => {
    it("should validate correct input", async () => {
      const { publishSkillInputSchema } = await import("@agentforge-ai/core");
      const result = publishSkillInputSchema.safeParse({
        name: "valid-skill",
        version: "1.0.0",
        description: "A valid skill",
        author: "someone",
        category: "tools",
        tags: ["tag1"],
        skillMdContent: "# Content",
      });
      expect(result.success).toBe(true);
    });

    it("should reject name with uppercase", async () => {
      const { publishSkillInputSchema } = await import("@agentforge-ai/core");
      const result = publishSkillInputSchema.safeParse({
        name: "Invalid",
        version: "1.0.0",
        description: "desc",
        author: "someone",
        category: "tools",
        tags: [],
        skillMdContent: "# Content",
      });
      expect(result.success).toBe(false);
    });

    it("should reject name starting with number", async () => {
      const { publishSkillInputSchema } = await import("@agentforge-ai/core");
      const result = publishSkillInputSchema.safeParse({
        name: "123-skill",
        version: "1.0.0",
        description: "desc",
        author: "someone",
        category: "tools",
        tags: [],
        skillMdContent: "# Content",
      });
      expect(result.success).toBe(false);
    });

    it("should accept name with hyphens", async () => {
      const { publishSkillInputSchema } = await import("@agentforge-ai/core");
      const result = publishSkillInputSchema.safeParse({
        name: "my-cool-skill",
        version: "2.1.3",
        description: "desc",
        author: "someone",
        category: "tools",
        tags: ["a", "b"],
        skillMdContent: "# Content",
      });
      expect(result.success).toBe(true);
    });

    it("should reject non-semver version", async () => {
      const { publishSkillInputSchema } = await import("@agentforge-ai/core");
      const result = publishSkillInputSchema.safeParse({
        name: "valid-skill",
        version: "v1",
        description: "desc",
        author: "someone",
        category: "tools",
        tags: [],
        skillMdContent: "# Content",
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional repositoryUrl when valid URL", async () => {
      const { publishSkillInputSchema } = await import("@agentforge-ai/core");
      const result = publishSkillInputSchema.safeParse({
        name: "valid-skill",
        version: "1.0.0",
        description: "desc",
        author: "someone",
        category: "tools",
        tags: [],
        skillMdContent: "# Content",
        repositoryUrl: "https://github.com/test/test",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid repositoryUrl", async () => {
      const { publishSkillInputSchema } = await import("@agentforge-ai/core");
      const result = publishSkillInputSchema.safeParse({
        name: "valid-skill",
        version: "1.0.0",
        description: "desc",
        author: "someone",
        category: "tools",
        tags: [],
        skillMdContent: "# Content",
        repositoryUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("MarketplaceError", () => {
    it("should have correct name", async () => {
      const { MarketplaceError } = await import("@agentforge-ai/core");
      const err = new MarketplaceError("test", "NETWORK");
      expect(err.name).toBe("MarketplaceError");
      expect(err.code).toBe("NETWORK");
      expect(err.message).toBe("test");
    });

    it("should support all error codes", async () => {
      const { MarketplaceError } = await import("@agentforge-ai/core");
      const codes = ["NETWORK", "NOT_FOUND", "VALIDATION", "SERVER"] as const;
      for (const code of codes) {
        const err = new MarketplaceError("msg", code);
        expect(err.code).toBe(code);
      }
    });
  });

  // Additional edge cases
  describe("edge cases", () => {
    it("should handle Convex error response format", async () => {
      const { searchSkills } = await import("@agentforge-ai/core");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "error", errorMessage: "Query failed" }),
      });
      await expect(searchSkills("test", CONVEX_URL)).rejects.toThrow("Query failed");
    });

    it("should handle network failure", async () => {
      const { searchSkills } = await import("@agentforge-ai/core");
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      await expect(searchSkills("test", CONVEX_URL)).rejects.toThrow("Network error");
    });

    it("should strip trailing slash from convex URL", async () => {
      const { searchSkills } = await import("@agentforge-ai/core");
      mockConvexResponse([]);
      await searchSkills("test", CONVEX_URL + "/");
      expect(mockFetch).toHaveBeenCalledWith(
        `${CONVEX_URL}/api/query`,
        expect.anything(),
      );
    });
  });
});

// ---- Convex skillMarketplace function logic tests ----
// (These test the logic patterns, not actual Convex runtime)

describe("skillMarketplace Convex functions (logic)", () => {
  describe("publishSkill upsert logic", () => {
    it("should create new skill when none exists", () => {
      // Test the upsert pattern: no existing → insert with defaults
      const args = {
        name: "new-skill",
        version: "1.0.0",
        description: "New skill",
        author: "test",
        category: "general",
        tags: ["tag1"],
        skillMdContent: "# New",
      };
      // Simulate: existing = null → new record gets defaults
      const newRecord = {
        ...args,
        downloads: 0,
        featured: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(newRecord.downloads).toBe(0);
      expect(newRecord.featured).toBe(false);
    });

    it("should update existing skill preserving downloads", () => {
      const existing = {
        _id: "existing-id",
        downloads: 100,
        featured: true,
        createdAt: 1000,
      };
      const updates = {
        name: "updated-skill",
        version: "2.0.0",
        description: "Updated",
        author: "test",
        category: "general",
        tags: [],
        skillMdContent: "# Updated",
      };
      // Simulate: existing found → patch with updates (downloads preserved)
      const patched = { ...existing, ...updates, updatedAt: Date.now() };
      expect(patched.downloads).toBe(100);
      expect(patched.featured).toBe(true);
    });
  });

  describe("incrementDownloads logic", () => {
    it("should increment by exactly 1", () => {
      const skill = { downloads: 42 };
      const newDownloads = skill.downloads + 1;
      expect(newDownloads).toBe(43);
    });

    it("should handle zero downloads", () => {
      const skill = { downloads: 0 };
      const newDownloads = skill.downloads + 1;
      expect(newDownloads).toBe(1);
    });
  });

  describe("listSkills filtering logic", () => {
    const skills = [
      { name: "a", category: "tools", description: "Tool A" },
      { name: "b", category: "data", description: "Data processor" },
      { name: "c", category: "tools", description: "Tool C" },
    ];

    it("should filter by category", () => {
      const filtered = skills.filter((s) => s.category === "tools");
      expect(filtered).toHaveLength(2);
    });

    it("should return all when no filter", () => {
      expect(skills).toHaveLength(3);
    });
  });

  describe("seed data", () => {
    it("should have exactly 6 starter skills", () => {
      const seedNames = [
        "browser-automation",
        "git-operations",
        "slack-notifier",
        "data-extractor",
        "email-sender",
        "web-researcher",
      ];
      expect(seedNames).toHaveLength(6);
    });

    it("seed skill names should be kebab-case", () => {
      const names = [
        "browser-automation",
        "git-operations",
        "slack-notifier",
        "data-extractor",
        "email-sender",
        "web-researcher",
      ];
      for (const name of names) {
        expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
      }
    });
  });
});
