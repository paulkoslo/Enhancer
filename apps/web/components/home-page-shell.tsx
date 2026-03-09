"use client";

import { FileIntake } from "@/components/file-intake";
import { useViewMode } from "@/components/view-mode";

export function HomePageShell() {
  const { mode } = useViewMode();

  if (mode === "developer") {
    return (
      <main className="shell">
        <header className="hero">
          <div className="eyebrow">Spreadsheet Research Agent</div>
          <h1 className="title">Enhancer.</h1>
          <p className="subtitle">
            Upload a workbook, let the planner build a research-first run, review the dry run, then send the full job
            into the background with an audit trail.
          </p>
        </header>
        <FileIntake />
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero user-hero">
        <div className="eyebrow">User View</div>
        <h1 className="title">Enhancer</h1>
        <p className="subtitle">
        Excel-Datei hochladen, Auftrag beschreiben, Ergebnis freigeben.
        </p>
      </header>
      <FileIntake />
    </main>
  );
}
