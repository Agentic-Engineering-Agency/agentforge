/**
 * Tests for WhatsApp Channel Runner.
 *
 * Tests the WhatsAppChannel class that bridges the WhatsAppAdapter
 * with the Convex chat pipeline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WhatsAppChannel, startWhatsAppChannel } from './whatsapp.js';
import type { WhatsAppChannelConfig } from './whatsapp.js';

// =====================================================
// Test Helpers
// =====================================================

function createTestConfig(overrides: Partial<WhatsAppChannelConfig> = {}): WhatsAppChannelConfig {
  return {
    accessToken: 'test-access-token-123',
    phoneNumberId: '123456789',
    verifyToken: 'test-verify-token',
    agentId: 'test-agent-1',
    convexUrl: 'https://test-deployment.convex.cloud',
    logLevel: 'error', // Suppress logs in tests
    webhookPort: 0, // Disable webhook server in tests
    ...overrides,
  };
}

// =====================================================
// Tests
// =====================================================

describe('WhatsAppChannel', () => {
  describe('constructor', () => {
    it('should create a WhatsAppChannel instance', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      expect(channel).toBeInstanceOf(WhatsAppChannel);
      expect(channel.running).toBe(false);
    });

    it('should initialize with empty thread map', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      expect(channel.getThreadMap().size).toBe(0);
    });

    it('should expose the underlying adapter', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      expect(channel.getAdapter()).toBeDefined();
      expect(channel.getAdapter().platform).toBe('whatsapp');
    });
  });

  describe('stop', () => {
    it('should be safe to call stop when not running', async () => {
      const channel = new WhatsAppChannel(createTestConfig());
      await expect(channel.stop()).resolves.not.toThrow();
    });
  });

  describe('message splitting', () => {
    it('should not split short messages', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const result = splitMessage('Hello, world!', 4096);
      expect(result).toEqual(['Hello, world!']);
    });

    it('should split messages exceeding max length', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const longText = 'A'.repeat(5000);
      const result = splitMessage(longText, 4096);
      expect(result.length).toBeGreaterThan(1);
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(4096);
      }
    });

    it('should prefer splitting at paragraph breaks', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'A'.repeat(2000) + '\n\n' + 'B'.repeat(2500);
      const result = splitMessage(text, 4096);
      expect(result.length).toBe(2);
      expect(result[0]).toContain('A');
      expect(result[1]).toContain('B');
    });

    it('should prefer splitting at line breaks', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'A'.repeat(2500) + '\n' + 'B'.repeat(2500);
      const result = splitMessage(text, 4096);
      expect(result.length).toBe(2);
    });

    it('should prefer splitting at spaces', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'A'.repeat(2500) + ' ' + 'B'.repeat(2500);
      const result = splitMessage(text, 4096);
      expect(result.length).toBe(2);
    });

    it('should hard split when no good break point exists', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'A'.repeat(8192);
      const result = splitMessage(text, 4096);
      expect(result.length).toBe(2);
      expect(result[0].length).toBe(4096);
    });
  });
});

describe('startWhatsAppChannel', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw if WHATSAPP_ACCESS_TOKEN is not set', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    await expect(startWhatsAppChannel()).rejects.toThrow('WHATSAPP_ACCESS_TOKEN is required');
  });

  it('should throw if WHATSAPP_PHONE_NUMBER_ID is not set', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    await expect(startWhatsAppChannel()).rejects.toThrow('WHATSAPP_PHONE_NUMBER_ID is required');
  });

  it('should throw if WHATSAPP_VERIFY_TOKEN is not set', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    await expect(startWhatsAppChannel()).rejects.toThrow('WHATSAPP_VERIFY_TOKEN is required');
  });

  it('should throw if CONVEX_URL is not set', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-token';
    delete process.env.CONVEX_URL;
    await expect(startWhatsAppChannel()).rejects.toThrow('CONVEX_URL is required');
  });

  it('should throw if agent ID is not set', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-token';
    process.env.CONVEX_URL = 'https://test.convex.cloud';
    delete process.env.AGENTFORGE_AGENT_ID;
    await expect(startWhatsAppChannel()).rejects.toThrow('Agent ID is required');
  });

  it('should accept overrides for all env vars and create a channel', async () => {
    // This test verifies the function doesn't throw for missing env vars
    // when overrides are provided. With webhookPort 0, the adapter may
    // start successfully even with fake credentials.
    let channel: any;
    try {
      channel = await startWhatsAppChannel({
        accessToken: 'test',
        phoneNumberId: '123',
        verifyToken: 'verify',
        convexUrl: 'https://test.convex.cloud',
        agentId: 'agent-1',
        webhookPort: 0,
      });
      // If it starts, that's fine — config was accepted
      expect(channel).toBeDefined();
    } catch (err: any) {
      // If it throws, it should NOT be about missing config
      expect(err.message).not.toContain('is required');
    } finally {
      if (channel?.stop) await channel.stop();
    }
  });
});
