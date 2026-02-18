/**
 * Browser Automation Tool for AgentForge agents.
 *
 * Provides first-class browser automation as a built-in agent tool,
 * using Playwright for reliable cross-browser automation.
 *
 * Features:
 * - Navigate, click, type, screenshot, DOM snapshot, evaluate JS, wait
 * - Headless + headed modes
 * - Per-session browser contexts (isolated cookies/state)
 * - Accessibility tree snapshot for LLM context
 * - Cookie/auth state persistence per agent
 * - CDP (Chrome DevTools Protocol) support
 * - Docker sandbox mode for secure execution
 * - Text extraction from pages
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { MCPServer, Tool } from './mcp-server.js';

// =====================================================
// Types
// =====================================================

/**
 * Browser action types supported by the tool.
 */
export type BrowserActionKind =
  | 'navigate'
  | 'click'
  | 'type'
  | 'screenshot'
  | 'snapshot'
  | 'evaluate'
  | 'wait'
  | 'scroll'
  | 'select'
  | 'hover'
  | 'goBack'
  | 'goForward'
  | 'reload'
  | 'close'
  | 'extractText';

/**
 * Browser action discriminated union.
 */
export type BrowserAction =
  | { kind: 'navigate'; url: string }
  | { kind: 'click'; selector: string }
  | { kind: 'type'; selector: string; text: string }
  | { kind: 'screenshot'; fullPage?: boolean }
  | { kind: 'snapshot' }
  | { kind: 'evaluate'; js: string }
  | { kind: 'wait'; selector?: string; timeMs?: number }
  | { kind: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { kind: 'select'; selector: string; value: string }
  | { kind: 'hover'; selector: string }
  | { kind: 'goBack' }
  | { kind: 'goForward' }
  | { kind: 'reload' }
  | { kind: 'close' }
  | { kind: 'extractText'; selector?: string };

/**
 * Result from a browser action.
 */
export interface BrowserActionResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Action that was performed */
  action: BrowserActionKind;
  /** Result data (varies by action) */
  data?: string | Record<string, unknown>;
  /** Screenshot as base64 (for screenshot action) */
  screenshot?: string;
  /** Error message if failed */
  error?: string;
  /** Current page URL after action */
  currentUrl?: string;
  /** Current page title after action */
  pageTitle?: string;
  /** Execution time in ms */
  latencyMs: number;
}

/**
 * Configuration for the browser tool.
 */
export interface BrowserToolConfig {
  /** Whether to run in headless mode. Default: true */
  headless?: boolean;
  /** Default navigation timeout in ms. Default: 30000 */
  defaultTimeout?: number;
  /** Browser type to use. Default: 'chromium' */
  browserType?: 'chromium' | 'firefox' | 'webkit';
  /** Viewport width. Default: 1280 */
  viewportWidth?: number;
  /** Viewport height. Default: 720 */
  viewportHeight?: number;
  /** User agent string override */
  userAgent?: string;
  /** Whether to persist cookies/state. Default: false */
  persistState?: boolean;
  /** Path to store persistent state */
  statePath?: string;
  /** Extra launch args for the browser */
  launchArgs?: string[];
  /** CDP endpoint URL (for connecting to existing browser) */
  cdpEndpoint?: string;
  /** Enable Docker sandbox mode for secure execution. Default: false */
  sandboxMode?: boolean;
  /** Docker image to use in sandbox mode. Default: 'mcr.microsoft.com/playwright:v1.52.0-noble' */
  sandboxImage?: string;
  /** Maximum number of concurrent sessions. Default: 5 */
  maxSessions?: number;
}

/**
 * Simplified DOM node for LLM context.
 */
export interface SnapshotNode {
  /** The role of the element (e.g., 'button', 'link', 'textbox') */
  role: string;
  /** The accessible name of the element */
  name: string;
  /** The element's text content (truncated) */
  text?: string;
  /** CSS selector to target this element */
  selector?: string;
  /** Whether the element is interactive */
  interactive: boolean;
  /** Child nodes */
  children?: SnapshotNode[];
}

// =====================================================
// Browser Session Manager
// =====================================================

