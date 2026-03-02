/**
 * Auth commands for dashboard password management.
 */

import { Command } from 'commander';
import { getContext } from '../lib/cli-context.js';
import { ConvexClient } from 'convex/browser';
import type { FunctionReference } from 'convex/server';

// Helper to create a FunctionReference from a string identifier
// This is needed because ConvexClient.mutation/query require FunctionReference types
function mutationRef(name: string): FunctionReference<'mutation'> {
  return name as any;
}

function queryRef(name: string): FunctionReference<'query'> {
  return name as any;
}

export const authCommand = new Command('auth');

authCommand.description('Manage dashboard authentication');
