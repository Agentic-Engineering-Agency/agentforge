# SPEC-20260223-live-agent-run: Live Agent Run View (AGE-119)

## Summary
Add a real-time agent run timeline view at `/runs/:runId` showing LLM calls, tool calls, memory ops, cost, and latency. Add "View Run" links in chat.

## Requirements

### Route
- Path: `/runs/:runId`
- Uses TanStack Router `createFileRoute`
- Wrapped in `DashboardLayout`

### Timeline Component
- Real-time updates via Convex `useQuery` on trace spans
- Each event shows: timestamp, event type (llm|tool|memory|error), details, duration
- Event types color-coded: llm=blue, tool=green, memory=purple, error=red
- Summary header: total duration, total cost, model used, status

### Data Source
- `convex/lib/tracing.ts` TraceSpan type
- Query by runId (traceId)
- Real-time subscription via Convex useQuery

### Chat Integration
- Each assistant message in chat.tsx shows a "View Run →" link
- Links to `/runs/{traceId}`

### Empty State
- Graceful handling when no events found
- Loading state while data streams in

## Acceptance Criteria
- [x] Route renders at /runs/:runId
- [x] Timeline displays events with correct types and formatting
- [x] Real-time updates via Convex useQuery
- [x] Empty state renders gracefully
- [x] "View Run →" link appears on assistant messages in chat
- [x] Follows observability.tsx dashboard patterns
- [x] ≥10 tests passing
