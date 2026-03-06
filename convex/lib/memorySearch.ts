/**
 * Hybrid memory search engine for AgentForge.
 * Combines vector similarity search (via Convex vectorSearch) and BM25 text search
 * using Reciprocal Rank Fusion (RRF) to merge result lists.
 *
 * All exported functions must be called from a Convex action context.
 */

import { GenericActionCtx } from "convex/server";
import { api } from "../_generated/api";
import { generateEmbedding } from "./embeddings";

// BM25 tuning parameters
const BM25_K1 = 1.2;
const BM25_B = 0.75;

// RRF parameter
const RRF_K = 60;

// Maximum candidate memories for text search
const TEXT_SEARCH_CANDIDATE_LIMIT = 500;

// Use GenericActionCtx with any DataModel since the generated dataModel is a stub
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionCtx = GenericActionCtx<any>;

type MemoryType = "conversation" | "fact" | "summary" | "episodic";

export interface MemoryResult {
  _id: string;
  _score: number;
  content: string;
  type: string;
  importance: number;
  createdAt: number;
}

export interface HybridMemoryResult extends MemoryResult {
  searchMethod: "vector" | "text" | "both";
}

// Stopwords to exclude from BM25 tokenization
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "it",
  "its",
  "was",
  "are",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "that",
  "this",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "our",
  "their",
  "not",
  "no",
  "as",
  "if",
  "so",
  "up",
  "out",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function computeBM25Score(
  queryTerms: string[],
  docTokens: string[],
  docLength: number,
  avgDocLength: number,
  idfMap: Map<string, number>
): number {
  if (queryTerms.length === 0 || docTokens.length === 0) return 0;

  const termFrequency = new Map<string, number>();
  for (const token of docTokens) {
    termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const term of queryTerms) {
    const tf = termFrequency.get(term) ?? 0;
    if (tf === 0) continue;

    const idf = idfMap.get(term) ?? 0;
    const numerator = tf * (BM25_K1 + 1);
    const denominator =
      tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
    score += idf * (numerator / denominator);
  }

  return score;
}

/**
 * Perform vector similarity search on memory entries.
 * Must be called from a Convex action context.
 */
export async function vectorSearch(
  ctx: ActionCtx,
  params: {
    query: string;
    agentId: string;
    projectId?: string;
    type?: MemoryType;
    limit?: number;
  }
): Promise<MemoryResult[]> {
  const { query, agentId, projectId, type, limit = 10 } = params;

  if (!query || query.trim().length === 0) return [];

  const embedding = await generateEmbedding(query);

  // Detect zero vector (embedding failed) — skip vector search
  const isZeroVector = embedding.every((v) => v === 0);
  if (isZeroVector) {
    console.warn(
      "[memorySearch] vectorSearch: embedding generation failed, returning empty"
    );
    return [];
  }

  // Convex vectorSearch filter via closure — build filter dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filter: ((q: any) => any) | undefined;

  if (type && projectId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter = (q: any) =>
      q.and(
        q.eq("agentId", agentId),
        q.eq("projectId", projectId),
        q.eq("type", type)
      );
  } else if (type) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter = (q: any) => q.and(q.eq("agentId", agentId), q.eq("type", type));
  } else if (projectId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter = (q: any) =>
      q.and(q.eq("agentId", agentId), q.eq("projectId", projectId));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter = (q: any) => q.eq("agentId", agentId);
  }

  const vectorResults = await ctx.vectorSearch(
    "memoryEntries",
    "byEmbedding",
    {
      vector: embedding,
      limit: Math.min(limit * 2, 256), // fetch extra to allow post-filtering
      filter,
    }
  );

  if (vectorResults.length === 0) return [];

  // Fetch full documents
  const docs = await Promise.all(
    vectorResults.map(async (result: { _id: string; _score: number }) => {
      try {
        // TODO: Replace with direct memoryEntries query when memory.ts is implemented
        // For now, return null to skip this result
        return null;
      } catch {
        return null;
      }
    })
  );

  const validDocs = (docs as Array<{ doc: any; score: number } | null>).filter(
    (d): d is { doc: any; score: number } => d !== null && d.doc !== null
  );

  return validDocs.slice(0, limit).map(({ doc, score }) => ({
    _id: doc._id as string,
    _score: score,
    content: doc.content as string,
    type: doc.type as string,
    importance: doc.importance as number,
    createdAt: doc.createdAt as number,
  }));
}

/**
 * BM25-style text search using keyword matching with TF-IDF scoring.
 * Fetches candidate memories and scores them in-memory.
 */
