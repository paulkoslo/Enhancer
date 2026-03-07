"use client";

import { useEffect } from "react";

import type { RunRecord } from "@/lib/api";

const MERMAID_SOURCE = `flowchart TD
  UI["RunWorkspace chat UI"] --> API["POST /api/runs/:run_id/messages"]
  API --> ORCH["Orchestrator"]
  ORCH --> TP["Task Planner (rule-based)"]
  TP --> PS["Prompt/Schema builder"]
  ORCH --> FA["File Analyst (sheet profiler)"]
  PS --> PLAN["PlanVersion + assistant summary"]
  FA --> PLAN
  PLAN --> APPROVE["User approves plan"]
  APPROVE --> EXEC["Execution worker"]
  EXEC --> WR["Web Research via OpenRouter"]
  WR --> VAL["Validation rules"]
  VAL --> EXPORT["Export workbook"]
  VAL -->|retryable| REC["Recovery retry"]
  REC --> WR`;

type AgentFlowModalProps = {
  open: boolean;
  onClose: () => void;
  run?: RunRecord | null;
};

type FlowNode = {
  title: string;
  capability: "UI-only" | "Deterministic" | "AI-backed" | "Hybrid";
  description: string;
};

const planningLane: FlowNode[] = [
  {
    title: "Chat UI",
    capability: "UI-only",
    description: "Sends task text and plan feedback to the runs API. No model call happens here.",
  },
  {
    title: "Runs API",
    capability: "Deterministic",
    description: "Stores messages and forwards feedback into the planning service.",
  },
  {
    title: "Orchestrator",
    capability: "Deterministic",
    description: "Coordinates create-run, feedback handling, approvals, and agent-step events.",
  },
  {
    title: "Task Planner",
    capability: "Deterministic",
    description: "Infers output fields from keywords and rebuilds the structured run plan.",
  },
  {
    title: "Prompt/Schema",
    capability: "Deterministic",
    description: "Builds prompt templates and the JSON output contract for row enrichment.",
  },
  {
    title: "Assistant Message",
    capability: "Deterministic",
    description: "Writes the visible chat reply from string templates, not from an LLM response.",
  },
];

const executionLane: FlowNode[] = [
  {
    title: "Execution Worker",
    capability: "Deterministic",
    description: "Starts dry runs and full runs, loads rows, and fans out processing.",
  },
  {
    title: "Web Research",
    capability: "AI-backed",
    description: "Calls OpenRouter chat completions with the web plugin and a JSON schema.",
  },
  {
    title: "Validation",
    capability: "Deterministic",
    description: "Checks website quality, missing fields, citations, and confidence thresholds.",
  },
  {
    title: "Recovery",
    capability: "Hybrid",
    description: "Decides when to retry and then triggers a stricter second AI research pass.",
  },
  {
    title: "Export",
    capability: "Deterministic",
    description: "Writes dry-run workbooks and final output files from stored row results.",
  },
];

export function AgentFlowModal({ open, onClose, run }: AgentFlowModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const selectedModel = run
    ? run.draft_plan?.model_id ??
      run.approved_plan?.model_id ??
      run.selected_model_id ??
      run.draft_plan?.model_profile ??
      run.approved_plan?.model_profile ??
      run.selected_model_profile
    : null;

  return (
    <div
      aria-modal="true"
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="modal-card stack"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="stack-tight">
            <div className="eyebrow">Agent Flow</div>
            <h2 className="panel-title">What this chat actually does</h2>
            <p className="panel-subtitle">
              The chat panel refines a structured run plan. The only model-backed step in the live run path is row-level
              web research, with retries reusing the same provider.
            </p>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="agent-summary-grid">
          <div className="card stack-tight">
            <strong>{run ? "Current run" : "Current page"}</strong>
            {run ? (
              <>
                <div className="muted">Status: {run.status}</div>
                <div className="muted">Execution mode: {run.execution_mode}</div>
                <div className="muted">Selected model: {selectedModel}</div>
              </>
            ) : (
              <>
                <div className="muted">This is the app-wide architecture view.</div>
                <div className="muted">Open any run page for run-specific status and model context.</div>
              </>
            )}
          </div>
          <div className="card stack-tight">
            <strong>Most important finding</strong>
            <div className="muted">
              The visible assistant messages are composed in backend Python code. They are not direct LLM chat turns.
            </div>
          </div>
          <div className="card stack-tight">
            <strong>AI capability boundary</strong>
            <div className="muted">
              AI begins inside Web Research, where the backend sends prompts to OpenRouter with web search enabled.
            </div>
          </div>
        </div>

        <div className="agent-legend">
          {["UI-only", "Deterministic", "AI-backed", "Hybrid"].map((capability) => (
            <span className={`agent-kind ${capability.toLowerCase().replace(/[^a-z]+/g, "-")}`} key={capability}>
              {capability}
            </span>
          ))}
        </div>

        <div className="agent-lanes">
          <section className="card stack-tight">
            <strong>Planning lane</strong>
            <div className="agent-track">
              {planningLane.map((node, index) => (
                <FlowNodeCard index={index} key={node.title} node={node} total={planningLane.length} />
              ))}
            </div>
            <div className="card muted">
              File Analyst is a parallel planning helper: it profiles the selected sheet and generates the first assistant
              summary shown in chat.
            </div>
          </section>

          <section className="card stack-tight">
            <strong>Execution lane</strong>
            <div className="agent-track">
              {executionLane.map((node, index) => (
                <FlowNodeCard index={index} key={node.title} node={node} total={executionLane.length} />
              ))}
            </div>
            <div className="card muted">
              Recovery is not an independent agent brain. It is retry control logic that can trigger one stricter second
              research call.
            </div>
          </section>
        </div>

        <div className="card stack">
          <strong>Mermaid Source</strong>
          <pre className="code-block">{MERMAID_SOURCE}</pre>
        </div>

        <div className="card stack-tight">
          <strong>Current code reality</strong>
          <div className="muted">
            Advanced sandbox mode exists as a service shell, but the present run path does not generate code, tests, or
            a separate coding agent during planning or execution.
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowNodeCard({
  index,
  node,
  total,
}: {
  index: number;
  node: FlowNode;
  total: number;
}) {
  return (
    <>
      <div className="agent-node">
        <div className="stack-tight">
          <span className={`agent-kind ${node.capability.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            {node.capability}
          </span>
          <strong>{node.title}</strong>
        </div>
        <div className="muted">{node.description}</div>
      </div>
      {index < total - 1 ? <div className="agent-arrow" aria-hidden="true">→</div> : null}
    </>
  );
}
