# SPEC-219: Modal Outside-Click Dismissal

## Problem
All 8 modals across 6 dashboard routes use hand-rolled `<div className="fixed inset-0 bg-black/60 z-50">` overlays that lack outside-click dismissal and escape-key support (Issue #219).

## Solution
Migrate all hand-rolled modal overlays to the shared Radix UI `Dialog` component from `packages/web/app/components/ui/dialog.tsx`, which provides:
- Outside-click dismissal via `onOpenChange`
- Escape key support
- Focus trapping
- Accessible ARIA attributes
- Consistent overlay styling

## Affected Routes (8 modals across 6 files)
1. `agents.tsx` — 1 modal (AgentModal for create/edit)
2. `connections.tsx` — 1 modal (Connect integration)
3. `cron.tsx` — 2 modals (CronModal for create + edit)
4. `projects.tsx` — 2 modals (Project create/edit form + ProjectDetailModal)
5. `settings.tsx` — 2 modals (Add API Key + Add Vault Secret)
6. `skills.tsx` — 1 modal (Code preview)

## Migration Pattern
For each modal:
1. Add `import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'`
2. Replace `<div className="fixed inset-0 bg-black/60 z-50 ...">` with `<Dialog open={...} onOpenChange={...}><DialogContent>`
3. Replace header div with `<DialogHeader><DialogTitle>`
4. Replace footer div with `<DialogFooter>`
5. Remove manual close buttons (DialogContent includes one)

## Verification
- Static analysis tests confirm no hand-rolled overlay patterns remain
- All routes import from `components/ui/dialog`
- `pnpm typecheck` passes
