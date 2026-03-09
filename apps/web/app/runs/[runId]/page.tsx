import { RunPageShell } from "@/components/run-page-shell";
import { getRun } from "@/lib/api";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getRun(runId);

  return <RunPageShell run={run} />;
}
