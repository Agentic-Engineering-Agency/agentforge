import type { SkillDefinition } from './types.js';
import { skillDefinitionSchema, SkillParseError } from './types.js';

/**
 * Extract the YAML frontmatter block from SKILL.md content.
 * Returns the raw YAML string between the first pair of `---` delimiters.
 */
function extractFrontmatter(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new SkillParseError('Content is empty');
  }

  // Must start with ---
  if (!trimmed.startsWith('---')) {
    throw new SkillParseError('Missing frontmatter: content must start with --- delimiters');
  }

  const firstDelimEnd = 3; // length of '---'
  const rest = trimmed.slice(firstDelimEnd);
  const secondDelimIdx = rest.indexOf('\n---');

  if (secondDelimIdx === -1) {
    throw new SkillParseError('Missing frontmatter: no closing --- delimiter found');
  }

  return rest.slice(0, secondDelimIdx);
}

// Use interface for the recursive object variant — avoids TS2456 circular type alias error
interface YamlObject { [key: string]: YamlValue }
type YamlValue = string | number | boolean | null | YamlValue[] | YamlObject;

/**
 * Lightweight YAML parser for SKILL.md frontmatter.
 * Handles:
 *  - Simple key: value pairs (string, number, boolean, null)
 *  - Nested objects (indented blocks)
 *  - Arrays with `- item` syntax (inline scalars and nested objects)
 */
function parseYaml(yaml: string): Record<string, YamlValue> {
  const lines = yaml.split('\n');
  return parseBlock(lines, 0, 0).value as Record<string, YamlValue>;
}

interface ParseResult {
  value: YamlValue;
  nextIndex: number;
}

/** Parse a scalar value string into the appropriate JS type. */
function parseScalar(raw: string): YamlValue {
  const v = raw.trim();
  if (v === 'null' || v === '~' || v === '') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  // Quoted string
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  // Number
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/** Count leading spaces on a line. */
function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Parse a block of YAML lines starting at `startIndex` with a minimum indent of `baseIndent`.
 * Returns the parsed object/array/scalar and the index of the next unconsumed line.
 */
function parseBlock(lines: string[], startIndex: number, baseIndent: number): ParseResult {
  const result: Record<string, YamlValue> = {};
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const indent = indentOf(line);

    // If the line is less indented than our base, we're done with this block
    if (indent < baseIndent) {
      break;
    }

    // Array item
    if (trimmed.startsWith('- ') || trimmed === '-') {
      // This shouldn't appear here; arrays are handled in parseArray
      break;
    }

    // Key: value pair
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const valueStr = trimmed.slice(colonIdx + 1).trim();

    i++;

    if (valueStr !== '') {
      // Inline scalar value
      result[key] = parseScalar(valueStr);
    } else {
      // Look ahead: next non-blank line determines if this is an object or array
      let nextNonBlank = i;
      while (nextNonBlank < lines.length && lines[nextNonBlank].trim() === '') {
        nextNonBlank++;
      }

      if (nextNonBlank >= lines.length) {
        result[key] = null;
        i = nextNonBlank;
        continue;
      }

      const nextLine = lines[nextNonBlank];
      const nextTrimmed = nextLine.trim();
      const nextIndent = indentOf(nextLine);

      if (nextIndent <= indent) {
        // No child content — null value
        result[key] = null;
        i = nextNonBlank;
        continue;
      }

      if (nextTrimmed.startsWith('- ') || nextTrimmed === '-') {
        // Array value
        const arrResult = parseArray(lines, nextNonBlank, nextIndent);
        result[key] = arrResult.value;
        i = arrResult.nextIndex;
      } else {
        // Nested object
        const objResult = parseBlock(lines, nextNonBlank, nextIndent);
        result[key] = objResult.value;
        i = objResult.nextIndex;
      }
    }
  }

  return { value: result, nextIndex: i };
}

/** Parse a YAML array starting at `startIndex`. Each item starts with `- `. */
function parseArray(lines: string[], startIndex: number, baseIndent: number): ParseResult {
  const items: YamlValue[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const indent = indentOf(line);
    if (indent < baseIndent) break;

    if (!trimmed.startsWith('- ') && trimmed !== '-') {
      break;
    }

    const itemContent = trimmed.slice(2).trim(); // strip '- '
    i++;

    if (itemContent === '') {
      // Multiline item object follows
      let nextNonBlank = i;
      while (nextNonBlank < lines.length && lines[nextNonBlank].trim() === '') {
        nextNonBlank++;
      }
      if (nextNonBlank < lines.length && indentOf(lines[nextNonBlank]) > baseIndent) {
        const objResult = parseBlock(lines, nextNonBlank, indentOf(lines[nextNonBlank]));
        items.push(objResult.value);
        i = objResult.nextIndex;
      } else {
        items.push(null);
        i = nextNonBlank;
      }
    } else {
      // Inline key:value on same line as `-`
      // Check if there are additional sub-keys on subsequent lines
      const colonIdx = itemContent.indexOf(':');
      if (colonIdx !== -1) {
        // Item is an object; first field is inline, rest may follow
        const firstKey = itemContent.slice(0, colonIdx).trim();
        const firstVal = itemContent.slice(colonIdx + 1).trim();

        // Gather additional lines that are more indented than baseIndent
        // (they belong to this array item's object)
        const syntheticLines: string[] = [];
        // Add the first key-value as the first line with correct indent
        const itemIndent = baseIndent + 2;
        const indentStr = ' '.repeat(itemIndent);
        syntheticLines.push(`${indentStr}${firstKey}: ${firstVal}`);

        // Collect continuation lines
        while (i < lines.length) {
          const contLine = lines[i];
          const contTrimmed = contLine.trim();
          if (contTrimmed === '' || contTrimmed.startsWith('#')) {
            i++;
            continue;
          }
          const contIndent = indentOf(contLine);
          if (contIndent <= baseIndent) break;
          if (contTrimmed.startsWith('- ')) break;
          syntheticLines.push(contLine);
          i++;
        }

        const objResult = parseBlock(syntheticLines, 0, itemIndent);
        items.push(objResult.value);
      } else {
        // Plain scalar item
        items.push(parseScalar(itemContent));
      }
    }
  }

  return { value: items, nextIndex: i };
}

/**
 * Parse a SKILL.md file content and return a validated SkillDefinition.
 *
 * @param content - The raw string content of the SKILL.md file
 * @throws SkillParseError if the frontmatter is missing, malformed, or fails validation
 */
export function parseSkillManifest(content: string): SkillDefinition {
  const frontmatter = extractFrontmatter(content);
  const raw = parseYaml(frontmatter);

  const result = skillDefinitionSchema.safeParse(raw);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join('.');
    const message = firstIssue.message;
    throw new SkillParseError(`Invalid skill manifest: ${field ? `[${field}] ` : ''}${message}`, field || undefined);
  }

  return result.data;
}
