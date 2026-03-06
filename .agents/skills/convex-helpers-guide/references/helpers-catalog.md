# Helpers Catalog

## High-value helpers

- Relationship helpers for traversing linked tables.
- Custom function wrappers for auth and org scoping.
- Reusable utility patterns that reduce repetitive query or mutation boilerplate.

## Recommended first move

If the task mentions repeated auth checks or repeated resource scoping, start by considering custom function wrappers. That is usually the most valuable `convex-helpers` pattern.

## Example use cases

- loading a record and its related children,
- enforcing org membership across many functions,
- standardizing wrapper behavior for authenticated queries and mutations.
