/**
 * Embedding generation utilities for AgentForge memory system.
 * Uses OpenAI text-embedding-3-small (1536 dimensions) via direct API calls.
 */

export const EMBEDDING_DIMENSIONS = 1536;

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_TEXT_LENGTH = 8000;
const MAX_BATCH_SIZE = 100;

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

function zeroVector(): number[] {
  return new Array(EMBEDDING_DIMENSIONS).fill(0);
}

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH);
}

async function callOpenAIEmbeddings(
  input: string | string[]
): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[embeddings] OPENAI_API_KEY not set — returning zero vector(s)"
    );
    const count = Array.isArray(input) ? input.length : 1;
    return Array.from({ length: count }, zeroVector);
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(
      `OpenAI embeddings API error ${response.status}: ${errorText}`
    );
  }

  const json = (await response.json()) as OpenAIEmbeddingResponse;

  // Sort by index to ensure order matches input
  const sorted = [...json.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/**
 * Generate an embedding vector for the given text.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 * Falls back to a zero vector on failure so callers can still store the memory.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return zeroVector();
  }

  const truncated = truncateText(text.trim());

  try {
    const results = await callOpenAIEmbeddings(truncated);
    return results[0] ?? zeroVector();
  } catch (err) {
    console.warn("[embeddings] Failed to generate embedding:", err);
    return zeroVector();
  }
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * Batches up to 100 texts per API call.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const truncated = texts.map((t) =>
    t && t.trim().length > 0 ? truncateText(t.trim()) : ""
  );

  // Process in batches of MAX_BATCH_SIZE
  const results: number[][] = [];

  for (let i = 0; i < truncated.length; i += MAX_BATCH_SIZE) {
    const batch = truncated.slice(i, i + MAX_BATCH_SIZE);
    const nonEmpty = batch.filter((t) => t.length > 0);

    if (nonEmpty.length === 0) {
      results.push(...batch.map(zeroVector));
      continue;
    }

    try {
      const batchResults = await callOpenAIEmbeddings(batch);
      results.push(...batchResults);
    } catch (err) {
      console.warn(
        `[embeddings] Failed to generate embeddings for batch starting at ${i}:`,
        err
      );
      results.push(...batch.map(zeroVector));
    }
  }

  return results;
}
