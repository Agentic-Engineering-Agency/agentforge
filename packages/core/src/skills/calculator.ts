/**
 * Calculator Skill
 *
 * Safely evaluates mathematical expressions using a recursive descent parser.
 * Supports basic arithmetic: +, -, *, /, %, ( )
 */

import type { BundledSkill } from './types.js';

/**
 * Safe recursive descent parser for mathematical expressions.
 * Uses no eval, Function, or dynamic code execution.
 */
function safeEvaluate(expr: string): number {
  // Allow only digits, operators, parentheses, dots, and whitespace
  if (!/^[0-9+\-*/().%\s]+$/.test(expr)) {
    throw new Error('Expression contains invalid characters');
  }

  let pos = 0;
  const peek = () => expr[pos] ?? '';
  const consume = () => expr[pos++];
  const skipWs = () => { while (peek() === ' ') consume(); };

  function parseNumber(): number {
    skipWs();
    let num = '';
    if (peek() === '(') { consume(); const v = parseExpr(); skipWs(); consume(); return v; }
    while (/[0-9.]/.test(peek())) num += consume();
    if (num === '') throw new Error('Expected number');
    return parseFloat(num);
  }

  function parseFactor(): number {
    skipWs();
    if (peek() === '-') { consume(); return -parseFactor(); }
    return parseNumber();
  }

  function parseTerm(): number {
    let left = parseFactor();
    skipWs();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      skipWs();
      const right = parseFactor();
      if (op === '*') left = left * right;
      else if (op === '/') left = left / right;
      else left = left % right;
      skipWs();
    }
    return left;
  }

  function parseExpr(): number {
    let left = parseTerm();
    skipWs();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      skipWs();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
      skipWs();
    }
    return left;
  }

  const result = parseExpr();
  if (pos !== expr.length) throw new Error('Unexpected token at position ' + pos);
  return result;
}

export const CalculatorSkill: BundledSkill = {
  name: 'calculator',
  description: 'Evaluate mathematical expressions safely. Supports: +, -, *, /, %, parentheses',
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

    // Trim whitespace
    const expr = expression.trim();

    if (expr === '') {
      return JSON.stringify({ error: 'Expression cannot be empty' });
    }

    try {
      const result = safeEvaluate(expr);

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
