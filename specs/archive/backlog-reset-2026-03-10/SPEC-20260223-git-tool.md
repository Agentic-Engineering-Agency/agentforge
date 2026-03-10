# SPEC-20260223-002: Git Integration Tool QA

## Status: Active
## Linear: AGE-116
## Owner: Luci (Track B)

## Objective
Validate and ensure comprehensive test coverage for the Git Integration Tool (`packages/core/src/git-tool.ts`), which was implemented before SpecSafe adoption.

## Module Overview
The git-tool module provides agents with Git repository awareness and management:
- GitTool: Main class with repo detection, status, branch, commit, log, diff, stash, remote ops
- GitToolError: Custom error class with command context
- Command sanitization for injection prevention

## Success Criteria
- [ ] ≥15 integration tests covering all major operations
- [ ] Repository detection: single, nested, depth-limited, dirty detection
- [ ] Status: clean, dirty, staged, untracked, modified, conflict states
- [ ] Branch ops: list, create, switch, delete, force delete
- [ ] Commit ops: stage, unstage, commit, commit -a, amend
- [ ] Log: entries, count limit, format parsing
- [ ] Diff: clean, unstaged, staged, ref-to-ref
- [ ] Stash: create, list, pop, drop
- [ ] Remote ops: fetch, pull, push
- [ ] Security: sanitize rejects injection, allows safe names
- [ ] Error handling: GitToolError with command context
- [ ] Utility: isGitRepository, getRepoRoot, setRepository

## Test Plan
### Repository Detection
1. Detect repos in directory tree
2. Return correct repo metadata
3. Respect maxSearchDepth
4. Detect dirty repo state

### Worktree Status
5. Clean repo status
6. Untracked files detection
7. Modified files detection
8. Staged files detection
9. HEAD commit info

### Branch Management
10. List branches
11. Create and switch branches
12. Switch to existing branch
13. Error on non-existent branch
14. Create branch from ref
15. Delete branch

### Commit Operations
16. Stage single file
17. Stage multiple files
18. Unstage files
19. Create commit
20. Commit with -a flag

### Log & Diff
21. Commit log with metadata
22. Log count limit
23. Empty diff on clean repo
24. Diff with file changes
25. Staged diff

### Stash Management
26. Stash changes
27. List stashes
28. Pop stash

### Security
29. Reject injection characters
30. Allow safe branch names
31. Allow branch names with slashes

### Utility & Error Handling
32. isGitRepository detection
33. getRepoRoot
34. setRepository
35. GitToolError has command property
