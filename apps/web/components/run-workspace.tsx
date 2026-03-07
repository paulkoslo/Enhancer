"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  addRunMessage,
  approveDryRun,
  approvePlan,
  applyRunAction,
  downloadDryRunUrl,
  downloadRunUrl,
  executeRun,
  getRun,
  startDryRun,
  updateDraftPlan,
  type RunRecord,
} from "@/lib/api";
import { AgentFlowModal } from "@/components/agent-flow-modal";
import { DraftPlanEditor } from "@/components/draft-plan-editor";
import { DryRunPanel } from "@/components/dry-run-panel";
import { PlanCard } from "@/components/plan-card";
import { RunEvents } from "@/components/run-events";
import { formatTimestamp } from "@/lib/format";

export function RunWorkspace({ initialRun }: { initialRun: RunRecord }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAgentFlow, setShowAgentFlow] = useState(false);

  const runQuery = useQuery({
    queryKey: ["run", initialRun.id],
    queryFn: () => getRun(initialRun.id),
    initialData: initialRun,
    refetchInterval: 4000,
  });

  const updateRun = (run: RunRecord) => {
    queryClient.setQueryData(["run", initialRun.id], run);
    setActionError(null);
  };

  const messageMutation = useMutation({
    mutationFn: () => addRunMessage(initialRun.id, feedback),
    onSuccess: (run) => {
      setFeedback("");
      updateRun(run);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Updating the plan failed.");
    },
  });

  const draftMutation = useMutation({
    mutationFn: (payload: { sheet_name: string; enabled_output_fields: string[]; model_profile: string; model_id?: string | null }) =>
      updateDraftPlan(initialRun.id, payload),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Updating the draft plan failed.");
    },
  });

  const planApproveMutation = useMutation({
    mutationFn: () => approvePlan(initialRun.id),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Approving the plan failed.");
    },
  });

  const dryRunMutation = useMutation({
    mutationFn: () => startDryRun(initialRun.id),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Starting the dry run failed.");
    },
  });

  const dryRunApproveMutation = useMutation({
    mutationFn: () => approveDryRun(initialRun.id),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Approving the dry run failed.");
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => executeRun(initialRun.id),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Executing the full run failed.");
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => applyRunAction(initialRun.id, "pause"),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Pausing the run failed.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => applyRunAction(initialRun.id, "cancel"),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Cancelling the run failed.");
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => applyRunAction(initialRun.id, "retry-failed"),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Retrying failed rows failed.");
    },
  });

  const run = runQuery.data;
  const dryRunArtifact = useMemo(
    () => run.artifacts.find((artifact) => artifact.kind === "dry_run_results"),
    [run.artifacts],
  );
  const outputArtifact = useMemo(
    () => run.artifacts.find((artifact) => artifact.kind === "final_workbook"),
    [run.artifacts],
  );
  const dryRunResults = useMemo(
    () => run.row_results.filter((result) => run.draft_plan?.sample_row_indices.includes(result.row_index)),
    [run],
  );
  const downloadUrl = downloadRunUrl(run.id);
  const dryRunUrl = downloadDryRunUrl(run.id);
  const isAwaitingPlanApproval = run.status === "awaiting_plan_approval";
  const canStartDryRun = run.status === "dry_run_preparing";
  const canApproveDryRun = run.status === "dry_run_review";
  const canExecute = run.status === "awaiting_final_approval";

  return (
    <div className="grid two">
      <section className="panel stack">
          <div className="stack">
            <div className="status-chip">{run.status}</div>
            <h2 className="panel-title">Run Workspace</h2>
            <p className="panel-subtitle">
              Review the plan, ask for changes, approve the dry run, and watch the research-first execution stream.
            </p>
          </div>
          <DraftPlanEditor
            controls={run.draft_controls}
            onSubmit={(payload) => draftMutation.mutate(payload)}
            pending={draftMutation.isPending}
          />
          <PlanCard draftPlan={run.draft_plan} approvedPlan={run.approved_plan} />
          <div className="card stack">
            <div className="agent-card-header">
              <strong>Chat</strong>
              <button className="ghost" onClick={() => setShowAgentFlow(true)} type="button">
                View Agent Flow
              </button>
            </div>
            <div className="card muted">
              This chat updates the plan and assistant summary. Row-level AI research starts later during dry runs and full
              execution.
            </div>
            <div className="list">
              {run.messages.map((message) => (
                <div className="card message-card" key={message.id}>
                  <div className="status-chip">{message.role}</div>
                  <div className="message-body">{message.content}</div>
                </div>
              ))}
            </div>
            <div className="field">
              <label htmlFor="feedback">Refine The Plan</label>
              <textarea id="feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
            </div>
            {actionError ? <div className="card" style={{ color: "var(--danger)" }}>{actionError}</div> : null}
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => messageMutation.mutate()}
                disabled={!feedback.trim() || messageMutation.isPending}
              >
                Send Feedback
              </button>
              <button
                className="primary"
                onClick={() => planApproveMutation.mutate()}
                disabled={!isAwaitingPlanApproval || planApproveMutation.isPending}
              >
                Approve Plan
              </button>
              <button className="secondary" onClick={() => dryRunMutation.mutate()} disabled={!canStartDryRun || dryRunMutation.isPending}>
                Start Dry Run
              </button>
              <button
                className="secondary"
                onClick={() => dryRunApproveMutation.mutate()}
                disabled={!canApproveDryRun || dryRunApproveMutation.isPending}
              >
                Approve Dry Run
              </button>
              <button className="primary" onClick={() => executeMutation.mutate()} disabled={!canExecute || executeMutation.isPending}>
                Execute Full Run
              </button>
            </div>
          </div>
          <div className="card stack">
            <strong>Dry Run Results</strong>
            <DryRunPanel results={dryRunResults} />
          </div>
          <AgentFlowModal onClose={() => setShowAgentFlow(false)} open={showAgentFlow} run={run} />
        </section>
        <aside className="panel stack">
          <div className="stack">
            <h2 className="panel-title">Live Events</h2>
            <p className="panel-subtitle">Status changes, row progress, retries, and exports stream here.</p>
          </div>
          <RunEvents runId={run.id} initialEvents={run.latest_events} />
          <div className="card stack">
            <strong>Run Controls</strong>
            <div className="button-row">
              <button className="ghost" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending}>
                Pause
              </button>
              <button className="ghost" onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}>
                Retry Failed
              </button>
              <button className="ghost" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                Cancel
              </button>
              {dryRunArtifact ? (
                <a className="secondary" href={dryRunUrl}>
                  Download Dry Run
                </a>
              ) : null}
              {outputArtifact ? (
                <a className="primary" href={downloadUrl}>
                  Download Output
                </a>
              ) : null}
            </div>
          </div>
          {run.artifacts.length ? (
            <div className="card stack">
              <strong>Artifacts</strong>
              <div className="list">
                {run.artifacts.map((artifact) => (
                  <div className="card" key={artifact.id}>
                    <div className="status-chip">{artifact.kind}</div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {formatTimestamp(artifact.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
    </div>
  );
}