/**
 * Manages browser sessions with isolation and lifecycle.
 *
 * Each session gets its own BrowserContext with isolated cookies,
 * storage, and state. Sessions can optionally persist state.
 *
 * When `sandboxMode` is enabled, the browser runs inside a Docker
 * container for secure, isolated execution.
 */
export class BrowserSessionManager {
  private config: Required<BrowserToolConfig>;
  private browser: any = null; // Playwright Browser
  private contexts: Map<string, any> = new Map(); // sessionId -> BrowserContext
  private pages: Map<string, any> = new Map(); // sessionId -> Page
  private playwright: any = null;

  constructor(config: BrowserToolConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      defaultTimeout: config.defaultTimeout ?? 30_000,
      browserType: config.browserType ?? 'chromium',
      viewportWidth: config.viewportWidth ?? 1280,
      viewportHeight: config.viewportHeight ?? 720,
      userAgent: config.userAgent ?? '',
      persistState: config.persistState ?? false,
      statePath: config.statePath ?? '',
      launchArgs: config.launchArgs ?? [],
      cdpEndpoint: config.cdpEndpoint ?? '',
      sandboxMode: config.sandboxMode ?? false,
      sandboxImage: config.sandboxImage ?? 'mcr.microsoft.com/playwright:v1.52.0-noble',
      maxSessions: config.maxSessions ?? 5,
    };
  }

  /**
   * Initialize the browser instance.
   * Must be called before any session operations.
   *
   * In sandbox mode, this starts a Docker container with Playwright
   * and connects via CDP.
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    try {
      // Dynamic import to avoid bundling Playwright
      this.playwright = await import('playwright');
    } catch {
      throw new Error(
        'Playwright is not installed. Install it with: npm install playwright && npx playwright install chromium'
      );
    }

    const browserModule = this.playwright[this.config.browserType];
    if (!browserModule) {
      throw new Error(`Unsupported browser type: ${this.config.browserType}`);
    }

    if (this.config.sandboxMode && !this.config.cdpEndpoint) {
      // Launch browser inside Docker container
      const cdpEndpoint = await this.launchSandboxBrowser();
      this.browser = await browserModule.connectOverCDP(cdpEndpoint);
    } else if (this.config.cdpEndpoint) {
      // Connect to existing browser via CDP
      this.browser = await browserModule.connectOverCDP(this.config.cdpEndpoint);
    } else {
      this.browser = await browserModule.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          ...this.config.launchArgs,
        ],
      });
    }
  }

  /**
   * Launch a Playwright browser inside a Docker container and return the CDP endpoint.
   * This provides secure, isolated browser execution.
   */
  private async launchSandboxBrowser(): Promise<string> {
    const { execSync } = await import('child_process');
    const port = 9222 + Math.floor(Math.random() * 1000);

    try {
      // Start Docker container with Playwright browser
      const containerId = execSync(
        `docker run -d --rm ` +
        `--name agentforge-browser-${port} ` +
        `-p ${port}:9222 ` +
        `--shm-size=2gb ` +
        `${this.config.sandboxImage} ` +
        `npx playwright launch --browser ${this.config.browserType} --headless ` +
        `-- --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0`,
        { encoding: 'utf-8', timeout: 30_000 }
      ).trim();

      // Wait for browser to be ready
      let retries = 10;
      while (retries > 0) {
        try {
          const response = execSync(
            `curl -s http://localhost:${port}/json/version`,
            { encoding: 'utf-8', timeout: 5_000 }
          );
          if (response.includes('webSocketDebuggerUrl')) {
            const data = JSON.parse(response);
            return data.webSocketDebuggerUrl || `ws://localhost:${port}`;
          }
        } catch {
          // Browser not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        retries--;
      }

      // Cleanup on failure
      try {
        execSync(`docker stop agentforge-browser-${port}`, { timeout: 5_000 });
      } catch {
        // Ignore cleanup errors
      }

      throw new Error('Docker sandbox browser failed to start within timeout');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Docker sandbox browser')) {
        throw error;
      }
      throw new Error(
        `Failed to launch Docker sandbox browser: ${error instanceof Error ? error.message : String(error)}. ` +
        'Ensure Docker is installed and running.'
      );
    }
  }

  /**
   * Get or create a page for a session.
   */
  async getPage(sessionId: string = 'default'): Promise<any> {
    if (this.pages.has(sessionId)) {
      return this.pages.get(sessionId);
    }

    // Enforce max sessions
    if (this.contexts.size >= this.config.maxSessions) {
      throw new Error(
        `Maximum concurrent sessions (${this.config.maxSessions}) reached. ` +
        'Close an existing session before opening a new one.'
      );
    }

    if (!this.browser) {
      await this.initialize();
    }

    // Create isolated context
    const contextOptions: Record<string, unknown> = {
      viewport: {
        width: this.config.viewportWidth,
        height: this.config.viewportHeight,
      },
    };

    if (this.config.userAgent) {
      contextOptions.userAgent = this.config.userAgent;
    }

    if (this.config.persistState && this.config.statePath) {
      contextOptions.storageState = this.config.statePath;
    }

    const context = await this.browser.newContext(contextOptions);
    context.setDefaultTimeout(this.config.defaultTimeout);

    const page = await context.newPage();

    this.contexts.set(sessionId, context);
    this.pages.set(sessionId, page);

    return page;
  }

  /**
   * Close a specific session.
   */
  async closeSession(sessionId: string = 'default'): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (context) {
      // Optionally save state before closing
      if (this.config.persistState && this.config.statePath) {
        try {
          await context.storageState({ path: this.config.statePath });
        } catch {
          // Ignore save errors on close
        }
      }
      await context.close();
      this.contexts.delete(sessionId);
      this.pages.delete(sessionId);
    }
  }

  /**
   * Close all sessions and the browser.
   */
  async shutdown(): Promise<void> {
    for (const sessionId of this.contexts.keys()) {
      await this.closeSession(sessionId);
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * List active session IDs.
   */
  getActiveSessions(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * Check if sandbox mode is enabled.
   */
  isSandboxMode(): boolean {
    return this.config.sandboxMode;
  }

  /**
   * Get the current configuration (read-only copy).
   */
  getConfig(): Readonly<Required<BrowserToolConfig>> {
    return { ...this.config };
  }
}

// =====================================================
// Browser Action Executor
// =====================================================

/**
 * Executes browser actions on a Playwright page.
 */
export class BrowserActionExecutor {
  private sessionManager: BrowserSessionManager;

  constructor(sessionManager: BrowserSessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Execute a browser action.
   */
  async execute(
    action: BrowserAction,
    sessionId: string = 'default'
  ): Promise<BrowserActionResult> {
    const startTime = Date.now();

    try {
      const page = await this.sessionManager.getPage(sessionId);
      let result: BrowserActionResult;

      switch (action.kind) {
        case 'navigate':
          result = await this.navigate(page, action.url);
          break;
        case 'click':
          result = await this.click(page, action.selector);
          break;
        case 'type':
          result = await this.type(page, action.selector, action.text);
          break;
        case 'screenshot':
          result = await this.screenshot(page, action.fullPage);
          break;
        case 'snapshot':
          result = await this.snapshot(page);
          break;
        case 'evaluate':
          result = await this.evaluate(page, action.js);
          break;
        case 'wait':
          result = await this.wait(page, action.selector, action.timeMs);
          break;
        case 'scroll':
          result = await this.scroll(page, action.direction, action.amount);
          break;
        case 'select':
          result = await this.select(page, action.selector, action.value);
          break;
        case 'hover':
          result = await this.hover(page, action.selector);
          break;
        case 'goBack':
          result = await this.goBack(page);
          break;
        case 'goForward':
          result = await this.goForward(page);
          break;
        case 'reload':
          result = await this.reload(page);
          break;
        case 'close':
          await this.sessionManager.closeSession(sessionId);
          result = {
            success: true,
            action: 'close',
            data: 'Session closed',
            latencyMs: Date.now() - startTime,
          };
          return result;
        case 'extractText':
          result = await this.extractText(page, action.selector);
          break;
        default:
          throw new Error(`Unknown browser action: ${(action as any).kind}`);
      }

      // Add page info
      try {
        result.currentUrl = page.url();
        result.pageTitle = await page.title();
      } catch {
        // Page might be closed
      }

      result.latencyMs = Date.now() - startTime;
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        action: action.kind,
        error: errorMessage,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async navigate(page: any, url: string): Promise<BrowserActionResult> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return {
      success: true,
      action: 'navigate',
      data: `Navigated to ${url}`,
      latencyMs: 0,
    };
  }

  private async click(page: any, selector: string): Promise<BrowserActionResult> {
    await page.click(selector);
    return {
      success: true,
      action: 'click',
      data: `Clicked ${selector}`,
      latencyMs: 0,
    };
  }

  private async type(
    page: any,
    selector: string,
    text: string
  ): Promise<BrowserActionResult> {
    await page.fill(selector, text);
    return {
      success: true,
      action: 'type',
      data: `Typed "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" into ${selector}`,
      latencyMs: 0,
    };
  }

  private async screenshot(
    page: any,
    fullPage?: boolean
  ): Promise<BrowserActionResult> {
    const buffer = await page.screenshot({
      fullPage: fullPage ?? false,
      type: 'png',
    });
    const base64 = buffer.toString('base64');
    return {
      success: true,
      action: 'screenshot',
      screenshot: base64,
      data: `Screenshot captured (${Math.round(buffer.length / 1024)}KB)`,
      latencyMs: 0,
    };
  }

  private async snapshot(page: any): Promise<BrowserActionResult> {
    // Get accessibility tree for LLM context
    const snapshot = await page.evaluate(() => {
      function buildTree(element: Element, depth: number = 0): any {
        if (depth > 5) return null; // Limit depth

        const tag = element.tagName.toLowerCase();
        const role =
          element.getAttribute('role') ||
          getImplicitRole(tag);
        const name =
          element.getAttribute('aria-label') ||
          element.getAttribute('alt') ||
          element.getAttribute('title') ||
          element.getAttribute('placeholder') ||
          '';
        const text = element.textContent?.trim().substring(0, 200) || '';

        // Skip invisible elements
        const style = window.getComputedStyle(element);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0'
        ) {
          return null;
        }

        const isInteractive = [
          'a',
          'button',
          'input',
          'select',
          'textarea',
          'details',
          'summary',
        ].includes(tag);

        // Build a useful CSS selector
        let selector = tag;
        if (element.id) {
          selector = `#${element.id}`;
        } else if (element.className && typeof element.className === 'string') {
          const classes = element.className.trim().split(/\s+/).slice(0, 2);
          if (classes.length > 0 && classes[0]) {
            selector = `${tag}.${classes.join('.')}`;
          }
        }

        const children: any[] = [];
        for (let i = 0; i < element.children.length; i++) {
          const child = element.children[i];
          const childNode = buildTree(child as Element, depth + 1);
          if (childNode) {
            children.push(childNode);
          }
        }

        // Skip non-interactive containers with no useful info
        if (
          !isInteractive &&
          !name &&
          !text &&
          children.length === 0
        ) {
          return null;
        }

        // Flatten single-child containers
        if (
          !isInteractive &&
          !name &&
          children.length === 1
        ) {
          return children[0];
        }

        return {
          role,
          name,
          text: isInteractive || children.length === 0 ? text : undefined,
          selector: isInteractive ? selector : undefined,
          interactive: isInteractive,
          ...(children.length > 0 ? { children } : {}),
        };
      }

      function getImplicitRole(tag: string): string {
        const roleMap: Record<string, string> = {
          a: 'link',
          button: 'button',
          input: 'textbox',
          select: 'combobox',
          textarea: 'textbox',
          img: 'img',
          h1: 'heading',
          h2: 'heading',
          h3: 'heading',
          h4: 'heading',
          h5: 'heading',
          h6: 'heading',
          nav: 'navigation',
          main: 'main',
          header: 'banner',
          footer: 'contentinfo',
          form: 'form',
          table: 'table',
          ul: 'list',
          ol: 'list',
          li: 'listitem',
          section: 'region',
          article: 'article',
          aside: 'complementary',
          dialog: 'dialog',
        };
        return roleMap[tag] || 'generic';
      }

      return buildTree(document.body);
    });

    // Convert to compact string for LLM
    const snapshotStr = JSON.stringify(snapshot, null, 2);
    const truncated =
      snapshotStr.length > 10000
        ? snapshotStr.substring(0, 10000) + '\n... (truncated)'
        : snapshotStr;

    return {
      success: true,
      action: 'snapshot',
      data: truncated,
      latencyMs: 0,
    };
  }

  private async evaluate(page: any, js: string): Promise<BrowserActionResult> {
    const result = await page.evaluate(js);
    return {
      success: true,
      action: 'evaluate',
      data:
        typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2),
      latencyMs: 0,
    };
  }

  private async wait(
    page: any,
    selector?: string,
    timeMs?: number
  ): Promise<BrowserActionResult> {
    if (selector) {
      await page.waitForSelector(selector, { timeout: timeMs ?? 30_000 });
      return {
        success: true,
        action: 'wait',
        data: `Element "${selector}" found`,
        latencyMs: 0,
      };
    }
    if (timeMs) {
      await page.waitForTimeout(timeMs);
      return {
        success: true,
        action: 'wait',
        data: `Waited ${timeMs}ms`,
        latencyMs: 0,
      };
    }
    return {
      success: true,
      action: 'wait',
      data: 'No wait condition specified',
      latencyMs: 0,
    };
  }

  private async scroll(
    page: any,
    direction: 'up' | 'down',
    amount?: number
  ): Promise<BrowserActionResult> {
    const pixels = amount ?? 500;
    const delta = direction === 'down' ? pixels : -pixels;
    await page.evaluate((d: number) => window.scrollBy(0, d), delta);
    return {
      success: true,
      action: 'scroll',
      data: `Scrolled ${direction} ${pixels}px`,
      latencyMs: 0,
    };
  }

  private async select(
    page: any,
    selector: string,
    value: string
  ): Promise<BrowserActionResult> {
    await page.selectOption(selector, value);
    return {
      success: true,
      action: 'select',
      data: `Selected "${value}" in ${selector}`,
      latencyMs: 0,
    };
  }

  private async hover(page: any, selector: string): Promise<BrowserActionResult> {
    await page.hover(selector);
    return {
      success: true,
      action: 'hover',
      data: `Hovered over ${selector}`,
      latencyMs: 0,
    };
  }

  private async goBack(page: any): Promise<BrowserActionResult> {
    await page.goBack({ waitUntil: 'domcontentloaded' });
    return {
      success: true,
      action: 'goBack',
      data: 'Navigated back',
      latencyMs: 0,
    };
  }

  private async goForward(page: any): Promise<BrowserActionResult> {
    await page.goForward({ waitUntil: 'domcontentloaded' });
    return {
      success: true,
      action: 'goForward',
      data: 'Navigated forward',
      latencyMs: 0,
    };
  }

  private async reload(page: any): Promise<BrowserActionResult> {
    await page.reload({ waitUntil: 'domcontentloaded' });
    return {
      success: true,
      action: 'reload',
      data: 'Page reloaded',
      latencyMs: 0,
    };
  }

  /**
   * Extract text content from the page or a specific element.
   */
  private async extractText(
    page: any,
    selector?: string
  ): Promise<BrowserActionResult> {
    let text: string;

    if (selector) {
      text = await page.textContent(selector) ?? '';
    } else {
      text = await page.evaluate(() => {
        // Extract meaningful text, skipping scripts and styles
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node: Text) => {
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              const tag = parent.tagName.toLowerCase();
              if (['script', 'style', 'noscript'].includes(tag)) {
                return NodeFilter.FILTER_REJECT;
              }
              const style = window.getComputedStyle(parent);
              if (style.display === 'none' || style.visibility === 'hidden') {
                return NodeFilter.FILTER_REJECT;
              }
              if (!node.textContent?.trim()) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            },
          }
        );

        const parts: string[] = [];
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          const trimmed = node.textContent?.trim();
          if (trimmed) parts.push(trimmed);
        }
        return parts.join('\n');
      });
    }

    // Truncate very long text for LLM context
    const maxLength = 50_000;
    const truncated = text.length > maxLength
      ? text.substring(0, maxLength) + `\n... (truncated, ${text.length} total chars)`
      : text;

    return {
      success: true,
      action: 'extractText',
      data: truncated,
      latencyMs: 0,
    };
  }
}

