# SPEC-20260223: Skill Marketplace MVP

**Status:** CODE
**Issue:** AGE-121
**Branch:** feat/AGE-121-skill-marketplace
**Created:** 2026-02-23

## Summary
Remote skill marketplace enabling developers to publish, discover, and install AgentForge skills across the community.

## Requirements

### Backend (convex/)
1. **convex/skillMarketplace.ts** — Convex functions for skill CRUD
   - `listSkills` query: filter by category and/or search query, returns all matching skills
   - `getFeaturedSkills` query: returns skills with featured=true
   - `getSkill` query: fetch single skill by name, returns null if missing
   - `publishSkill` mutation: upsert skill by name (preserves downloads + featured on update)
   - `incrementDownloads` mutation: increment skill.downloads by 1

2. **convex/schema.ts** (modified) — Add `skillMarketplace` table:
   - name (string, indexed), version, description, author, category, tags (array)
   - downloads (number, default 0), featured (boolean, default false)
   - skillMdContent (string), readmeContent (optional string), repositoryUrl (optional string)
   - createdAt (number), updatedAt (number)

3. **convex/lib/seedMarketplace.ts** — Seed 6 curated starter skills:
   - browser-automation, git-operations, slack-notifier, data-extractor, email-sender, web-researcher

### Core Client (packages/core/src/skills/marketplace-client.ts)
1. `marketplaceSkillSchema` — Zod schema for full marketplace skill record
2. `publishSkillInputSchema` — Zod schema for publish input:
   - name: lowercase kebab-case starting with letter
   - version: semver (e.g. 1.0.0)
   - description, author: non-empty strings
   - tags: string array
   - skillMdContent: non-empty string
   - repositoryUrl: optional valid URL
3. `MarketplaceError` class with code: `NETWORK | NOT_FOUND | VALIDATION | SERVER`
4. `fetchFeaturedSkills(convexUrl)` — calls getFeaturedSkills query
5. `searchSkills(query, convexUrl, category?)` — calls listSkills query
6. `getSkill(name, convexUrl)` — calls getSkill query, returns null if missing
7. `publishSkill(input, convexUrl)` — validates input, calls publishSkill mutation
8. `installFromMarketplace(name, targetDir, convexUrl)` — downloads + writes SKILL.md locally

### CLI (packages/cli/src/commands/skill.ts) (modified)
Add 3 new subcommands under `agentforge skill`:
- `skill search <query> [--category <cat>]` — lists matching skills
- `skill featured` — shows featured skills
- `skill publish <skill-dir>` — reads SKILL.md + publishes to marketplace
All commands read `CONVEX_URL` from env var `AGENTFORGE_CONVEX_URL`.

### Dashboard UI (packages/web/app/routes/skills-marketplace.tsx) (new)
- TanStack Router route at `/skills-marketplace`
- DashboardLayout wrapper
- Search input with real-time filtering
- Category filter pills (all, automation, developer-tools, communication, data, research)
- Featured section (4-star grid, hidden when search/filter active)
- Results grid with SkillCard components
- SkillCard: name, version, author, description, category badge, tags, download count, install button, external link
- Nav item "Marketplace" (Store icon) added to DashboardLayout Agent section

## Architecture
- **Backend:** Convex `skillMarketplace` table with search index on name+description
- **Client:** HTTP-based client calling Convex `/api/query` and `/api/mutation` endpoints
- **CLI:** Commander.js subcommands reading `AGENTFORGE_CONVEX_URL` env var
- **UI:** TanStack Router page with mock data (Convex integration TODO-commented)

## Test Plan
- 40+ unit tests in `tests/skill-marketplace.test.ts`:
  - `searchSkills`: query, category filter, empty results, server error
  - `fetchFeaturedSkills`: featured list, empty list
  - `getSkill`: found, null for missing
  - `publishSkill`: valid publish, invalid name/version/description/author rejection
  - `marketplaceSkillSchema`: full validation, missing fields, optional fields
  - `publishSkillInputSchema`: valid input, uppercase/number-start name rejection, hyphen names, non-semver, repo URL
  - `MarketplaceError`: name, code, all error code variants
  - Edge cases: Convex error response format, network failure, trailing slash URL stripping
  - Convex function logic (pure): upsert preserves downloads, incrementDownloads, listSkills filtering, seed data shape

## Files
- `convex/schema.ts` (modified — add skillMarketplace table)
- `convex/skillMarketplace.ts` (new)
- `convex/lib/seedMarketplace.ts` (new)
- `packages/core/src/skills/marketplace-client.ts` (new)
- `packages/core/src/index.ts` (modified — re-export marketplace-client)
- `packages/cli/src/commands/skill.ts` (modified — add search/publish/featured)
- `packages/web/app/routes/skills-marketplace.tsx` (new)
- `packages/web/app/components/DashboardLayout.tsx` (modified — Marketplace nav item)
- `tests/skill-marketplace.test.ts` (new)
