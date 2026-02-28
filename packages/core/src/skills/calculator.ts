/**
 * Calculator Skill
 *
 * Safely evaluates mathematical expressions.
 * Supports basic arithmetic: +, -, *, /, %, **, ( )
 */

import type { BundledSkill } from './types.js';

export const CalculatorSkill: BundledSkill = {
  name: 'calculator',
  description: 'Evaluate mathematical expressions safely. Supports: +, -, *, /, %, **, parentheses',
  category: 'computation',
  schema: {
    input: {
      expression: { type: 'string', description: 'Mathematical expression to evaluate', required: true },
    },
    output: 'Result of the evaluation or error message',
  },
  execute: async (args) => {
    const expression = args.expression as string;

    if (!expression || typeof expression !== 'string') {
      return JSON.stringify({ error: 'Expression is required and must be a string' });
    }

    // Sanitize: only allow safe characters
    const sanitized = expression.replace(/[^0-9+\-*/%.() \n]/g, '');

    if (sanitized !== expression) {
      return JSON.stringify({ error: 'Expression contains invalid characters' });
    }

    try {
      // Use Function constructor for safer evaluation than eval()
      // Still not 100% safe but better than direct eval
      const result = Function('"use strict"; return (' + sanitized + ')')();

      if (typeof result !== 'number' || !Number.isFinite(result)) {
        return JSON.stringify({ error: 'Invalid result', result: String(result) });
      }

      return JSON.stringify({
        expression,
        result: Number.isInteger(result) ? result : parseFloat(result.toFixed(10)),
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        expression,
      });
    }
  },
};
