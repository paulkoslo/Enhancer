import { RunWorkspace } from "@/components/run-workspace";
import { getRun } from "@/lib/api";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getRun(runId);

  return (
    <main className="shell">
      <header className="hero">
        <div className="eyebrow">Run {run.id}</div>
        <h1 className="title">Plan, dry run, execute.</h1>
        <p className="subtitle">
          Every enrichment step is visible here: plan snapshots, messages, live events, and the final downloadable
          artifact.
        </p>
      </header>
      <RunWorkspace initialRun={run} />
    </main>
  );
}