// =====================================================
// MCP Tool Registration
// =====================================================

/**
 * Zod schema for browser action input.
 */
export const browserActionSchema = z.object({
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('navigate'), url: z.string().url() }),
    z.object({ kind: z.literal('click'), selector: z.string() }),
    z.object({
      kind: z.literal('type'),
      selector: z.string(),
      text: z.string(),
    }),
    z.object({
      kind: z.literal('screenshot'),
      fullPage: z.boolean().optional(),
    }),
    z.object({ kind: z.literal('snapshot') }),
    z.object({ kind: z.literal('evaluate'), js: z.string() }),
    z.object({
      kind: z.literal('wait'),
      selector: z.string().optional(),
      timeMs: z.number().optional(),
    }),
    z.object({
      kind: z.literal('scroll'),
      direction: z.enum(['up', 'down']),
      amount: z.number().optional(),
    }),
    z.object({
      kind: z.literal('select'),
      selector: z.string(),
      value: z.string(),
    }),
    z.object({ kind: z.literal('hover'), selector: z.string() }),
    z.object({ kind: z.literal('goBack') }),
    z.object({ kind: z.literal('goForward') }),
    z.object({ kind: z.literal('reload') }),
    z.object({ kind: z.literal('close') }),
    z.object({
      kind: z.literal('extractText'),
      selector: z.string().optional(),
    }),
  ]),
  sessionId: z.string().optional(),
});

