/**
 * Browser automation commands for testing and web scraping.
 */

import { Command } from 'commander';
import { getContext } from '../lib/context.js';
import { createBrowserTool } from '@agentforge-ai/core';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import * as fs from 'fs';

export const browserCommand = new Command('browser');

browserCommand.description('Browser automation for testing and web scraping');

// Open URL command
browserCommand
  .command('open')
  .description('Open a URL in the browser and get page info')
  .argument('<url>', 'URL to open')
  .option('-w, --wait <ms>', 'Wait time after navigation in ms', '5000')
  .option('-s, --screenshot', 'Take a screenshot after loading')
  .option('-o, --output <path>', 'Screenshot output path')
  .option('-t, --text', 'Extract text content from page')
  .option('--headed', 'Run in headed mode (visible browser)')
  .action(async (url, options) => {
    const { tool, shutdown, sessionManager } = createBrowserTool({
      headless: !options.headed,
    });

    try {
      console.log('Opening:', url);

      // Navigate
      const navResult = await tool.handler({
        action: { kind: 'navigate', url },
      });

      if (!navResult.success) {
        console.error('Failed to navigate:', navResult.error);
        process.exit(1);
      }

      console.log('✓ Page loaded');
      console.log('  Title:', navResult.pageTitle);
      console.log('  URL:', navResult.currentUrl);

      // Wait for dynamic content
      if (options.wait !== '0') {
        await tool.handler({
          action: { kind: 'wait', timeMs: parseInt(options.wait, 10) },
        });
      }

      // Extract text
      if (options.text) {
        const textResult = await tool.handler({
          action: { kind: 'extractText' },
        });

        if (textResult.success && textResult.data) {
          const text = typeof textResult.data === 'string' ? textResult.data : JSON.stringify(textResult.data);
          console.log('\n--- Page Text ---');
          console.log(text.substring(0, 2000));
          if (text.length > 2000) {
            console.log('...(truncated)');
          }
        }
      }

      // Screenshot
      if (options.screenshot || options.output) {
        const screenshotResult = await tool.handler({
          action: { kind: 'screenshot', fullPage: false },
        });

        if (screenshotResult.success && screenshotResult.screenshot) {
          const outputPath = options.output || `screenshot-${Date.now()}.png`;
          const buffer = Buffer.from(screenshotResult.screenshot, 'base64');

          // Ensure directory exists
          const dir = dirname(outputPath);
          await mkdir(dir, { recursive: true });
          await writeFile(outputPath, buffer);

          console.log('\n✓ Screenshot saved to:', outputPath);
        }
      }

      // Snapshot (accessibility tree)
      const snapshotResult = await tool.handler({
        action: { kind: 'snapshot' },
      });

      if (snapshotResult.success && snapshotResult.data) {
        console.log('\n--- Page Structure ---');
        const snapshot = typeof snapshotResult.data === 'string'
          ? snapshotResult.data
          : JSON.stringify(snapshotResult.data, null, 2);
        console.log(snapshot.substring(0, 1000));
        if (snapshot.length > 1000) {
          console.log('...(truncated)');
        }
      }
    } finally {
      await shutdown();
    }
  });

// Screenshot command
browserCommand
  .command('screenshot')
  .description('Take a screenshot of a webpage')
  .argument('<url>', 'URL to screenshot')
  .option('-o, --output <path>', 'Output file path', 'screenshot.png')
  .option('--full-page', 'Capture full page (not just viewport)')
  .option('--headed', 'Run in headed mode (visible browser)')
  .option('-w, --wait <ms>', 'Wait time before screenshot in ms', '3000')
  .action(async (url, options) => {
    const { tool, shutdown } = createBrowserTool({
      headless: !options.headed,
    });

    try {
      console.log('Navigating to:', url);

      // Navigate
      const navResult = await tool.handler({
        action: { kind: 'navigate', url },
      });

      if (!navResult.success) {
        console.error('Failed to navigate:', navResult.error);
        process.exit(1);
      }

      // Wait for dynamic content
      await tool.handler({
        action: { kind: 'wait', timeMs: parseInt(options.wait, 10) },
      });

      console.log('Taking screenshot...');

      // Screenshot
      const screenshotResult = await tool.handler({
        action: { kind: 'screenshot', fullPage: options.fullPage },
      });

      if (!screenshotResult.success || !screenshotResult.screenshot) {
        console.error('Failed to take screenshot:', screenshotResult.error);
        process.exit(1);
      }

      // Save screenshot
      const buffer = Buffer.from(screenshotResult.screenshot, 'base64');
      const dir = dirname(options.output);
      await mkdir(dir, { recursive: true });
      await writeFile(options.output, buffer);

      console.log('✓ Screenshot saved to:', options.output);
      console.log('  Size:', (buffer.length / 1024).toFixed(2), 'KB');
    } finally {
      await shutdown();
    }
  });

