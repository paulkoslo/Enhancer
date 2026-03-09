"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { AgentFlowModal } from "@/components/agent-flow-modal";
import { DraftPlanEditor } from "@/components/draft-plan-editor";
import { DryRunPanel } from "@/components/dry-run-panel";
import { PlanCard } from "@/components/plan-card";
import { RunEvents } from "@/components/run-events";
import { useViewMode } from "@/components/view-mode";
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
  type RunEvent,
  type RunRecord,
} from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import {
  formatUserMessageRole,
  formatUserStatus,
  getUserPrimaryAction,
  getUserRunHeadline,
  getUserRunSteps,
} from "@/lib/user-view";

type DraftPayload = {
  sheet_name: string;
  enabled_output_fields: string[];
  model_profile: string;
  model_id?: string | null;
  prompt_template?: string | null;
  stricter_prompt_template?: string | null;
};

type ArtifactRecord = RunRecord["artifacts"][number] | undefined;

type WorkspaceViewProps = {
  run: RunRecord;
  feedback: string;
  setFeedback: (value: string) => void;
  actionError: string | null;
  visibleMessages: RunRecord["messages"];
  workspaceStartedAt: string;
  pendingLiveEvent: RunEvent | null;
  dryRunArtifact: ArtifactRecord;
  outputArtifact: ArtifactRecord;
  dryRunResults: RunRecord["row_results"];
  downloadUrl: string;
  dryRunUrl: string;
  isAwaitingPlanApproval: boolean;
  canStartDryRun: boolean;
  canApproveDryRun: boolean;
  canExecute: boolean;
  canPause: boolean;
  canCancel: boolean;
  canRetryFailed: boolean;
  draftPending: boolean;
  messagePending: boolean;
  planApprovePending: boolean;
  dryRunPending: boolean;
  dryRunApprovePending: boolean;
  executePending: boolean;
  pausePending: boolean;
  cancelPending: boolean;
  retryPending: boolean;
  approveAndDryRunPending: boolean;
  onShowAgentFlow: () => void;
  onSubmitDraft: (payload: DraftPayload) => void;
  onSendFeedback: () => void;
  onApprovePlan: () => void;
  onApproveAndStartDryRun: () => void;
  onStartDryRun: () => void;
  onApproveDryRun: () => void;
  onExecute: () => void;
  onPause: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

export function RunWorkspace({ initialRun }: { initialRun: RunRecord }) {
  const { mode } = useViewMode();
  const copy =
    mode === "user"
      ? {
          updatePlanFailed: "Plan konnte nicht aktualisiert werden.",
          approvePlanFailed: "Plan konnte nicht freigegeben werden.",
          startDryRunFailed: "Testlauf konnte nicht gestartet werden.",
          approveDryRunFailed: "Testlauf konnte nicht freigegeben werden.",
          executeFailed: "Vollständiger Lauf konnte nicht gestartet werden.",
          pauseFailed: "Lauf konnte nicht pausiert werden.",
          cancelFailed: "Lauf konnte nicht abgebrochen werden.",
          retryFailed: "Fehlgeschlagene Zeilen konnten nicht erneut versucht werden.",
        }
      : {
          updatePlanFailed: "Updating the plan failed.",
          approvePlanFailed: "Approving the plan failed.",
          startDryRunFailed: "Starting the dry run failed.",
          approveDryRunFailed: "Approving the dry run failed.",
          executeFailed: "Executing the full run failed.",
          pauseFailed: "Pausing the run failed.",
          cancelFailed: "Cancelling the run failed.",
          retryFailed: "Retrying failed rows failed.",
        };
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAgentFlow, setShowAgentFlow] = useState(false);
  const [workspaceStartedAt, setWorkspaceStartedAt] = useState(() => new Date().toISOString());
  const [approveAndDryRunPending, setApproveAndDryRunPending] = useState(false);

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
      setActionError(error instanceof Error ? error.message : copy.updatePlanFailed);
    },
  });

  const draftMutation = useMutation({
    mutationFn: (payload: DraftPayload) => updateDraftPlan(initialRun.id, payload),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.updatePlanFailed);
    },
  });

  const planApproveMutation = useMutation({
    mutationFn: () => approvePlan(initialRun.id),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.approvePlanFailed);
    },
  });

  const dryRunMutation = useMutation({
    mutationFn: () => startDryRun(initialRun.id),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.startDryRunFailed);
    },
  });

  const dryRunApproveMutation = useMutation({
    mutationFn: () => approveDryRun(initialRun.id),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.approveDryRunFailed);
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => executeRun(initialRun.id),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.executeFailed);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => applyRunAction(initialRun.id, "pause"),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.pauseFailed);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => applyRunAction(initialRun.id, "cancel"),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.cancelFailed);
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => applyRunAction(initialRun.id, "retry-failed"),
    onSuccess: updateRun,
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.retryFailed);
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
  const canPause = ["dry_run_running", "full_run_queued", "full_run_running", "recovering_failed_rows", "exporting"].includes(run.status);
  const canCancel = !["completed", "cancelled", "failed"].includes(run.status);
  const canRetryFailed = run.row_results.some((result) => ["failed", "needs_review"].includes(result.status));
  const visibleMessages = useMemo(
    () => run.messages.filter((message) => isOnOrAfter(message.created_at, workspaceStartedAt)),
    [run.messages, workspaceStartedAt],
  );
  const selectedModelProfile =
    run.selected_model_profile || run.draft_plan?.model_profile || run.approved_plan?.model_profile;
  const selectedModelId = run.selected_model_id || run.draft_plan?.model_id || run.approved_plan?.model_id;

  useEffect(() => {
    setFeedback("");
    setActionError(null);
    setShowAgentFlow(false);
    setWorkspaceStartedAt(new Date().toISOString());
    setApproveAndDryRunPending(false);
  }, [initialRun.id]);

  const handleApproveAndStartDryRun = async () => {
    setApproveAndDryRunPending(true);
    setActionError(null);
    try {
      await planApproveMutation.mutateAsync();
      await dryRunMutation.mutateAsync();
    } catch {
      // Mutation handlers already surface the error.
    } finally {
      setApproveAndDryRunPending(false);
    }
  };

  const pendingLiveEvent = useMemo<RunEvent | null>(() => {
    const createdAt = new Date().toISOString();

    if (draftMutation.isPending) {
      return {
        id: "local-draft-plan",
        type: "agent",
        message: "Updating draft plan.",
        created_at: createdAt,
        payload: {
          local: true,
          phase: "start",
          agent: "Task Planner",
          action: "patch_draft",
          task_label: "Draft plan update",
        },
      };
    }
    if (messageMutation.isPending) {
      return {
        id: "local-feedback",
        type: "agent",
        message: "Applying feedback to the plan.",
        created_at: createdAt,
        payload: {
          local: true,
          phase: "start",
          agent: "Task Planner",
          action: "refine_plan",
          task_label: "Plan refinement",
        },
      };
    }
    if (planApproveMutation.isPending) {
      return {
        id: "local-approve-plan",
        type: "status",
        message: "Approving plan.",
        created_at: createdAt,
        payload: {
          local: true,
          status: "dry_run_preparing",
          task_label: "Plan approval",
        },
      };
    }
    if (dryRunMutation.isPending) {
      return {
        id: "local-dry-run",
        type: "status",
        message: "Starting dry run.",
        created_at: createdAt,
        payload: {
          local: true,
          status: "dry_run_preparing",
          task_label: "Dry run preparation",
          model_profile: selectedModelProfile,
          model_id: selectedModelId,
        },
      };
    }
    if (dryRunApproveMutation.isPending) {
      return {
        id: "local-dry-run-approve",
        type: "status",
        message: "Approving dry run.",
        created_at: createdAt,
        payload: {
          local: true,
          status: "awaiting_final_approval",
          task_label: "Dry run approval",
        },
      };
    }
    if (executeMutation.isPending) {
      return {
        id: "local-execute-run",
        type: "status",
        message: "Queueing full run.",
        created_at: createdAt,
        payload: {
          local: true,
          status: "full_run_queued",
          task_label: "Full run queue",
          model_profile: selectedModelProfile,
          model_id: selectedModelId,
        },
      };
    }
    if (retryMutation.isPending) {
      return {
        id: "local-retry-run",
        type: "status",
        message: "Retrying failed rows.",
        created_at: createdAt,
        payload: {
          local: true,
          status: "recovering_failed_rows",
          task_label: "Retry failed rows",
        },
      };
    }
    if (pauseMutation.isPending) {
      return {
        id: "local-pause-run",
        type: "status",
        message: "Pausing run.",
        created_at: createdAt,
        payload: {
          local: true,
          status: "paused",
          task_label: "Pause run",
        },
      };
    }
    if (cancelMutation.isPending) {
      return {
        id: "local-cancel-run",
        type: "status",
        message: "Cancelling run.",
        created_at: createdAt,
        payload: {
          local: true,
          status: "cancelled",
          task_label: "Cancel run",
        },
      };
    }
    return null;
  }, [
    cancelMutation.isPending,
    draftMutation.isPending,
    dryRunApproveMutation.isPending,
    dryRunMutation.isPending,
    executeMutation.isPending,
    messageMutation.isPending,
    pauseMutation.isPending,
    planApproveMutation.isPending,
    retryMutation.isPending,
    selectedModelId,
    selectedModelProfile,
  ]);

  const viewProps: WorkspaceViewProps = {
    run,
    feedback,
    setFeedback,
    actionError,
    visibleMessages,
    workspaceStartedAt,
    pendingLiveEvent,
    dryRunArtifact,
    outputArtifact,
    dryRunResults,
    downloadUrl,
    dryRunUrl,
    isAwaitingPlanApproval,
    canStartDryRun,
    canApproveDryRun,
    canExecute,
    canPause,
    canCancel,
    canRetryFailed,
    draftPending: draftMutation.isPending,
    messagePending: messageMutation.isPending,
    planApprovePending: planApproveMutation.isPending,
    dryRunPending: dryRunMutation.isPending,
    dryRunApprovePending: dryRunApproveMutation.isPending,
    executePending: executeMutation.isPending,
    pausePending: pauseMutation.isPending,
    cancelPending: cancelMutation.isPending,
    retryPending: retryMutation.isPending,
    approveAndDryRunPending,
    onShowAgentFlow: () => setShowAgentFlow(true),
    onSubmitDraft: (payload) => draftMutation.mutate(payload),
    onSendFeedback: () => messageMutation.mutate(),
    onApprovePlan: () => planApproveMutation.mutate(),
    onApproveAndStartDryRun: handleApproveAndStartDryRun,
    onStartDryRun: () => dryRunMutation.mutate(),
    onApproveDryRun: () => dryRunApproveMutation.mutate(),
    onExecute: () => executeMutation.mutate(),
    onPause: () => pauseMutation.mutate(),
    onCancel: () => cancelMutation.mutate(),
    onRetry: () => retryMutation.mutate(),
  };

  return (
    <>
      {mode === "developer" ? (
        <DeveloperRunWorkspaceView {...viewProps} />
      ) : (
        <UserRunWorkspaceView {...viewProps} />
      )}
      <AgentFlowModal onClose={() => setShowAgentFlow(false)} open={showAgentFlow} run={run} />
    </>
  );
}

