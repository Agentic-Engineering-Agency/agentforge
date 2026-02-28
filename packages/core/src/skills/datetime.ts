/**
 * DateTime Skill
 *
 * Provides current date/time, timezone conversions, and date formatting.
 */

import type { BundledSkill } from './types.js';

export const DateTimeSkill: BundledSkill = {
  name: 'datetime',
  description: 'Get current date/time, format dates, and convert timezones',
  category: 'datetime',
  schema: {
    input: {
      action: {
        type: 'string',
        description: 'Action: "now", "format", "convert"',
        required: false,
      },
      timezone: { type: 'string', description: 'Timezone (e.g., "America/New_York")', required: false },
      format: { type: 'string', description: 'Date format (iso, readable, timestamp)', required: false },
      date: { type: 'string', description: 'Date string for formatting/conversion', required: false },
    },
    output: 'Date/time information or formatted date',
  },
  execute: async (args) => {
    const action = (args.action as string) ?? 'now';
    const timezone = (args.timezone as string) ?? 'UTC';
    const format = (args.format as string) ?? 'iso';
    const dateStr = args.date as string | undefined;

    try {
      const now = new Date();

      switch (action) {
        case 'now': {
          let formatted: string;
          switch (format) {
            case 'iso':
              formatted = now.toISOString();
              break;
            case 'readable':
              formatted = now.toLocaleString('en-US', { timeZone: timezone });
              break;
            case 'timestamp':
              formatted = String(Math.floor(now.getTime() / 1000));
              break;
            default:
              formatted = now.toISOString();
          }
          return JSON.stringify({
            action: 'now',
            timezone,
            format,
            result: formatted,
            iso: now.toISOString(),
            timestamp: Math.floor(now.getTime() / 1000),
          });
        }

        case 'format': {
          if (!dateStr) {
            return JSON.stringify({ error: 'Date string required for format action' });
          }
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            return JSON.stringify({ error: 'Invalid date string' });
          }
          return JSON.stringify({
            action: 'format',
            input: dateStr,
            result: {
              iso: date.toISOString(),
              readable: date.toLocaleString('en-US', { timeZone: timezone }),
              timestamp: Math.floor(date.getTime() / 1000),
            },
          });
        }

        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
