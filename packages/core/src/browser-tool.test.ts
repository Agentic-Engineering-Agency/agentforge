/**
 * Tests for Browser Automation Tool
 *
 * These tests verify the tool's structure, schemas, and action executor logic
 * without requiring a real Playwright browser (mocked).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BrowserSessionManager,
  BrowserActionExecutor,
  createBrowserTool,
  registerBrowserTool,
  browserActionSchema,
  browserActionResultSchema,
  type BrowserAction,
  type BrowserToolConfig,
} from './browser-tool.js';
import { MCPServer } from './mcp-server.js';

// =====================================================
// Mock Playwright
// =====================================================

const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  click: vi.fn().mockResolvedValue(undefined),
  fill: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png-data')),
  evaluate: vi.fn().mockResolvedValue({ role: 'generic', name: '', interactive: false }),
  waitForSelector: vi.fn().mockResolvedValue(undefined),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  selectOption: vi.fn().mockResolvedValue(undefined),
  hover: vi.fn().mockResolvedValue(undefined),
  goBack: vi.fn().mockResolvedValue(undefined),
  goForward: vi.fn().mockResolvedValue(undefined),
  reload: vi.fn().mockResolvedValue(undefined),
  url: vi.fn().mockReturnValue('https://example.com'),
  title: vi.fn().mockResolvedValue('Example Page'),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  setDefaultTimeout: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  storageState: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
    connectOverCDP: vi.fn().mockResolvedValue(mockBrowser),
  },
  firefox: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
  webkit: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// =====================================================
// Tests
// =====================================================

describe('BrowserSessionManager', () => {
  let manager: BrowserSessionManager;

  beforeEach(() => {
    manager = new BrowserSessionManager({ headless: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  it('should initialize with default config', () => {
    const m = new BrowserSessionManager();
    expect(m).toBeDefined();
  });

  it('should create a page for a session', async () => {
    const page = await manager.getPage('test-session');
    expect(page).toBeDefined();
    expect(mockBrowser.newContext).toHaveBeenCalled();
    expect(mockContext.newPage).toHaveBeenCalled();
  });

  it('should reuse existing page for same session', async () => {
    const page1 = await manager.getPage('test');
    const page2 = await manager.getPage('test');
    expect(page1).toBe(page2);
    // newContext should only be called once
    expect(mockBrowser.newContext).toHaveBeenCalledTimes(1);
  });

  it('should create separate contexts for different sessions', async () => {
    await manager.getPage('session-1');
    await manager.getPage('session-2');
    expect(mockBrowser.newContext).toHaveBeenCalledTimes(2);
  });

  it('should list active sessions', async () => {
    await manager.getPage('a');
    await manager.getPage('b');
    const sessions = manager.getActiveSessions();
    expect(sessions).toContain('a');
    expect(sessions).toContain('b');
    expect(sessions).toHaveLength(2);
  });

  it('should close a session', async () => {
    await manager.getPage('to-close');
    await manager.closeSession('to-close');
    expect(mockContext.close).toHaveBeenCalled();
    expect(manager.getActiveSessions()).not.toContain('to-close');
  });

  it('should shutdown all sessions', async () => {
    await manager.getPage('s1');
    await manager.getPage('s2');
    await manager.shutdown();
    expect(manager.getActiveSessions()).toHaveLength(0);
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});

describe('BrowserActionExecutor', () => {
  let manager: BrowserSessionManager;
  let executor: BrowserActionExecutor;

  beforeEach(() => {
    manager = new BrowserSessionManager({ headless: true });
    executor = new BrowserActionExecutor(manager);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  it('should execute navigate action', async () => {
    const result = await executor.execute({
      kind: 'navigate',
      url: 'https://example.com',
    });
    expect(result.success).toBe(true);
    expect(result.action).toBe('navigate');
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'domcontentloaded',
    });
  });

  it('should execute click action', async () => {
    const result = await executor.execute({ kind: 'click', selector: '#btn' });
    expect(result.success).toBe(true);
    expect(result.action).toBe('click');
    expect(mockPage.click).toHaveBeenCalledWith('#btn');
  });

  it('should execute type action', async () => {
    const result = await executor.execute({
      kind: 'type',
      selector: '#input',
      text: 'Hello World',
    });
    expect(result.success).toBe(true);
    expect(result.action).toBe('type');
    expect(mockPage.fill).toHaveBeenCalledWith('#input', 'Hello World');
  });

  it('should execute screenshot action', async () => {
    const result = await executor.execute({ kind: 'screenshot' });
    expect(result.success).toBe(true);
    expect(result.action).toBe('screenshot');
    expect(result.screenshot).toBeDefined();
    expect(typeof result.screenshot).toBe('string');
  });

  it('should execute snapshot action', async () => {
    const result = await executor.execute({ kind: 'snapshot' });
    expect(result.success).toBe(true);
    expect(result.action).toBe('snapshot');
  });

  it('should execute evaluate action', async () => {
    mockPage.evaluate.mockResolvedValueOnce('evaluated result');
    const result = await executor.execute({
      kind: 'evaluate',
      js: 'document.title',
    });
    expect(result.success).toBe(true);
    expect(result.action).toBe('evaluate');
    expect(result.data).toBe('evaluated result');
  });

  it('should execute wait with selector', async () => {
    const result = await executor.execute({
      kind: 'wait',
      selector: '#loading',
    });
    expect(result.success).toBe(true);
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#loading', {
      timeout: 30000,
    });
  });

  it('should execute wait with time', async () => {
    const result = await executor.execute({ kind: 'wait', timeMs: 1000 });
    expect(result.success).toBe(true);
    expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
  });

  it('should execute scroll action', async () => {
    const result = await executor.execute({
      kind: 'scroll',
      direction: 'down',
      amount: 300,
    });
    expect(result.success).toBe(true);
    expect(result.action).toBe('scroll');
  });

  it('should execute select action', async () => {
    const result = await executor.execute({
      kind: 'select',
      selector: '#dropdown',
      value: 'option1',
    });
    expect(result.success).toBe(true);
    expect(mockPage.selectOption).toHaveBeenCalledWith('#dropdown', 'option1');
  });

  it('should execute hover action', async () => {
    const result = await executor.execute({
      kind: 'hover',
      selector: '#menu',
    });
    expect(result.success).toBe(true);
    expect(mockPage.hover).toHaveBeenCalledWith('#menu');
  });

  it('should execute goBack action', async () => {
    const result = await executor.execute({ kind: 'goBack' });
    expect(result.success).toBe(true);
    expect(mockPage.goBack).toHaveBeenCalled();
  });

  it('should execute goForward action', async () => {
    const result = await executor.execute({ kind: 'goForward' });
    expect(result.success).toBe(true);
    expect(mockPage.goForward).toHaveBeenCalled();
  });

  it('should execute reload action', async () => {
    const result = await executor.execute({ kind: 'reload' });
    expect(result.success).toBe(true);
    expect(mockPage.reload).toHaveBeenCalled();
  });

  it('should execute close action', async () => {
    const result = await executor.execute({ kind: 'close' });
    expect(result.success).toBe(true);
    expect(result.action).toBe('close');
  });

  it('should handle errors gracefully', async () => {
    mockPage.click.mockRejectedValueOnce(new Error('Element not found'));
    const result = await executor.execute({
      kind: 'click',
      selector: '#nonexistent',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Element not found');
  });

  it('should include page URL and title in results', async () => {
    const result = await executor.execute({
      kind: 'navigate',
      url: 'https://example.com',
    });
    expect(result.currentUrl).toBe('https://example.com');
    expect(result.pageTitle).toBe('Example Page');
  });

  it('should track latency', async () => {
    const result = await executor.execute({
      kind: 'navigate',
      url: 'https://example.com',
    });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Zod Schemas', () => {
  it('should validate navigate action', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'navigate', url: 'https://example.com' },
    });
    expect(result.success).toBe(true);
  });

  it('should validate click action', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'click', selector: '#btn' },
    });
    expect(result.success).toBe(true);
  });

  it('should validate type action', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'type', selector: '#input', text: 'hello' },
    });
    expect(result.success).toBe(true);
  });

  it('should validate screenshot action', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'screenshot', fullPage: true },
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid action kind', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'invalid' },
    });
    expect(result.success).toBe(false);
  });

  it('should validate with optional sessionId', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'snapshot' },
      sessionId: 'my-session',
    });
    expect(result.success).toBe(true);
  });

  it('should validate result schema', () => {
    const result = browserActionResultSchema.safeParse({
      success: true,
      action: 'navigate',
      data: 'Navigated to https://example.com',
      currentUrl: 'https://example.com',
      pageTitle: 'Example',
      latencyMs: 150,
    });
    expect(result.success).toBe(true);
  });
});

describe('createBrowserTool', () => {
  it('should create a tool with correct name', () => {
    const { tool, shutdown } = createBrowserTool();
    expect(tool.name).toBe('browser');
    expect(tool.description).toContain('browser automation');
    // Don't forget to shutdown
    shutdown();
  });

  it('should accept custom config', () => {
    const { tool, shutdown } = createBrowserTool({
      headless: false,
      browserType: 'firefox',
      viewportWidth: 1920,
    });
    expect(tool.name).toBe('browser');
    shutdown();
  });

  it('should return a shutdown function', () => {
    const { shutdown } = createBrowserTool();
    expect(typeof shutdown).toBe('function');
    shutdown();
  });

  it('should return a session manager', () => {
    const { sessionManager, shutdown } = createBrowserTool();
    expect(sessionManager).toBeInstanceOf(BrowserSessionManager);
    shutdown();
  });
});

describe('registerBrowserTool', () => {
  it('should register the tool on an MCPServer', () => {
    const server = new MCPServer({ name: 'test' });
    const { shutdown } = registerBrowserTool(server);

    const tools = server.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('browser');

    shutdown();
  });

  it('should accept config options', () => {
    const server = new MCPServer({ name: 'test' });
    const { sessionManager, shutdown } = registerBrowserTool(server, {
      headless: true,
      defaultTimeout: 60000,
    });

    expect(sessionManager).toBeInstanceOf(BrowserSessionManager);
    shutdown();
  });
});
