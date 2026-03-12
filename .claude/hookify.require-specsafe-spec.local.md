---
name: require-specsafe-spec
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: (packages/(runtime|cli|core)/src|convex/).*\.(ts|tsx|js|jsx)$
---

**SpecSafe Enforcement — Active Spec Required**

You are editing production code. Before proceeding, verify:

1. **Check for an active spec:** Run `specsafe status` or check `specs/active/` for a `.spec.md` file
2. **If no active spec exists:** STOP. Create one first with `specsafe new` or the `/specsafe-new` skill
3. **If a spec exists:** Verify this edit falls within the spec's scope and current stage

**Exempt from this rule:**
- Test files (`*.test.ts`, `*.spec.ts`)
- Config files (`*.config.*`, `*.json`)
- Documentation (`*.md`)
- Spec files (`specs/**`)

**SpecSafe stages:** SPEC → TEST → CODE → QA → COMPLETE → ARCHIVED
- Only write production code during the **CODE** stage
- Only write tests during the **TEST** stage
