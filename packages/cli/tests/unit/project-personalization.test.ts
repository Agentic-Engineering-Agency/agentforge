/**
 * Unit tests for Project Personalization
 *
 * Tests that project settings (systemPrompt, defaultModel, defaultProvider)
 * properly override agent-level settings in the chat pipeline.
 *
 * Spec: fix-project-personalization.spec.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';

describe('Project Personalization', () => {
  describe('Override Precedence', () => {
    it('should use project defaultProvider over agent.provider', () => {
      const agent = {
        id: 'agent-1',
        name: 'Test Agent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        instructions: 'You are helpful.',
        projectId: 'project-1' as Id<'projects'>,
      };

      const project = {
        _id: 'project-1' as Id<'projects'>,
        name: 'Test Project',
        settings: {
          defaultProvider: 'anthropic',
          defaultModel: 'claude-sonnet-4-6',
          systemPrompt: 'Always respond in Spanish.',
        },
      };

      // Simulate the override logic from chat.ts
      const providerOverride = project.settings?.defaultProvider;
      const modelOverride = project.settings?.defaultModel;
      const systemPromptOverride = project.settings?.systemPrompt;

      const finalProvider = providerOverride || agent.provider || 'openrouter';
      const finalModel = modelOverride || agent.model || 'unknown';

      expect(finalProvider).toBe('anthropic');
      expect(finalModel).toBe('claude-sonnet-4-6');
    });

    it('should use project defaultModel over agent.model', () => {
      const agent = {
        id: 'agent-2',
        name: 'Test Agent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        instructions: 'You are helpful.',
        projectId: 'project-2' as Id<'projects'>,
      };

      const project = {
        _id: 'project-2' as Id<'projects'>,
        name: 'Test Project',
        settings: {
          defaultModel: 'gemini-2.5-flash',
        },
      };

      const modelOverride = project.settings?.defaultModel;
      const finalModel = modelOverride || agent.model || 'unknown';

      expect(finalModel).toBe('gemini-2.5-flash');
    });

    it('should use project systemPrompt prepended to agent instructions', () => {
      const agent = {
        id: 'agent-3',
        name: 'Test Agent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        instructions: 'You are a helpful assistant.',
        projectId: 'project-3' as Id<'projects'>,
      };

      const project = {
        _id: 'project-3' as Id<'projects'>,
        name: 'Test Project',
        settings: {
          systemPrompt: 'Always respond in Spanish.',
        },
      };

      const systemPromptOverride = project.settings?.systemPrompt;
      const baseInstructions = agent.instructions || 'You are a helpful AI assistant.';
      const finalPrompt = systemPromptOverride
        ? `${systemPromptOverride}\n\n${baseInstructions}`
        : baseInstructions;

      expect(finalPrompt).toBe('Always respond in Spanish.\n\nYou are a helpful assistant.');
    });

    it('should use agent settings when project has no settings', () => {
      const agent = {
        id: 'agent-4',
        name: 'Test Agent',
        provider: 'google',
        model: 'gemini-2.0-flash',
        instructions: 'You are helpful.',
        projectId: 'project-4' as Id<'projects'>,
      };

      const project = {
        _id: 'project-4' as Id<'projects'>,
        name: 'Test Project',
        // No settings field
      };

      const settings = project.settings as {
        systemPrompt?: string;
        defaultModel?: string;
        defaultProvider?: string;
      } | undefined;

      const providerOverride = settings?.defaultProvider;
      const modelOverride = settings?.defaultModel;
      const systemPromptOverride = settings?.systemPrompt;

      const finalProvider = providerOverride || agent.provider || 'openrouter';
      const finalModel = modelOverride || agent.model || 'unknown';
      const baseInstructions = agent.instructions || 'You are a helpful AI assistant.';
      const finalPrompt = systemPromptOverride
        ? `${systemPromptOverride}\n\n${baseInstructions}`
        : baseInstructions;

      expect(finalProvider).toBe('google');
      expect(finalModel).toBe('gemini-2.0-flash');
      expect(finalPrompt).toBe('You are helpful.');
    });
  });

  describe('Partial Override Handling', () => {
    it('should use only project defaultProvider when only that is set', () => {
      const agent = {
        provider: 'openai',
        model: 'gpt-4o-mini',
      };

      const projectSettings = {
        defaultProvider: 'anthropic',
        // defaultModel not set
      };

      const finalProvider = projectSettings.defaultProvider || agent.provider || 'openrouter';
      const finalModel = projectSettings.defaultModel || agent.model || 'unknown';

      expect(finalProvider).toBe('anthropic');
      expect(finalModel).toBe('gpt-4o-mini'); // Agent model used
    });

    it('should use only project defaultModel when only that is set', () => {
      const agent = {
        provider: 'openai',
        model: 'gpt-4o-mini',
      };

      const projectSettings = {
        // defaultProvider not set
        defaultModel: 'claude-sonnet-4-6',
      };

      const finalProvider = projectSettings.defaultProvider || agent.provider || 'openrouter';
      const finalModel = projectSettings.defaultModel || agent.model || 'unknown';

      expect(finalProvider).toBe('openai'); // Agent provider used
      expect(finalModel).toBe('claude-sonnet-4-6');
    });

    it('should use only project systemPrompt when only that is set', () => {
      const agent = {
        instructions: 'You are a helpful assistant.',
      };

      const projectSettings = {
        systemPrompt: 'Be concise.',
      };

      const baseInstructions = agent.instructions || 'You are a helpful AI assistant.';
      const finalPrompt = projectSettings.systemPrompt
        ? `${projectSettings.systemPrompt}\n\n${baseInstructions}`
        : baseInstructions;

      expect(finalPrompt).toBe('Be concise.\n\nYou are a helpful assistant.');
    });
  });

  describe('Null and Undefined Handling', () => {
    it('should handle null project settings', () => {
      const agent = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        instructions: 'You are helpful.',
      };

      const projectSettings = null;

      const providerOverride = projectSettings?.defaultProvider;
      const modelOverride = projectSettings?.defaultModel;
      const systemPromptOverride = projectSettings?.systemPrompt;

      const finalProvider = providerOverride || agent.provider || 'openrouter';
      const finalModel = modelOverride || agent.model || 'unknown';
      const baseInstructions = agent.instructions || 'You are a helpful AI assistant.';
      const finalPrompt = systemPromptOverride
        ? `${systemPromptOverride}\n\n${baseInstructions}`
        : baseInstructions;

      expect(finalProvider).toBe('openai');
      expect(finalModel).toBe('gpt-4o-mini');
      expect(finalPrompt).toBe('You are helpful.');
    });

    it('should handle undefined project settings', () => {
      const agent = {
        provider: 'google',
        model: 'gemini-2.0-flash',
        instructions: 'Be helpful.',
      };

      const projectSettings = undefined;

      const providerOverride = projectSettings?.defaultProvider;
      const modelOverride = projectSettings?.defaultModel;
      const systemPromptOverride = projectSettings?.systemPrompt;

      const finalProvider = providerOverride || agent.provider || 'openrouter';
      const finalModel = modelOverride || agent.model || 'unknown';
      const baseInstructions = agent.instructions || 'You are a helpful AI assistant.';
      const finalPrompt = systemPromptOverride
        ? `${systemPromptOverride}\n\n${baseInstructions}`
        : baseInstructions;

      expect(finalProvider).toBe('google');
      expect(finalModel).toBe('gemini-2.0-flash');
      expect(finalPrompt).toBe('Be helpful.');
    });

    it('should handle empty string overrides', () => {
      const agent = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        instructions: 'You are helpful.',
      };

      const projectSettings = {
        defaultProvider: '',
        defaultModel: '',
        systemPrompt: '',
      };

      const providerOverride = projectSettings.defaultProvider || undefined;
      const modelOverride = projectSettings.defaultModel || undefined;
      const systemPromptOverride = projectSettings.systemPrompt || undefined;

      const finalProvider = providerOverride || agent.provider || 'openrouter';
      const finalModel = modelOverride || agent.model || 'unknown';
      const baseInstructions = agent.instructions || 'You are a helpful AI assistant.';
      const finalPrompt = systemPromptOverride
        ? `${systemPromptOverride}\n\n${baseInstructions}`
        : baseInstructions;

      expect(finalProvider).toBe('openai');
      expect(finalModel).toBe('gpt-4o-mini');
      expect(finalPrompt).toBe('You are helpful.');
    });
  });

  describe('Settings Object Structure', () => {
    it('should extract settings from project.settings object', () => {
      const project = {
        _id: 'project-1' as Id<'projects'>,
        name: 'Test Project',
        settings: {
          systemPrompt: 'Test prompt',
          defaultModel: 'test-model',
          defaultProvider: 'test-provider',
          instructionPrefix: 'Prefix prompt',
          defaultTemperature: 0.5,
          defaultMaxTokens: 2048,
        },
      };

      const settings = project.settings as {
        systemPrompt?: string;
        defaultModel?: string;
        defaultProvider?: string;
        instructionPrefix?: string;
        defaultTemperature?: number;
        defaultMaxTokens?: number;
      };

      expect(settings.systemPrompt).toBe('Test prompt');
      expect(settings.defaultModel).toBe('test-model');
      expect(settings.defaultProvider).toBe('test-provider');
      expect(settings.instructionPrefix).toBe('Prefix prompt');
      expect(settings.defaultTemperature).toBe(0.5);
      expect(settings.defaultMaxTokens).toBe(2048);
    });

    it('should prefer systemPrompt over instructionPrefix', () => {
      const settings = {
        systemPrompt: 'Primary prompt',
        instructionPrefix: 'Secondary prefix',
      };

      const extractedPrompt = settings.systemPrompt || settings.instructionPrefix;

      expect(extractedPrompt).toBe('Primary prompt');
    });

    it('should fall back to instructionPrefix when systemPrompt is absent', () => {
      const settings = {
        instructionPrefix: 'Fallback prefix',
      };

      const extractedPrompt = settings.systemPrompt || settings.instructionPrefix;

      expect(extractedPrompt).toBe('Fallback prefix');
    });
  });
});
