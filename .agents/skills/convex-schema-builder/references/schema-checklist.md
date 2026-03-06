# Schema Checklist

## Preferred patterns

- One-to-many: store parent ID on the child and add an index.
- Many-to-many: use a junction table with indexes for each side and the combined lookup path.
- Timestamps: use numbers.
- Enums: use `v.union(v.literal(...))`.
- Optional fields: add with `v.optional(...)` first when changing existing data.

## Indexing rules

- Every foreign key should usually have an index.
- Add compound indexes for real query patterns, not hypothetical ones.
- If `by_a_and_b` covers `by_a`, avoid redundant indexes unless there is a real reason.

## Anti-patterns

- Deeply nested arrays of objects.
- `.filter()` as the primary lookup path when an index should exist.
- Large unbounded lists without pagination strategy.
- Schema changes that silently require backfills without planning them.

## Pagination cue

If a list can plausibly grow past about 100 rows, design the schema and query path to support pagination instead of unbounded `.collect()`.
