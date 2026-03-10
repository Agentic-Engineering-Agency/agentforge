# SPEC-20260223-001: Browser Automation Tool QA

## Status: Active
## Linear: AGE-115
## Owner: Luci (Track B)

## Objective
Validate and ensure comprehensive test coverage for the Browser Automation Tool (`packages/core/src/browser-tool.ts`), which was implemented before SpecSafe adoption.

## Module Overview
The browser-tool module provides Playwright-based browser automation as a built-in agent tool:
- BrowserSessionManager: Manages browser lifecycle, sessions, contexts, CDP/sandbox modes
- BrowserActionExecutor: Executes 15 browser action types (navigate, click, type, screenshot, snapshot, evaluate, wait, scroll, select, hover, goBack, goForward, reload, close, extractText)
- createBrowserTool / registerBrowserTool: MCP tool factory functions
- Zod schemas for input/output validation

## Success Criteria
- [ ] ≥20 integration tests covering all action types
- [ ] BrowserSessionManager: init, getPage, closeSession, shutdown, maxSessions, config, sandbox mode detection
- [ ] BrowserActionExecutor: all 15 action kinds tested with mocked Playwright
- [ ] createBrowserTool: tool creation, config, schemas, handler
- [ ] registerBrowserTool: MCP server registration
- [ ] Zod schema validation: valid inputs, invalid inputs, edge cases
- [ ] Error handling: graceful failure for all action types
- [ ] CDP fallback connection path tested
- [ ] Session isolation verified
- [ ] All tests pass with `pnpm test`

## Test Plan
### BrowserSessionManager
1. Initialize with default config
2. Create and reuse sessions
3. Session isolation (separate contexts)
4. Max sessions enforcement
5. Session close + reopening
6. Shutdown all sessions
7. Config accessor
8. Sandbox mode detection
9. CDP endpoint connection path
10. User agent and viewport config applied

### BrowserActionExecutor
11. Navigate action
12. Click action
13. Type action (with truncation)
14. Screenshot (default + fullPage)
15. Snapshot (accessibility tree)
16. Evaluate JS (string + object results)
17. Wait (selector, timeout, no condition)
18. Scroll (up/down with default/custom amount)
19. Select option
20. Hover
21. goBack / goForward / reload
22. Close session action
23. extractText (with/without selector, null handling)
24. Error handling (action failure returns success:false)
25. Page URL + title in results
26. Latency tracking
27. Multi-session independence

### Schemas & Tool Factory
28. All valid action schemas pass validation
29. Invalid action kind rejected
30. Navigate with invalid URL rejected
31. Optional sessionId validated
32. Result schema with data/error/screenshot variants
33. createBrowserTool returns correct structure
34. registerBrowserTool registers on MCPServer
35. Sandbox mode description toggle
