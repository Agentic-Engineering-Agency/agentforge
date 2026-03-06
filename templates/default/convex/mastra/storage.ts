/**
 * Mastra storage handler for Convex.
 *
 * This file is required for @mastra/convex to work correctly with Convex
 * as the memory backend. It exports the mastraStorage handler which
 * manages the Mastra memory tables (threads, messages, resources, etc.).
 */

import { mastraStorage } from "@mastra/convex/server";

export const handle = mastraStorage;
