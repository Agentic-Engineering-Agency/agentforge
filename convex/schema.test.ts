import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSource = readFileSync(join(__dirname, "schema.ts"), "utf-8");

// These tests verify schema structure by parsing the source file.
// Convex validates the schema at deploy time; these catch structural drift early.

const REQUIRED_TABLES = [
  "agents",
  "threads",
  "messages",
  "projects",
  "skills",
  "usage",
  "cronJobs",
  "files",
  "sessions",
  "settings",
  "vault",
  "workflowDefinitions",
  "workflowRuns",
  "workflowSteps",
];

describe("Convex Schema Structure (source-level)", () => {
  it("should use defineSchema from convex/server", () => {
    expect(schemaSource).toContain('import { defineSchema, defineTable } from "convex/server"');
  });

  for (const table of REQUIRED_TABLES) {
    it(`should define the '${table}' table`, () => {
      // Match table definition: `tableName: defineTable({`
      const pattern = new RegExp(`${table}:\\s*defineTable\\(`);
      expect(schemaSource).toMatch(pattern);
    });
  }

  it("should reference projectId in the schema", () => {
    // Project scoping was added in Phase 1 (AGE-106)
    // Just verify projectId appears multiple times (once per scoped table)
    const matches = schemaSource.match(/projectId/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(8);
  });

  it("should define compound indexes for performance", () => {
    // Compound indexes added per audit findings
    const expectedIndexes = [
      "byActiveUser",
      "byProjectAndInstalled",
      "byUserAndDefault",
      "byUserAndTimestamp",
    ];
    for (const idx of expectedIndexes) {
      expect(schemaSource).toContain(idx);
    }
  });

  it("should export default schema", () => {
    expect(schemaSource).toMatch(/export default defineSchema\(/);
  });
});