export async function textSearch(
  ctx: ActionCtx,
  params: {
    query: string;
    agentId: string;
    projectId?: string;
    limit?: number;
  }
): Promise<MemoryResult[]> {
  const { query, agentId, projectId, limit = 10 } = params;

  if (!query || query.trim().length === 0) return [];

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  // Fetch recent candidate memories
  // TODO: Replace with direct memoryEntries query when memory.ts is implemented
  // For now, return empty array
  const candidates: any[] = [];

  if (!candidates || candidates.length === 0) return [];

  const candidateList = candidates as any[];

  // Tokenize all documents
  const tokenizedDocs = candidateList.map((doc: any) => ({
    doc,
    tokens: tokenize(doc.content ?? ""),
  }));

  const totalDocs = tokenizedDocs.length;
  const totalLength = tokenizedDocs.reduce(
    (sum: number, d: { tokens: string[] }) => sum + d.tokens.length,
    0
  );
  const avgDocLength = totalDocs > 0 ? totalLength / totalDocs : 1;

  // Compute IDF for each query term
  const idfMap = new Map<string, number>();
  for (const term of queryTerms) {
    const df = tokenizedDocs.filter(({ tokens }: { tokens: string[] }) =>
      tokens.includes(term)
    ).length;
    idfMap.set(term, Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1));
  }

  // Score each document
  const scored = tokenizedDocs.map(
    ({ doc, tokens }: { doc: any; tokens: string[] }) => ({
      doc,
      score: computeBM25Score(
        queryTerms,
        tokens,
        tokens.length,
        avgDocLength,
        idfMap
      ),
    })
  );

  // Filter out zero scores and sort descending
  const nonZero = scored.filter(({ score }: { score: number }) => score > 0);
  nonZero.sort(
    (a: { score: number }, b: { score: number }) => b.score - a.score
  );

  return nonZero
    .slice(0, limit)
    .map(({ doc, score }: { doc: any; score: number }) => ({
      _id: doc._id as string,
      _score: score,
      content: doc.content as string,
      type: doc.type as string,
      importance: doc.importance as number,
      createdAt: doc.createdAt as number,
    }));
}

/**
 * Hybrid search combining vector similarity and BM25 text search.
 * Uses Reciprocal Rank Fusion (RRF) to merge result lists.
 */
export async function hybridSearch(
  ctx: ActionCtx,
  params: {
    query: string;
    agentId: string;
    projectId?: string;
    type?: MemoryType;
    limit?: number;
    vectorWeight?: number;
    textWeight?: number;
  }
): Promise<HybridMemoryResult[]> {
  const {
    query,
    agentId,
    projectId,
    type,
    limit = 10,
    vectorWeight = 0.7,
    textWeight = 0.3,
  } = params;

  if (!query || query.trim().length === 0) return [];

  // Run both searches in parallel
  const [vectorResults, textResults] = await Promise.all([
    vectorSearch(ctx, {
      query,
      agentId,
      projectId,
      type,
      limit: limit * 2,
    }).catch((err) => {
      console.warn("[memorySearch] hybridSearch: vectorSearch failed:", err);
      return [] as MemoryResult[];
    }),
    textSearch(ctx, {
      query,
      agentId,
      projectId,
      limit: limit * 2,
    }).catch((err) => {
      console.warn("[memorySearch] hybridSearch: textSearch failed:", err);
      return [] as MemoryResult[];
    }),
  ]);

  // Collect all unique IDs and their doc info
  interface DocEntry {
    content: string;
    type: string;
    importance: number;
    createdAt: number;
    rrfScore: number;
    inVector: boolean;
    inText: boolean;
  }
  const docMap = new Map<string, DocEntry>();

  // Apply RRF scores for vector results
  vectorResults.forEach((result, rank) => {
    const id = result._id;
    const rrfContribution = vectorWeight * (1 / (RRF_K + rank + 1));
    const existing = docMap.get(id);
    if (existing) {
      existing.rrfScore += rrfContribution;
      existing.inVector = true;
    } else {
      docMap.set(id, {
        content: result.content,
        type: result.type,
        importance: result.importance,
        createdAt: result.createdAt,
        rrfScore: rrfContribution,
        inVector: true,
        inText: false,
      });
    }
  });

  // Apply RRF scores for text results
  textResults.forEach((result, rank) => {
    const id = result._id;
    const rrfContribution = textWeight * (1 / (RRF_K + rank + 1));
    const existing = docMap.get(id);
    if (existing) {
      existing.rrfScore += rrfContribution;
      existing.inText = true;
    } else {
      docMap.set(id, {
        content: result.content,
        type: result.type,
        importance: result.importance,
        createdAt: result.createdAt,
        rrfScore: rrfContribution,
        inVector: false,
        inText: true,
      });
    }
  });

  if (docMap.size === 0) return [];

  // Apply importance boost and determine searchMethod
  const merged: HybridMemoryResult[] = [];

  for (const [id, entry] of docMap) {
    // Clamp importance to [0, 1] before boost
    const importance = Math.max(0, Math.min(1, entry.importance));
    const finalScore = entry.rrfScore * (0.5 + 0.5 * importance);

    const searchMethod: "vector" | "text" | "both" =
      entry.inVector && entry.inText
        ? "both"
        : entry.inVector
          ? "vector"
          : "text";

    merged.push({
      _id: id,
      _score: finalScore,
      content: entry.content,
      type: entry.type,
      importance: entry.importance,
      createdAt: entry.createdAt,
      searchMethod,
    });
  }

  // Sort by fused score descending
  merged.sort((a, b) => b._score - a._score);

  return merged.slice(0, limit);
}
