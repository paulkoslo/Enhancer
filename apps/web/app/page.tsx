import { FileIntake } from "@/components/file-intake";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="hero">
        <div className="eyebrow">Spreadsheet Research Agent</div>
        <h1 className="title">A mini codex for research-heavy spreadsheet work.</h1>
        <p className="subtitle">
          Upload a workbook, let the planner build a research-first run, review the dry run, then send the full job
          into the background with an audit trail.
        </p>
      </header>
      <FileIntake />
    </main>
  );
}
