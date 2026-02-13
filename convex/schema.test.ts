import { ConvexTest } from "convex-test-utils";
import { expect, test } from "vitest";
import schema from "./schema";

test("should be able to create and retrieve an agent", async () => {
  const t = new ConvexTest(schema);
  const agentData = {
    id: "test-agent",
    name: "Test Agent",
    instructions: "You are a test agent.",
    model: "test-model",
  };

  const agentId = await t.mutation("agents:create", agentData);
  const agent = await t.query("agents:get", { id: "test-agent" });

  expect(agent).not.toBeNull();
  expect(agent?.name).toBe("Test Agent");
});

test("should be able to create a thread", async () => {
  const t = new ConvexTest(schema);
  const threadId = await t.mutation("threads:create", {});
  const thread = await t.query("threads:get", { id: threadId });

  expect(thread).not.toBeNull();
});

test("should be able to add messages to a thread", async () => {
  const t = new ConvexTest(schema);
  const threadId = await t.mutation("threads:create", {});

  await t.mutation("messages:create", {
    threadId,
    role: "user",
    content: "Hello, world!",
  });

  await t.mutation("messages:create", {
    threadId,
    role: "assistant",
    content: "Hi there!",
  });

  const messages = await t.query("messages:list", { threadId });

  expect(messages.length).toBe(2);
  expect(messages[0].role).toBe("user");
  expect(messages[1].role).toBe("assistant");
});

test("querying messages by thread should be efficient", async () => {
    const t = new ConvexTest(schema);
    const threadId = await t.mutation("threads:create", {});

    for (let i = 0; i < 100; i++) {
        await t.mutation("messages:create", {
            threadId,
            role: "user",
            content: `Message ${i}`,
        });
    }

    const startTime = Date.now();
    const messages = await t.query("messages:list", { threadId });
    const endTime = Date.now();

    expect(messages.length).toBe(100);
    expect(endTime - startTime).toBeLessThan(500); // Example threshold
});
