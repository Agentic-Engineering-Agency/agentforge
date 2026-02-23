import { describe, it, expect } from "vitest";
import schema from "./schema";

// These tests verify the schema structure without requiring a running Convex backend.
// convex-test-utils is not available in this environment, so we test the schema object directly.

describe("Convex Schema Structure", () => {
  it("should export a valid schema object", () => {
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  it("should define the agents table", () => {
    expect(schema.tables).toHaveProperty("agents");
  });

  it("should define the threads table", () => {
    expect(schema.tables).toHaveProperty("threads");
  });

  it("should define the messages table", () => {
    expect(schema.tables).toHaveProperty("messages");
  });

  it("should define the projects table", () => {
    expect(schema.tables).toHaveProperty("projects");
  });

  it("should define the skills table", () => {
    expect(schema.tables).toHaveProperty("skills");
  });

  it("should define the usage table", () => {
    expect(schema.tables).toHaveProperty("usage");
  });

  it("should define the cronJobs table", () => {
    expect(schema.tables).toHaveProperty("cronJobs");
  });

  it("should define the files table", () => {
    expect(schema.tables).toHaveProperty("files");
  });

  it("should define the sessions table", () => {
    expect(schema.tables).toHaveProperty("sessions");
  });

  it("should define the settings table", () => {
    expect(schema.tables).toHaveProperty("settings");
  });

  it("should define the vault table", () => {
    expect(schema.tables).toHaveProperty("vault");
  });

  it("should define the workflowDefinitions table", () => {
    expect(schema.tables).toHaveProperty("workflowDefinitions");
  });

  it("should define the workflowRuns table", () => {
    expect(schema.tables).toHaveProperty("workflowRuns");
  });
});
