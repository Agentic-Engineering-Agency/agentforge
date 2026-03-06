/**
 * Input sanitization for security.
 *
 * Removes dangerous characters (null bytes, control characters)
 * and enforces maximum length limits to prevent overflow attacks.
 */

/**
 * Default maximum input length.
 * Matches Discord (2000), Telegram (4096), HTTP (16000).
 */
export const DEFAULT_MAX_LENGTH = 16000;

/**
 * Allowed control characters (whitespace).
 */
const ALLOWED_CONTROL_CHARS = new Set([
  "\t", // Tab
  "\n", // Newline
  "\r", // Carriage return
]);

/**
 * Sanitization options.
 */
export interface SanitizeOptions {
  maxLength?: number;
}

/**
 * Input validation error.
 */
export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

/**
 * Sanitize user input for security.
 *
 * Removes:
 * - Null bytes (can cause string truncation issues)
 * - Non-printable control characters (except \t, \n, \r)
 *
 * Validates:
 * - Maximum length (default 16000, configurable)
 *
 * Length is checked AFTER sanitization, so malicious input
 * filled with null bytes will be rejected if the actual content is too long.
 *
 * @param input - User input to sanitize
 * @param options - Sanitization options
 * @returns Sanitized input
 * @throws InputValidationError if input is too long
 */
export function sanitizeInput(
  input: string,
  options: SanitizeOptions = {}
): string {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;

  // Remove null bytes
  let sanitized = input.replace(/\x00/g, "");

  // Remove non-printable control characters (except allowed whitespace)
  sanitized = sanitized.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Check length after sanitization
  if (sanitized.length > maxLength) {
    throw new InputValidationError(
      `Input too long: ${sanitized.length} characters (max ${maxLength})`
    );
  }

  return sanitized;
}

/**
 * Sanitize input for Discord (max 2000 chars).
 */
export function sanitizeDiscordInput(input: string): string {
  return sanitizeInput(input, { maxLength: 2000 });
}

/**
 * Sanitize input for Telegram (max 4096 chars).
 */
export function sanitizeTelegramInput(input: string): string {
  return sanitizeInput(input, { maxLength: 4096 });
}

/**
 * Sanitize input for HTTP channel (max 16000 chars).
 */
export function sanitizeHttpInput(input: string): string {
  return sanitizeInput(input, { maxLength: 16000 });
}
