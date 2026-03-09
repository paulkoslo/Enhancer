"use client";

import { RunWorkspace } from "@/components/run-workspace";
import { useViewMode } from "@/components/view-mode";
import type { RunRecord } from "@/lib/api";

export function RunPageShell({ run }: { run: RunRecord }) {
  const { mode } = useViewMode();

  if (mode === "developer") {
    return (
      <main className="shell shell-wide">
        <header className="hero">
          <div className="eyebrow">Run {run.id}</div>
          <h1 className="title">Plan, dry run, execute.</h1>
          <p className="subtitle">
            Every enrichment step is visible here: plan snapshots, messages, live events, and the final downloadable
            artifact.
          </p>
        </header>
        <RunWorkspace key={run.id} initialRun={run} />
      </main>
    );
  }

  return (
    <main className="shell shell-wide">
      <header className="hero user-hero">
        <div className="eyebrow">Lauf {run.id}</div>
        <h1 className="title">Ihr Lauf wird Schritt fuer Schritt begleitet.</h1>
        <p className="subtitle">
          Diese Ansicht zeigt nur das Wesentliche: naechster Schritt, aktueller Fortschritt, Freigaben und Downloads.
        </p>
      </header>
      <RunWorkspace key={run.id} initialRun={run} />
    </main>
  );
}
