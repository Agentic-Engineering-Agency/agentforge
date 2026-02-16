/**
 * CLI Display Helpers — Consistent formatting for all commands
 */

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

export function success(msg: string) {
  console.log(`${colors.green}✔${colors.reset} ${msg}`);
}

export function error(msg: string) {
  console.error(`${colors.red}✖${colors.reset} ${msg}`);
}

export function warn(msg: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

export function info(msg: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

export function header(title: string) {
  console.log(`\n${colors.bold}${colors.cyan}${title}${colors.reset}\n`);
}

export function dim(msg: string) {
  console.log(`${colors.dim}${msg}${colors.reset}`);
}

/**
 * Print a table from an array of objects
 */
export function table(data: Record<string, any>[], columns?: string[]) {
  if (data.length === 0) {
    dim('  (no items)');
    return;
  }

  const cols = columns ?? Object.keys(data[0]);
  const widths: Record<string, number> = {};

  for (const col of cols) {
    widths[col] = Math.max(
      col.length,
      ...data.map((row) => String(row[col] ?? '').length)
    );
  }

  // Header
  const headerRow = cols.map((c) => c.toUpperCase().padEnd(widths[c])).join('  ');
  console.log(`  ${colors.bold}${headerRow}${colors.reset}`);
  console.log(`  ${cols.map((c) => '─'.repeat(widths[c])).join('──')}`);

  // Rows
  for (const row of data) {
    const line = cols.map((c) => String(row[c] ?? '').padEnd(widths[c])).join('  ');
    console.log(`  ${line}`);
  }
  console.log();
}

/**
 * Print key-value details
 */
export function details(data: Record<string, any>) {
  const maxKey = Math.max(...Object.keys(data).map((k) => k.length));
  for (const [key, value] of Object.entries(data)) {
    const label = `${colors.dim}${key.padEnd(maxKey)}${colors.reset}`;
    console.log(`  ${label}  ${value}`);
  }
  console.log();
}

/**
 * Format a timestamp to a readable date string
 */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

/**
 * Truncate a string to a max length
 */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}
