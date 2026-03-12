---
name: specsafe-completion-check
enabled: true
event: stop
action: warn
pattern: .*
---

**SpecSafe Completion Checklist**

Before stopping, verify the SpecSafe workflow was followed:

- [ ] Active spec exists in `specs/active/` for the work done
- [ ] `specsafe status` shows the correct stage
- [ ] Tests were written BEFORE implementation (TDD)
- [ ] `pnpm test` passes (all green)
- [ ] `tsc --noEmit` passes (0 TypeScript errors)
- [ ] Spec stage was advanced appropriately (`specsafe qa` or `specsafe done`)
- [ ] No production code was written without a spec

If any of these are not met, do NOT stop — address them first.
