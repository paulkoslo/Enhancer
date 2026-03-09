# User View Maintenance

This document is for agents changing the simplified German `User View`.

The canonical technical runtime explanation still lives in `docs/agent-architecture.md`. This file explains the extra maintenance obligations created by the dual-view UI.

## What belongs to User View

The `User View` is the simplified German presentation of these product areas:

- guided intake
- run progress and approvals
- simplified settings
- floating help modal
- simplified status and step text

Primary implementation points:

- `apps/web/components/home-page-shell.tsx`
- `apps/web/components/settings-page-shell.tsx`
- `apps/web/components/run-page-shell.tsx`
- `apps/web/components/file-intake.tsx`
- `apps/web/components/run-workspace.tsx`
- `apps/web/components/settings-form.tsx`
- `apps/web/components/agent-flow-modal.tsx`
- `apps/web/lib/user-view.ts`

## When User View must be updated

Update the `User View` in the same change when any of the following happen:

- a run status is added, removed, renamed, or re-sequenced
- a new approval or run action is introduced
- intake fields or required setup steps change
- settings readiness or configuration rules change
- download behavior or artifact meaning changes
- the simplified "next step" CTA should change
- the floating help explanation becomes inaccurate

## Files that should trigger a User View review

Backend/runtime changes in these files should usually trigger a `User View` review:

- `apps/api/app/domain/planning/service.py`
- `apps/api/app/domain/execution/service.py`
- `apps/api/app/domain/research/service.py`
- `apps/api/app/domain/events/service.py`
- `apps/api/app/schemas/runs.py`

Frontend changes in these files should also trigger a review:

- `apps/web/lib/api.ts`
- `apps/web/lib/agent-flow.ts`
- `apps/web/lib/user-view.ts`

## Copy and UX rules

- `User View` should remain German-first.
- Keep wording action-oriented and low on technical jargon.
- Prefer one primary next step over multiple equal-weight actions.
- Keep advanced controls available, but hide them behind progressive disclosure when possible.
- Preserve the same backend functionality as `Developer View`.

## Test expectations

When `User View` behavior changes, update or add tests for:

- view-mode persistence
- German intake flow
- simplified run primary CTA behavior
- simplified help modal behavior
- settings behavior in both views when relevant

Do not remove existing `Developer View` assertions unless the expert behavior intentionally changed.
