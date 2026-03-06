# Components Catalog

## Good fits

- Auth and access-control packages
- File storage
- Rate limiting
- Billing
- Analytics
- Notifications
- Search or embeddings

## Sibling component pattern

Use several focused components instead of one giant cross-cutting module. Each component should own one concern and expose a narrow API.

## Selection guidance

- Use a component when reuse or encapsulation matters.
- Use `convex-helpers` for lighter-weight patterns inside a normal codebase.
- Use plain local functions when the logic is specific to the app and unlikely to be shared.
