# Backlog Reset Archive

This folder contains the `specs/active/` snapshot that was archived on 2026-03-10 during the GitHub backlog reset.

Why these files were archived:
- many were stale relative to the current repo,
- several contradicted the daemon-first Mastra architecture,
- multiple docs duplicated the same work under different sprint/spec names,
- several remained marked active even though the code had moved, partially landed, or the scope had changed.

The active source of truth moved to GitHub issues on 2026-03-10.

Primary replacement issues:
- `#75` Dashboard Canonicalization
- `#73` Project Configuration Integrity
- `#72` Model Catalog And Selection UX
- `#74` Files Productization
- `#44` Skills Marketplace Productization
- `#15` MCP Lifecycle Completion
- `#38` Sandbox Execution Productization
- `#4` Cloudflare Deployment Modernization
- `#213` Runtime/CLI Convergence
- `#214` Dashboard E2E And Route Reliability
- `#215` Convex Runtime-Boundary Cleanup
- `#216` Project configuration bug: cannot select agents
- `#217` Chat-scoped model override
- `#218` Settings page hardcoded-state bug
- `#219` Modal outside-click dismissal bug

Archive guidance:
- do not restore these files to `specs/active/` without first reconciling them against the current codebase and the canonical GitHub issues,
- when one of these archived files still contains useful implementation detail, copy the needed detail into the relevant GitHub issue or a new focused spec,
- treat this folder as historical context, not as an active backlog.
