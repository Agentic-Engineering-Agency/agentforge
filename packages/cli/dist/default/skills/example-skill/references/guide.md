# Example Skill Reference Guide

This is an example reference file that provides additional context for the skill.

## How References Work

Reference files in the `references/` directory are automatically loaded and injected into the agent's context when this skill is enabled.

## Best Practices

1. **Keep focused** - Each reference file should cover a specific topic
2. **Use markdown** - Well-formatted markdown renders best
3. **Add examples** - Code examples and use cases help agents understand
4. **Update regularly** - Keep references in sync with the skill's capabilities

## Example Code

```typescript
// Example function that could be referenced
function exampleHelper(input: string): string {
  return input.toUpperCase();
}
```

## See Also

- Main SKILL.md for primary instructions
- scripts/ directory for executable code
