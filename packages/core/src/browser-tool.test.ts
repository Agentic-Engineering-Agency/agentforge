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
  textContent: vi.fn().mockResolvedValue('Extracted text content'),
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

  it('should report sandbox mode status', () => {
    const normalManager = new BrowserSessionManager({ headless: true });
    expect(normalManager.isSandboxMode()).toBe(false);

    const sandboxManager = new BrowserSessionManager({ sandboxMode: true });
    expect(sandboxManager.isSandboxMode()).toBe(true);
  });

  it('should return config via getConfig', () => {
    const m = new BrowserSessionManager({
      headless: false,
      browserType: 'firefox',
      viewportWidth: 1920,
      maxSessions: 10,
    });
    const config = m.getConfig();
    expect(config.headless).toBe(false);
    expect(config.browserType).toBe('firefox');
    expect(config.viewportWidth).toBe(1920);
    expect(config.maxSessions).toBe(10);
  });

  it('should apply default config values', () => {
    const m = new BrowserSessionManager();
    const config = m.getConfig();
    expect(config.headless).toBe(true);
    expect(config.defaultTimeout).toBe(30_000);
    expect(config.browserType).toBe('chromium');
    expect(config.viewportWidth).toBe(1280);
    expect(config.viewportHeight).toBe(720);
    expect(config.userAgent).toBe('');
    expect(config.persistState).toBe(false);
    expect(config.statePath).toBe('');
    expect(config.launchArgs).toEqual([]);
    expect(config.cdpEndpoint).toBe('');
    expect(config.sandboxMode).toBe(false);
    expect(config.sandboxImage).toBe('mcr.microsoft.com/playwright:v1.52.0-noble');
    expect(config.maxSessions).toBe(5);
  });

  it('should enforce max sessions limit', async () => {
    const limitedManager = new BrowserSessionManager({
      headless: true,
      maxSessions: 2,
    });

    await limitedManager.getPage('s1');
    await limitedManager.getPage('s2');

    await expect(limitedManager.getPage('s3')).rejects.toThrow(
      'Maximum concurrent sessions (2) reached'
    );

    await limitedManager.shutdown();
  });

  it('should allow new session after closing one at max capacity', async () => {
    const limitedManager = new BrowserSessionManager({
      headless: true,
      maxSessions: 2,
    });

    await limitedManager.getPage('s1');
    await limitedManager.getPage('s2');
    await limitedManager.closeSession('s1');

    // Should now be able to create a new session
    const page = await limitedManager.getPage('s3');
    expect(page).toBeDefined();

    await limitedManager.shutdown();
  });

  it('should call connectOverCDP when cdpEndpoint is provided', async () => {
    const { chromium } = await import('playwright');
    const cdpManager = new BrowserSessionManager({
      headless: true,
      cdpEndpoint: 'ws://localhost:9222',
    });

    await cdpManager.getPage('cdp-session');

    expect(chromium.connectOverCDP).toHaveBeenCalledWith('ws://localhost:9222');

    await cdpManager.shutdown();
  });

  it('should pass userAgent to context options', async () => {
    const ua = 'TestAgent/1.0';
    const uaManager = new BrowserSessionManager({
      headless: true,
      userAgent: ua,
    });

    await uaManager.getPage('ua-session');

    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({ userAgent: ua })
    );

    await uaManager.shutdown();
  });

  it('should pass viewport dimensions to context options', async () => {
    const vpManager = new BrowserSessionManager({
      headless: true,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });

    await vpManager.getPage('vp-session');

    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: { width: 1920, height: 1080 },
      })
    );

    await vpManager.shutdown();
  });

  it('should pass storageState path to context options when persistState is true', async () => {
    const stateManager = new BrowserSessionManager({
      headless: true,
      persistState: true,
      statePath: '/tmp/state.json',
    });

    await stateManager.getPage('state-session');

    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({ storageState: '/tmp/state.json' })
    );

    await stateManager.shutdown();
  });

  it('should call setDefaultTimeout on new context', async () => {
    const timeoutManager = new BrowserSessionManager({
      headless: true,
      defaultTimeout: 45_000,
    });

    await timeoutManager.getPage('timeout-session');

    expect(mockContext.setDefaultTimeout).toHaveBeenCalledWith(45_000);

    await timeoutManager.shutdown();
  });

  it('should not throw when closing a non-existent session', async () => {
    await expect(manager.closeSession('does-not-exist')).resolves.toBeUndefined();
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

  it('should truncate long text in type result', async () => {
    const longText = 'A'.repeat(100);
    const result = await executor.execute({
      kind: 'type',
      selector: '#input',
      text: longText,
    });
    expect(result.success).toBe(true);
    expect(result.data).toContain('...');
  });

  it('should execute screenshot action', async () => {
    const result = await executor.execute({ kind: 'screenshot' });
    expect(result.success).toBe(true);
    expect(result.action).toBe('screenshot');
    expect(result.screenshot).toBeDefined();
    expect(typeof result.screenshot).toBe('string');
  });

  it('should execute full-page screenshot', async () => {
    const result = await executor.execute({ kind: 'screenshot', fullPage: true });
    expect(result.success).toBe(true);
    expect(mockPage.screenshot).toHaveBeenCalledWith({
      fullPage: true,
      type: 'png',
    });
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

  it('should handle non-string evaluate results', async () => {
    mockPage.evaluate.mockResolvedValueOnce({ key: 'value' });
    const result = await executor.execute({
      kind: 'evaluate',
      js: 'JSON.parse("{\\"key\\":\\"value\\"}")',
    });
    expect(result.success).toBe(true);
    expect(result.data).toContain('"key"');
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

  it('should handle wait with no condition', async () => {
    const result = await executor.execute({ kind: 'wait' });
    expect(result.success).toBe(true);
    expect(result.data).toBe('No wait condition specified');
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

  it('should scroll up with default amount', async () => {
    const result = await executor.execute({
      kind: 'scroll',
      direction: 'up',
    });
    expect(result.success).toBe(true);
    expect(result.data).toContain('up');
    expect(result.data).toContain('500');
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

  it('should execute extractText action with selector', async () => {
    mockPage.textContent.mockResolvedValueOnce('Hello from element');
    const result = await executor.execute({
      kind: 'extractText',
      selector: '#content',
    });
    expect(result.success).toBe(true);
    expect(result.action).toBe('extractText');
    expect(result.data).toBe('Hello from element');
    expect(mockPage.textContent).toHaveBeenCalledWith('#content');
  });

  it('should execute extractText action without selector (full page)', async () => {
    mockPage.evaluate.mockResolvedValueOnce('Full page text content');
    const result = await executor.execute({
      kind: 'extractText',
    });
    expect(result.success).toBe(true);
    expect(result.action).toBe('extractText');
    expect(result.data).toBe('Full page text content');
  });

  it('should handle null textContent gracefully', async () => {
    mockPage.textContent.mockResolvedValueOnce(null);
    const result = await executor.execute({
      kind: 'extractText',
      selector: '#empty',
    });
    expect(result.success).toBe(true);
    expect(result.data).toBe('');
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

  it('should handle page info errors gracefully', async () => {
    mockPage.url.mockImplementationOnce(() => { throw new Error('Page closed'); });
    const result = await executor.execute({
      kind: 'navigate',
      url: 'https://example.com',
    });
    // Should still succeed — page info errors are swallowed
    expect(result.success).toBe(true);
  });

  it('should use different sessions independently', async () => {
    const result1 = await executor.execute(
      { kind: 'navigate', url: 'https://site-a.com' },
      'session-a'
    );
    const result2 = await executor.execute(
      { kind: 'navigate', url: 'https://site-b.com' },
      'session-b'
    );
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(mockBrowser.newContext).toHaveBeenCalledTimes(2);
  });

  it('should pass custom timeout to waitForSelector when both selector and timeMs provided', async () => {
    const result = await executor.execute({
      kind: 'wait',
      selector: '#content',
      timeMs: 10_000,
    });
    expect(result.success).toBe(true);
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#content', {
      timeout: 10_000,
    });
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

  it('should validate extractText action', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'extractText' },
    });
    expect(result.success).toBe(true);
  });

  it('should validate extractText action with selector', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'extractText', selector: '#content' },
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

  it('should validate result schema with error', () => {
    const result = browserActionResultSchema.safeParse({
      success: false,
      action: 'click',
      error: 'Element not found',
      latencyMs: 50,
    });
    expect(result.success).toBe(true);
  });

  it('should validate result schema with screenshot', () => {
    const result = browserActionResultSchema.safeParse({
      success: true,
      action: 'screenshot',
      screenshot: 'base64data',
      data: 'Screenshot captured (10KB)',
      latencyMs: 200,
    });
    expect(result.success).toBe(true);
  });

  it('should reject navigate with invalid URL', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'navigate', url: 'not-a-url' },
    });
    expect(result.success).toBe(false);
  });

  it('should validate scroll action', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'scroll', direction: 'down', amount: 500 },
    });
    expect(result.success).toBe(true);
  });

  it('should validate select action', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'select', selector: '#dropdown', value: 'opt1' },
    });
    expect(result.success).toBe(true);
  });

  it('should validate hover action', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'hover', selector: '.menu' },
    });
    expect(result.success).toBe(true);
  });

  it('should validate navigation actions', () => {
    expect(browserActionSchema.safeParse({ action: { kind: 'goBack' } }).success).toBe(true);
    expect(browserActionSchema.safeParse({ action: { kind: 'goForward' } }).success).toBe(true);
    expect(browserActionSchema.safeParse({ action: { kind: 'reload' } }).success).toBe(true);
    expect(browserActionSchema.safeParse({ action: { kind: 'close' } }).success).toBe(true);
  });

  it('should validate wait action with both params', () => {
    const result = browserActionSchema.safeParse({
      action: { kind: 'wait', selector: '#el', timeMs: 5000 },
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

  it('should include sandbox mode in description when enabled', () => {
    const { tool, shutdown } = createBrowserTool({ sandboxMode: true });
    expect(tool.description).toContain('Docker sandbox mode');
    shutdown();
  });

  it('should not include sandbox mode in description when disabled', () => {
    const { tool, shutdown } = createBrowserTool({ sandboxMode: false });
    expect(tool.description).not.toContain('Docker sandbox mode');
    shutdown();
  });

  it('should include extractText in description', () => {
    const { tool, shutdown } = createBrowserTool();
    expect(tool.description).toContain('extractText');
    shutdown();
  });

  it('should have valid input and output schemas', () => {
    const { tool, shutdown } = createBrowserTool();
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
    expect(typeof tool.handler).toBe('function');
    shutdown();
  });

  it('should delegate to executor when handler is called', async () => {
    const { tool, shutdown } = createBrowserTool({ headless: true });

    const result = await tool.handler({
      action: { kind: 'navigate', url: 'https://example.com' },
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('navigate');
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'domcontentloaded',
    });

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

  it('should register tool with sandbox mode config', () => {
    const server = new MCPServer({ name: 'test' });
    const { sessionManager, shutdown } = registerBrowserTool(server, {
      sandboxMode: true,
    });

    expect(sessionManager.isSandboxMode()).toBe(true);
    shutdown();
  });
});
