# Agent Architecture

This project has a user-facing agent map inside the web app. That map is not optional documentation. It is part of the product contract and must stay aligned with the real runtime.

## Canonical source

The canonical Mermaid/viewer definition lives in:

- `apps/web/lib/agent-flow.ts`

The in-app modal renders from that shared file through:

- `apps/web/components/agent-flow-modal.tsx`
- `apps/web/components/global-agent-map.tsx`

## Maintenance rule

Whenever any agentic behavior changes, update `apps/web/lib/agent-flow.ts` in the same change. This includes:

- new agent/event labels
- planning becoming more or less model-driven
- prompt generation changes
- new execution phases
- retry/recovery changes
- sandbox or coding-agent activation
- removal of existing steps

Current expectation:

- planning chat uses the fast planning model profile
- assistant chat replies are planner-authored
- heavy row research uses the selected execution/research model

## Backend files that should trigger a viewer review

- `apps/api/app/domain/planning/service.py`
- `apps/api/app/domain/execution/service.py`
- `apps/api/app/domain/research/service.py`
- `apps/api/app/domain/provider/openrouter.py`
- `apps/api/app/domain/events/service.py`
- `apps/api/app/domain/sandbox/service.py`

If one of those files changes in a way that affects runtime flow, update the shared agent-flow definition before merging.
