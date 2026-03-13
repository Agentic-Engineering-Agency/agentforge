/**
 * Model override utilities for chat-scoped model selection (Issue #217).
 *
 * Validates and parses model strings in Mastra model router format:
 *   provider/model-id  (e.g., "openai/gpt-5.1", "anthropic/claude-opus-4-6")
 */

export interface ParsedModel {
  provider: string;
  modelId: string;
}

export interface ModelOverrideResult {
  valid: boolean;
  provider?: string;
  modelId?: string;
  /** Full model string in provider/model-id format */
  fullModelId?: string;
  error?: string;
}

/**
 * Parse a model string in "provider/model-id" format.
 * Returns null if the string is not in the expected format.
 */
export function parseModelString(model: string): ParsedModel | null {
  const trimmed = model.trim();
  if (!trimmed) return null;

  const slashIndex = trimmed.indexOf('/');
  if (slashIndex <= 0) return null;

  const provider = trimmed.slice(0, slashIndex);
  const modelId = trimmed.slice(slashIndex + 1);

  if (!modelId) return null;

  return { provider, modelId };
}

/**
 * Validate a model override string.
 *
 * @param model - The model string to validate (e.g., "openai/gpt-5.1")
 * @param knownProviders - List of known provider IDs. If empty, any provider is accepted.
 * @returns Validation result with parsed provider/modelId or error message
 */
export function validateModelOverride(model: string, knownProviders: string[]): ModelOverrideResult {
  const parsed = parseModelString(model);

  if (!parsed) {
    return {
      valid: false,
      error: `Invalid model format: "${model}". Expected "provider/model-id" (e.g., "openai/gpt-5.1").`,
    };
  }

  // If knownProviders is non-empty, enforce the allowlist
  if (knownProviders.length > 0 && !knownProviders.includes(parsed.provider)) {
    return {
      valid: false,
      error: `Unknown provider "${parsed.provider}". Supported providers: ${knownProviders.join(', ')}.`,
    };
  }

  return {
    valid: true,
    provider: parsed.provider,
    modelId: parsed.modelId,
    fullModelId: `${parsed.provider}/${parsed.modelId}`,
  };
}