// Extract text command
browserCommand
  .command('extract')
  .description('Extract text content from a webpage')
  .argument('<url>', 'URL to extract text from')
  .option('-s, --selector <selector>', 'CSS selector to extract text from')
  .option('-o, --output <path>', 'Save text to file')
  .option('--headed', 'Run in headed mode (visible browser)')
  .action(async (url, options) => {
    const { tool, shutdown } = createBrowserTool({
      headless: !options.headed,
    });

    try {
      console.log('Extracting text from:', url);

      // Navigate
      const navResult = await tool.handler({
        action: { kind: 'navigate', url },
      });

      if (!navResult.success) {
        console.error('Failed to navigate:', navResult.error);
        process.exit(1);
      }

      // Wait for content to load
      await tool.handler({
        action: { kind: 'wait', timeMs: 3000 },
      });

      // Extract text
      const extractResult = await tool.handler({
        action: { kind: 'extractText', selector: options.selector },
      });

      if (!extractResult.success || !extractResult.data) {
        console.error('Failed to extract text:', extractResult.error);
        process.exit(1);
      }

      const text = typeof extractResult.data === 'string'
        ? extractResult.data
        : JSON.stringify(extractResult.data);

      if (options.output) {
        const dir = dirname(options.output);
        await mkdir(dir, { recursive: true });
        await writeFile(options.output, text);
        console.log('✓ Text saved to:', options.output);
        console.log('  Characters:', text.length);
      } else {
        console.log('--- Extracted Text ---');
        console.log(text);
      }
    } finally {
      await shutdown();
    }
  });

// Interact command (for automation scripts)
browserCommand
  .command('interact')
  .description('Interact with a webpage (click, type, etc.)')
  .argument('<url>', 'URL to open')
  .option('--click <selector>', 'Click an element')
  .option('--type <selector:text>', 'Type into an element (format: selector:text)')
  .option('--wait <ms>', 'Wait time in ms')
  .option('--screenshot', 'Take screenshot after interaction')
  .option('--headed', 'Run in headed mode')
  .action(async (url, options) => {
    const { tool, shutdown } = createBrowserTool({
      headless: !options.headed,
    });

    try {
      console.log('Opening:', url);

      // Navigate
      const navResult = await tool.handler({
        action: { kind: 'navigate', url },
      });

      if (!navResult.success) {
        console.error('Failed to navigate:', navResult.error);
        process.exit(1);
      }

      // Wait if specified
      if (options.wait) {
        await tool.handler({
          action: { kind: 'wait', timeMs: parseInt(options.wait, 10) },
        });
      }

      // Click
      if (options.click) {
        console.log('Clicking:', options.click);
        const clickResult = await tool.handler({
          action: { kind: 'click', selector: options.click },
        });

        if (!clickResult.success) {
          console.error('Failed to click:', clickResult.error);
        } else {
          console.log('✓ Clicked');
        }
      }

      // Type
      if (options.type) {
        const [selector, text] = options.type.split(':');
        if (!selector || !text) {
          console.error('Invalid --type format. Use: selector:text');
          process.exit(1);
        }

        console.log('Typing into:', selector);
        const typeResult = await tool.handler({
          action: { kind: 'type', selector, text },
        });

        if (!typeResult.success) {
          console.error('Failed to type:', typeResult.error);
        } else {
          console.log('✓ Typed');
        }
      }

      // Screenshot after interaction
      if (options.screenshot) {
        const screenshotPath = `interaction-${Date.now()}.png`;
        const screenshotResult = await tool.handler({
          action: { kind: 'screenshot' },
        });

        if (screenshotResult.success && screenshotResult.screenshot) {
          const buffer = Buffer.from(screenshotResult.screenshot, 'base64');
          await writeFile(screenshotPath, buffer);
          console.log('✓ Screenshot saved to:', screenshotPath);
        }
      }

      console.log('✓ Interactions completed');
    } finally {
      await shutdown();
    }
  });
