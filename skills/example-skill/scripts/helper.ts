#!/usr/bin/env npx tsx
/**
 * Example Helper Script
 *
 * This is an example executable script for the example-skill.
 * Scripts in the scripts/ directory can be executed by agents
 * that have this skill enabled.
 *
 * Usage: npx tsx scripts/helper.ts [args]
 */

import { argv } from 'node:process';

function main() {
  console.log('Hello from example-skill!');
  console.log('Arguments received:', argv.slice(2));

  // Add your helper logic here
  // This could include:
  // - Data processing
  // - API calls
  // - File operations
  // - Utility functions

  return {
    success: true,
    message: 'Helper script executed successfully',
  };
}

// Only run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = main();
  console.log(JSON.stringify(result, null, 2));
}

export { main };
