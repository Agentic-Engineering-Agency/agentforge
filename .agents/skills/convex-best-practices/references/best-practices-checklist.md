# Best Practices Checklist

- Use domain-based file organization.
- Keep wrappers thin and helpers reusable.
- Use indexes instead of `.filter()` for primary lookups.
- Use pagination for unbounded lists.
- Keep queries deterministic.
- Use internal functions for backend-only flows.
- Use `ConvexError` or explicit errors where user-facing clarity matters.
- Keep environment variable and Node-only access inside actions when required.
