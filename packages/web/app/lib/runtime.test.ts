import { afterEach, describe, expect, it, vi } from "vitest";

const originalWindowValue = (globalThis as any).window;

describe("runtime config", () => {
  afterEach(() => {
    vi.resetModules();
    if (originalWindowValue === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindowValue;
    }
  });

  it("prefers injected window daemon url", async () => {
    (globalThis as any).window = { __AGENTFORGE_DAEMON_URL__: "http://localhost:3010" };
    vi.stubEnv("VITE_AGENTFORGE_DAEMON_URL", "http://localhost:3001");

    const { getDaemonUrl } = await import("./runtime");
    expect(getDaemonUrl()).toBe("http://localhost:3010");
  });

  it("falls back to Vite env daemon url", async () => {
    (globalThis as any).window = {};
    vi.stubEnv("VITE_AGENTFORGE_DAEMON_URL", "http://localhost:3011");

    const { getDaemonUrl } = await import("./runtime");
    expect(getDaemonUrl()).toBe("http://localhost:3011");
  });
});
