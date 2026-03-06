/**
 * Pure cron-schedule utility — no Convex runtime dependency.
 * Safe to import from both V8 and Node.js ("use node") Convex files.
 *
 * Supports standard 5-field cron: minute hour dom month dow
 *   - `*`    — any value
 *   - `*\/N`  — every N units (step)
 *   - `N`    — exact value
 *   - `N-M`  — range
 *
 * Returns `fromMs + 60 * 60 * 1000` (1 hour) as a safe fallback for unsupported expressions.
 */
export function getNextCronRun(cronExpression: string, fromMs: number): number {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return fromMs + 60 * 60 * 1000;
  }

  const [minuteField, hourField, domField, monthField, dowField] = fields;

  function matchesField(field: string, value: number, min: number, max: number): boolean {
    if (field === "*") return true;
    if (field.startsWith("*/")) {
      const step = parseInt(field.slice(2), 10);
      return !isNaN(step) && step > 0 && (value - min) % step === 0;
    }
    if (field.includes("-")) {
      const [lo, hi] = field.split("-").map(Number);
      return !isNaN(lo) && !isNaN(hi) && value >= lo && value <= hi;
    }
    const num = parseInt(field, 10);
    return !isNaN(num) && value === num;
  }

  const MS_PER_MIN = 60 * 1000;
  const MAX_MINUTES = 366 * 24 * 60; // ~1 year in minutes

  let candidate = new Date(Math.ceil((fromMs + 1) / MS_PER_MIN) * MS_PER_MIN);

  for (let i = 0; i < MAX_MINUTES; i++) {
    const minute = candidate.getUTCMinutes();
    const hour = candidate.getUTCHours();
    const dom = candidate.getUTCDate();
    const month = candidate.getUTCMonth() + 1; // 1-12
    const dow = candidate.getUTCDay(); // 0=Sunday

    const domMatches = matchesField(domField, dom, 1, 31);
    const dowMatches = matchesField(dowField, dow, 0, 6);
    const domRestricted = domField !== "*";
    const dowRestricted = dowField !== "*";
    const dayMatches = (domRestricted && dowRestricted)
      ? (domMatches || dowMatches)
      : (domMatches && dowMatches);

    if (
      matchesField(minuteField, minute, 0, 59) &&
      matchesField(hourField, hour, 0, 23) &&
      dayMatches &&
      matchesField(monthField, month, 1, 12)
    ) {
      return candidate.getTime();
    }

    candidate = new Date(candidate.getTime() + MS_PER_MIN);
  }

  return fromMs + 60 * 60 * 1000;
}
