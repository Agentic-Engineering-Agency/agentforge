# [SPEC-218] Settings page — replace hardcoded state with real Convex data

**Status:** Active | **Priority:** P1 | **Assigned:** frontend-engineer
**Created:** 2026-03-12 | **Updated:** 2026-03-12
**GitHub Issue:** #218

## Overview
The settings page uses `useState` with hardcoded defaults for general settings (defaultModel, defaultTemperature). While Convex queries/mutations are wired up, the state management has bugs: initial defaults flash before real data loads, save errors are swallowed, and there is no loading indicator.

## Problem Statement
Settings defaults in `useState('')` and `useState(0.7)` render immediately before the Convex `useQuery` returns. On first load or refresh this produces a visible flash of incorrect state. Save errors are silently swallowed with no user feedback. There is no distinction between "loading" and "no saved value".

## Goals
- General settings derive their displayed values from Convex query results, not hardcoded useState defaults
- Save operations show error feedback on failure
- Loading state is visible while settings are being fetched
- The page works correctly on first load with no saved settings (empty initial state)
- Settings persist correctly across refresh

## Non-Goals
- Redesigning the settings page layout
- Enterprise auth or org settings
- Hand-rolled modal fix (covered by Issue #219)

## Proposed Solution

### 1. Replace useState defaults with derived state from Convex
Instead of `useState('')` + `useEffect` sync, derive `defaultModel` and `defaultTemperature` directly from the `userSettings` query result. Use local state only as an edit buffer initialized from the query.

### 2. Add loading state
Show a loading skeleton or disabled state while `userSettings` query result is `undefined` (Convex initial load).

### 3. Add error handling on save
Wrap `handleSaveGeneral` in try/catch with a visible error message.

## Implementation Plan
1. Track whether userSettings query has loaded (undefined vs [])
2. Initialize edit buffer from query results, not hardcoded defaults
3. Add error state + UI for save failures
4. Add loading indicator for general tab
5. Sync changes across all 4 template locations

## Testing Plan
- Unit test: settings page renders loading state when query is undefined
- Unit test: settings page renders saved values when query returns data
- Unit test: save button calls Convex mutation with correct args
- Unit test: save error shows error message
- Unit test: empty initial state shows correct defaults

## Files Changed
- `packages/web/app/routes/settings.tsx` (and synced to 3 other locations)