/**
 * Zod schema for browser action result.
 */
export const browserActionResultSchema = z.object({
  success: z.boolean(),
  action: z.string(),
  data: z.union([z.string(), z.record(z.unknown())]).optional(),
  screenshot: z.string().optional(),
  error: z.string().optional(),
  currentUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  latencyMs: z.number(),
});

/**
 * Create a browser tool that can be registered with an MCPServer.
 *
 * @param config - Browser tool configuration
 * @returns A Tool instance ready for MCPServer.registerTool()
 *
 * @example
 * ```typescript
 * import { MCPServer } from '@agentforge-ai/core';
 * import { createBrowserTool } from '@agentforge-ai/core';
 *
 * const server = new MCPServer({ name: 'browser-tools' });
 * const { tool, shutdown } = createBrowserTool({ headless: true });
 * server.registerTool(tool);
 *
 * // Use with an agent
 * agent.addTools(server);
 *
 * // Cleanup when done
 * await shutdown();
 * ```
 *
 * @example
 * ```typescript
 * // Docker sandbox mode for secure execution
 * const { tool, shutdown } = createBrowserTool({
 *   sandboxMode: true,
 *   headless: true,
 * });
 * ```
 */
export function createBrowserTool(config: BrowserToolConfig = {}): {
  tool: Tool<typeof browserActionSchema, typeof browserActionResultSchema>;
  sessionManager: BrowserSessionManager;
  shutdown: () => Promise<void>;
} {
  const sessionManager = new BrowserSessionManager(config);
  const executor = new BrowserActionExecutor(sessionManager);

  const tool: Tool<typeof browserActionSchema, typeof browserActionResultSchema> = {
    name: 'browser',
    description:
      'Interact with web pages using browser automation. ' +
      'Supports: navigate, click, type, screenshot, snapshot (accessibility tree), ' +
      'evaluate JS, wait, scroll, select, hover, goBack, goForward, reload, close, extractText. ' +
      'Each session has isolated cookies and state.' +
      (config.sandboxMode ? ' Running in Docker sandbox mode for secure execution.' : ''),
    inputSchema: browserActionSchema,
    outputSchema: browserActionResultSchema,
    handler: async (input) => {
      const result = await executor.execute(
        input.action as BrowserAction,
        input.sessionId
      );
      return result;
    },
  };

  return {
    tool,
    sessionManager,
    shutdown: () => sessionManager.shutdown(),
  };
}

/**
 * Register browser tools on an existing MCPServer.
 *
 * Convenience function that creates and registers the browser tool
 * on the provided server.
 *
 * @param server - The MCPServer to register the tool on
 * @param config - Browser tool configuration
 * @returns Object with sessionManager and shutdown function
 */
export function registerBrowserTool(
  server: MCPServer,
  config: BrowserToolConfig = {}
): {
  sessionManager: BrowserSessionManager;
  shutdown: () => Promise<void>;
} {
  const { tool, sessionManager, shutdown } = createBrowserTool(config);
  server.registerTool(tool);
  return { sessionManager, shutdown };
}
