# Auth Patterns

## Core pieces

- `users` table with `tokenIdentifier` index.
- `getCurrentUser` helper.
- `getCurrentUserOrNull` helper when anonymous access is valid.
- Optional role or membership helpers for admin or org access.

## Access control rules

- Never trust client-supplied user IDs for authorization.
- Use unguessable IDs and server-side membership checks.
- Verify resource ownership before update or delete.

## Custom function wrapper pattern

Use custom query or mutation wrappers when the same auth or org-scoping logic repeats across many functions. This is the preferred Convex alternative to database-level row security.

## Anti-patterns

- Repeating identity lookup logic in every function.
- Using email as the access-control boundary.
- Mixing public and internal responsibilities without clear boundaries.
