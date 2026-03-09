# Web UI Maintenance

This frontend now has two product surfaces that run on the same backend contracts:

- `Developer View`: the existing expert UI with full technical detail
- `User View`: the simplified German UI with guided steps and reduced technical exposure

## Update rules for AI agents

When changing frontend behavior, decide whether the change affects one or both views.

- Update both views when a change touches run stages, approvals, downloads, settings behavior, intake flow, or any user-visible state derived from backend status.
- Update only `Developer View` when the change is intentionally expert-only and should stay technical.
- Update only `User View` when the change is presentation-only and does not alter existing expert behavior.

## Required follow-up areas

Review these surfaces together whenever runtime behavior changes:

- `apps/web/components/file-intake.tsx`
- `apps/web/components/run-workspace.tsx`
- `apps/web/components/settings-form.tsx`
- `apps/web/components/global-agent-map.tsx`
- `apps/web/components/agent-flow-modal.tsx`
- `apps/web/lib/user-view.ts`

## German copy rule

`User View` copy should stay German-first.

- Add or update German labels, status text, helper text, buttons, and empty states whenever new user-facing actions appear.
- Do not translate `Developer View` unless the change explicitly targets that surface too.

## Shared behavior contract

Both views must keep using the same API routes, mutations, and run/status semantics. If you add a new run action or backend status:

1. Update the shared stateful behavior in the relevant frontend container.
2. Update `Developer View` presentation if the expert UI should surface it.
3. Update `User View` step mapping and simplified CTA logic in `apps/web/lib/user-view.ts`.
4. Update the simplified floating help content if the user-facing explanation changed.
5. Add or update tests for both views where the behavior differs.
