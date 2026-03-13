import { describe, expect, it } from 'vitest';
import {
  deriveGeneralSettings,
  isSettingsLoaded,
  type SettingsRecord,
} from './settings-helpers';

describe('settings-helpers', () => {
  describe('isSettingsLoaded', () => {
    it('returns false when query result is undefined (loading)', () => {
      expect(isSettingsLoaded(undefined)).toBe(false);
    });

    it('returns true when query result is an empty array (loaded, no settings)', () => {
      expect(isSettingsLoaded([])).toBe(true);
    });

    it('returns true when query result has entries', () => {
      const settings: SettingsRecord[] = [
        { key: 'defaultModel', value: 'openai/gpt-4o' },
      ];
      expect(isSettingsLoaded(settings)).toBe(true);
    });
  });

  describe('deriveGeneralSettings', () => {
    it('returns defaults when settings array is empty', () => {
      const result = deriveGeneralSettings([]);
      expect(result).toEqual({
        defaultModel: '',
        defaultTemperature: 0.7,
      });
    });

    it('extracts defaultModel from settings', () => {
      const settings: SettingsRecord[] = [
        { key: 'defaultModel', value: 'anthropic/claude-opus-4-6' },
      ];
      const result = deriveGeneralSettings(settings);
      expect(result.defaultModel).toBe('anthropic/claude-opus-4-6');
    });

    it('extracts defaultTemperature from settings', () => {
      const settings: SettingsRecord[] = [
        { key: 'defaultTemperature', value: 0.3 },
      ];
      const result = deriveGeneralSettings(settings);
      expect(result.defaultTemperature).toBe(0.3);
    });

    it('extracts both settings when present', () => {
      const settings: SettingsRecord[] = [
        { key: 'defaultModel', value: 'openai/gpt-4o' },
        { key: 'defaultTemperature', value: 1.2 },
      ];
      const result = deriveGeneralSettings(settings);
      expect(result).toEqual({
        defaultModel: 'openai/gpt-4o',
        defaultTemperature: 1.2,
      });
    });

    it('ignores non-string defaultModel values', () => {
      const settings: SettingsRecord[] = [
        { key: 'defaultModel', value: 42 },
      ];
      const result = deriveGeneralSettings(settings);
      expect(result.defaultModel).toBe('');
    });

    it('ignores non-number defaultTemperature values', () => {
      const settings: SettingsRecord[] = [
        { key: 'defaultTemperature', value: 'high' },
      ];
      const result = deriveGeneralSettings(settings);
      expect(result.defaultTemperature).toBe(0.7);
    });

    it('ignores unknown keys', () => {
      const settings: SettingsRecord[] = [
        { key: 'unknownSetting', value: 'something' },
      ];
      const result = deriveGeneralSettings(settings);
      expect(result).toEqual({
        defaultModel: '',
        defaultTemperature: 0.7,
      });
    });
  });
});