function DeveloperRunWorkspaceView({
  run,
  feedback,
  setFeedback,
  actionError,
  visibleMessages,
  workspaceStartedAt,
  pendingLiveEvent,
  dryRunArtifact,
  outputArtifact,
  dryRunResults,
  downloadUrl,
  dryRunUrl,
  isAwaitingPlanApproval,
  canStartDryRun,
  canApproveDryRun,
  canExecute,
  canPause,
  canCancel,
  canRetryFailed,
  draftPending,
  messagePending,
  planApprovePending,
  dryRunPending,
  dryRunApprovePending,
  executePending,
  pausePending,
  cancelPending,
  retryPending,
  approveAndDryRunPending,
  onShowAgentFlow,
  onSubmitDraft,
  onSendFeedback,
  onApprovePlan,
  onApproveAndStartDryRun,
  onStartDryRun,
  onApproveDryRun,
  onExecute,
  onPause,
  onCancel,
  onRetry,
}: WorkspaceViewProps) {
  return (
    <div className="run-workspace-grid">
      <section className="panel stack run-column">
        <div className="stack">
          <div className="status-chip">{run.status}</div>
          <h2 className="panel-title">Editable Workspace</h2>
          <p className="panel-subtitle">Adjust the draft inputs, refine the plan, and move the run through approval.</p>
        </div>
        <DraftPlanEditor
          controls={run.draft_controls}
          promptTemplate={run.draft_plan?.prompt_template}
          stricterPromptTemplate={run.draft_plan?.stricter_prompt_template}
          onSubmit={onSubmitDraft}
          pending={draftPending}
        />
        <div className="card stack">
          <div className="agent-card-header">
            <strong>Chat</strong>
            <button className="ghost" onClick={onShowAgentFlow} type="button">
              View Agent Flow
            </button>
          </div>
          <div className="card muted">
            This chat uses the fast planning model to adapt fields and prompts. The heavier research model runs later
            during dry runs and full execution.
          </div>
          <div className="list">
            {visibleMessages.length ? (
              visibleMessages.map((message) => (
                <div className="card message-card" key={message.id}>
                  <div className="status-chip">{message.role}</div>
                  <div className="message-body">{message.content}</div>
                </div>
              ))
            ) : (
              <div className="card muted">No chat in this workspace yet.</div>
            )}
          </div>
          <div className="field">
            <label htmlFor="feedback">Refine The Plan</label>
            <textarea id="feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
          </div>
          {actionError ? <div className="card" style={{ color: "var(--danger)" }}>{actionError}</div> : null}
          <div className="button-row">
            <button className="secondary" onClick={onSendFeedback} disabled={!feedback.trim() || messagePending}>
              Send Feedback
            </button>
          </div>
        </div>
        <div className="card stack">
          <div className="agent-card-header">
            <strong>Workflow</strong>
            <span className="status-chip subtle">{formatRunStage(run.status)}</span>
          </div>
          <div className="workflow-step">
            <div className="workflow-copy">
              <strong>1. Approve the plan</strong>
              <div className="muted">Approve the current draft, or approve it and immediately kick off the dry run.</div>
            </div>
            <div className="button-row">
              <button
                className="primary"
                onClick={onApproveAndStartDryRun}
                disabled={!isAwaitingPlanApproval || approveAndDryRunPending}
              >
                {approveAndDryRunPending ? "Approving + Starting..." : "Approve + Start Dry Run"}
              </button>
              <button
                className="secondary"
                onClick={onApprovePlan}
                disabled={!isAwaitingPlanApproval || planApprovePending || approveAndDryRunPending}
              >
                Approve Plan Only
              </button>
            </div>
          </div>
          <div className="workflow-step">
            <div className="workflow-copy">
              <strong>2. Review the dry run</strong>
              <div className="muted">Start the sample run manually or approve it once the sample workbook is ready.</div>
            </div>
            <div className="button-row">
              <button
                className="secondary"
                onClick={onStartDryRun}
                disabled={!canStartDryRun || dryRunPending || approveAndDryRunPending}
              >
                Start Dry Run
              </button>
              <button className="primary" onClick={onApproveDryRun} disabled={!canApproveDryRun || dryRunApprovePending}>
                Approve Dry Run
              </button>
            </div>
          </div>
          <div className="workflow-step">
            <div className="workflow-copy">
              <strong>3. Launch the full run</strong>
              <div className="muted">This uses multiple AI workers in parallel when the backend and database allow it.</div>
            </div>
            <div className="button-row">
              <button className="primary" onClick={onExecute} disabled={!canExecute || executePending}>
                Execute Full Run
              </button>
            </div>
          </div>
          <div className="workflow-step compact">
            <div className="workflow-copy">
              <strong>Run control</strong>
              <div className="muted">All live stages can be paused or cancelled, and failed rows can be retried.</div>
            </div>
            <div className="button-row">
              <button className="ghost" onClick={onPause} disabled={!canPause || pausePending}>
                Pause
              </button>
              <button className="ghost" onClick={onRetry} disabled={!canRetryFailed || retryPending}>
                Retry Failed
              </button>
              <button className="ghost danger-ghost" onClick={onCancel} disabled={!canCancel || cancelPending}>
                Cancel Run
              </button>
            </div>
          </div>
        </div>
        <div className="card stack">
          <strong>Dry Run Results</strong>
          <DryRunPanel results={dryRunResults} />
        </div>
      </section>

      <section className="panel stack run-column">
        <div className="stack">
          <div className="status-chip">Draft Plan</div>
          <h2 className="panel-title">Plan Draft</h2>
          <p className="panel-subtitle">Current plan snapshot, prompt template, and output schema.</p>
        </div>
        <PlanCard draftPlan={run.draft_plan} approvedPlan={run.approved_plan} />
      </section>

      <aside className="panel stack run-column run-live-column">
        <div className="stack">
          <h2 className="panel-title">Live Events</h2>
          <p className="panel-subtitle">This column stays pinned while you scroll so the active workers remain visible.</p>
        </div>
        <div className={`card workflow-banner ${workflowBannerTone(run.status)}`}>
          <strong>{workflowBannerTitle(run.status)}</strong>
          <div className="muted">{workflowBannerBody(run.status)}</div>
          <div className="button-row">
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
        <RunEvents
          runId={run.id}
          initialEvents={run.latest_events}
          pendingEvent={pendingLiveEvent}
          runStatus={run.status}
          visibleSince={workspaceStartedAt}
        />
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

function UserRunWorkspaceView({
  run,
  feedback,
  setFeedback,
  actionError,
  visibleMessages,
  workspaceStartedAt,
  pendingLiveEvent,
  dryRunArtifact,
  outputArtifact,
  dryRunResults,
  downloadUrl,
  dryRunUrl,
  isAwaitingPlanApproval,
  canStartDryRun,
  canApproveDryRun,
  canExecute,
  canPause,
  canCancel,
  canRetryFailed,
  draftPending,
  messagePending,
  planApprovePending,
  dryRunPending,
  dryRunApprovePending,
  executePending,
  pausePending,
  cancelPending,
  retryPending,
  approveAndDryRunPending,
  onSubmitDraft,
  onSendFeedback,
  onApprovePlan,
  onApproveAndStartDryRun,
  onStartDryRun,
  onApproveDryRun,
  onExecute,
  onPause,
  onCancel,
  onRetry,
}: WorkspaceViewProps) {
  const steps = getUserRunSteps(run.status);
  const headline = getUserRunHeadline(run, Boolean(outputArtifact));
  const primaryAction = getUserPrimaryAction({ run, hasOutputArtifact: Boolean(outputArtifact) });
  const currentStep = steps.find((step) => step.state === "current") ?? steps[0];
  const selectedPlanLabel = run.approved_plan ? "Freigegebener Plan" : run.draft_plan ? "Plan-Entwurf" : "Plan wird vorbereitet";

  const primaryActionDisabled =
    primaryAction.key === "approve-and-dry-run"
      ? !isAwaitingPlanApproval || approveAndDryRunPending
      : primaryAction.key === "approve-dry-run"
        ? !canApproveDryRun || dryRunApprovePending
        : primaryAction.key === "execute"
          ? !canExecute || executePending
          : primaryAction.key === "download"
            ? !outputArtifact
            : true;

  const primaryActionLabel =
    primaryAction.key === "approve-and-dry-run" && approveAndDryRunPending
      ? "Plan wird freigegeben..."
      : primaryAction.key === "approve-dry-run" && dryRunApprovePending
        ? "Testlauf wird freigegeben..."
        : primaryAction.key === "execute" && executePending
          ? "Lauf wird gestartet..."
          : primaryAction.label;

  const handlePrimaryAction = () => {
    switch (primaryAction.key) {
      case "approve-and-dry-run":
        onApproveAndStartDryRun();
        break;
      case "approve-dry-run":
        onApproveDryRun();
        break;
      case "execute":
        onExecute();
        break;
      case "download":
        window.location.assign(downloadUrl);
        break;
      default:
        break;
    }
  };

  return (
    <div className="user-run-grid">
      <section className="panel stack user-panel">
        <div className={`card workflow-banner ${headline.tone}`}>
          <div className="status-chip subtle">{formatUserStatus(run.status)}</div>
          <h2 className="panel-title">{headline.title}</h2>
          <p className="panel-subtitle">{headline.description}</p>
          <div className="user-primary-action">
            <button className="primary user-primary-button" disabled={primaryActionDisabled} onClick={handlePrimaryAction} type="button">
              {primaryActionLabel}
            </button>
            <div className="muted">{primaryAction.description}</div>
          </div>
        </div>

        {actionError ? <div className="card" style={{ color: "var(--danger)" }}>{actionError}</div> : null}

        <div className="card stack">
          <div className="agent-card-header">
            <strong>Fortschritt</strong>
            <span className="status-chip subtle">{currentStep.title}</span>
          </div>
          <div className="user-progress-list">
            {steps.map((step, index) => (
              <div className={`user-progress-item ${step.state}`} key={step.key}>
                <div className="user-progress-index">{index + 1}</div>
                <div className="stack-tight">
                  <strong>{step.title}</strong>
                  <div className="muted">{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <details className="user-details" open={isAwaitingPlanApproval}>
          <summary>Plan anpassen</summary>
          <div className="stack user-collapsible-content">
            <DraftPlanEditor
              controls={run.draft_controls}
              promptTemplate={run.draft_plan?.prompt_template}
              stricterPromptTemplate={run.draft_plan?.stricter_prompt_template}
              onSubmit={onSubmitDraft}
              pending={draftPending}
              variant="user"
            />
          </div>
        </details>

        <div className="card stack">
          <div className="agent-card-header">
            <strong>Lass einen Agenten deinen Plan anpassen</strong>
            <span className="status-chip subtle">{visibleMessages.length} Nachrichten</span>
          </div>
          <div className="muted">
            Beschreibe kurz, was der Agent an Feldern, Quellen oder Formulierungen ändern soll.
          </div>
          <div className="list">
            {visibleMessages.length ? (
              visibleMessages.map((message) => (
                <div className="card message-card" key={message.id}>
                  <div className="status-chip">{formatUserMessageRole(message.role)}</div>
                  <div className="message-body">{message.content}</div>
                </div>
              ))
            ) : (
              <div className="card muted">In dieser Sitzung gibt es noch keine Rückmeldungen.</div>
            )}
          </div>
          <div className="field">
            <label htmlFor="feedback">Was soll angepasst werden?</label>
            <textarea id="feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
          </div>
          <div className="button-row">
            <button className="secondary" onClick={onSendFeedback} disabled={!feedback.trim() || messagePending}>
              Rückmeldung senden
            </button>
          </div>
        </div>
      </section>

      <section className="panel stack user-panel user-plan-column">
        <div className="stack">
          <div className="status-chip">{selectedPlanLabel}</div>
          <h2 className="panel-title">Aktueller Plan</h2>
          <p className="panel-subtitle">
            Diese Mitte zeigt immer den aktuell gültigen Plan für den Lauf, damit die Freigabe klar und nachvollziehbar bleibt.
          </p>
        </div>
        <PlanCard draftPlan={run.draft_plan} approvedPlan={run.approved_plan} variant="user" />
        <div className="card stack">
          <strong>Testlauf-Ergebnisse</strong>
          <DryRunPanel results={dryRunResults} variant="user" />
        </div>
      </section>

      <aside className="panel stack run-live-column user-panel">
        <div className="stack">
          <h2 className="panel-title">Nächste Schritte und Downloads</h2>
          <p className="panel-subtitle">Alles Wichtige für Freigaben, Downloads und laufende Aktivitäten an einem Ort.</p>
        </div>

        <div className="user-summary-grid">
          <div className="card stack-tight">
            <strong>Status</strong>
            <div className="muted">{formatUserStatus(run.status)}</div>
          </div>
          <div className="card stack-tight">
            <strong>Aktives Blatt</strong>
            <div className="muted">{run.selected_sheet}</div>
          </div>
          <div className="card stack-tight">
            <strong>Modellprofil</strong>
            <div className="muted">{run.selected_model_profile}</div>
          </div>
        </div>

        <div className="card stack">
          <strong>Weitere Aktionen</strong>
          <div className="button-row">
            <button
              className="secondary"
              onClick={onApprovePlan}
              disabled={!isAwaitingPlanApproval || planApprovePending || approveAndDryRunPending}
            >
              Nur Plan freigeben
            </button>
            <button
              className="secondary"
              onClick={onStartDryRun}
              disabled={!canStartDryRun || dryRunPending || approveAndDryRunPending}
            >
              Testlauf manuell starten
            </button>
            <button className="secondary" onClick={onApproveDryRun} disabled={!canApproveDryRun || dryRunApprovePending}>
              Testlauf freigeben
            </button>
            <button className="secondary" onClick={onExecute} disabled={!canExecute || executePending}>
              Kompletten Lauf starten
            </button>
            <button className="ghost" onClick={onPause} disabled={!canPause || pausePending}>
              Pausieren
            </button>
            <button className="ghost" onClick={onRetry} disabled={!canRetryFailed || retryPending}>
              Problematische Zeilen erneut versuchen
            </button>
            <button className="ghost danger-ghost" onClick={onCancel} disabled={!canCancel || cancelPending}>
              Lauf abbrechen
            </button>
          </div>
          <div className="button-row">
            {dryRunArtifact ? (
              <a className="secondary" href={dryRunUrl}>
                Testlauf herunterladen
              </a>
            ) : null}
            {outputArtifact ? (
              <a className="primary" href={downloadUrl}>
                Ergebnis herunterladen
              </a>
            ) : null}
          </div>
        </div>

        <div className="card stack">
          <strong>Aktivitäten</strong>
          <RunEvents
            runId={run.id}
            initialEvents={run.latest_events}
            pendingEvent={pendingLiveEvent}
            runStatus={run.status}
            visibleSince={workspaceStartedAt}
            variant="user"
          />
        </div>

        {run.artifacts.length ? (
          <div className="card stack">
            <strong>Verfügbare Dateien</strong>
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

function isOnOrAfter(value: string, threshold: string): boolean {
  const valueTime = Date.parse(value);
  const thresholdTime = Date.parse(threshold);
  if (Number.isNaN(valueTime) || Number.isNaN(thresholdTime)) {
    return value >= threshold;
  }
  return valueTime >= thresholdTime;
}

function formatRunStage(status: string): string {
  const labels: Record<string, string> = {
    awaiting_plan_approval: "Awaiting plan approval",
    dry_run_preparing: "Ready for dry run",
    dry_run_running: "Dry run in progress",
    dry_run_review: "Dry run complete",
    awaiting_final_approval: "Awaiting full run approval",
    full_run_queued: "Full run queued",
    full_run_running: "Full run in progress",
    recovering_failed_rows: "Retrying failed rows",
    exporting: "Exporting workbook",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    paused: "Paused",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

function workflowBannerTitle(status: string): string {
  if (status === "dry_run_review") {
    return "Dry run complete";
  }
  if (status === "completed") {
    return "Full run complete";
  }
  if (status === "full_run_running") {
    return "Parallel AI workers are running";
  }
  if (status === "dry_run_running") {
    return "Dry run is working";
  }
  return formatRunStage(status);
}

function workflowBannerBody(status: string): string {
  if (status === "dry_run_review") {
    return "Review the sample rows, then approve the dry run or download the sample workbook.";
  }
  if (status === "completed") {
    return "The enriched workbook is ready. Download it from this panel.";
  }
  if (status === "full_run_running") {
    return "The backend can fan out multiple web-research workers in parallel for faster row processing.";
  }
  if (status === "dry_run_running") {
    return "Sample rows are being processed right now so you can validate the prompt and schema before the full run.";
  }
  return "Follow the current worker activity and run state here.";
}

function workflowBannerTone(status: string): string {
  if (status === "dry_run_review" || status === "completed") {
    return "success";
  }
  if (status === "failed" || status === "cancelled") {
    return "danger";
  }
  if (["dry_run_running", "full_run_running", "full_run_queued", "exporting"].includes(status)) {
    return "active";
  }
  return "neutral";
}
