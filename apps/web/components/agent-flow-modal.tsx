"use client";

import { useEffect } from "react";

import { useViewMode } from "@/components/view-mode";
import type { RunRecord } from "@/lib/api";
import { AGENT_FLOW_MERMAID, EXECUTION_LANE, PLANNING_LANE, type FlowNode } from "@/lib/agent-flow";

type AgentFlowModalProps = {
  open: boolean;
  onClose: () => void;
  run?: RunRecord | null;
};

export function AgentFlowModal({ open, onClose, run }: AgentFlowModalProps) {
  const { mode } = useViewMode();

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

  if (mode === "user") {
    return (
      <div aria-modal="true" className="modal-backdrop" onClick={onClose} role="dialog">
        <div className="modal-card stack" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <div className="stack-tight">
              <div className="eyebrow">So funktioniert's</div>
              <h2 className="panel-title">Der Lauf arbeitet in klaren Schritten.</h2>
              <p className="panel-subtitle">
                Die User View zeigt nur das Wesentliche. Im Hintergrund bleibt dieselbe Logik aktiv wie in der
                Entwickleransicht.
              </p>
            </div>
            <button className="ghost" onClick={onClose} type="button">
              Schließen
            </button>
          </div>

          <div className="agent-summary-grid">
            <div className="card stack-tight">
              <strong>1. Verstehen</strong>
              <div className="muted">Ihre Datei wird gelesen, das passende Blatt erkannt und ein Plan vorbereitet.</div>
            </div>
            <div className="card stack-tight">
              <strong>2. Testen</strong>
              <div className="muted">Ein kleiner Testlauf prüft, ob die vorgeschlagenen Ergebnisse sinnvoll sind.</div>
            </div>
            <div className="card stack-tight">
              <strong>3. Ausführen</strong>
              <div className="muted">Nach Ihrer Freigabe wird der komplette Lauf im Hintergrund fertig verarbeitet.</div>
            </div>
          </div>

          <div className="card stack">
            <strong>Aktueller Kontext</strong>
            {run ? (
              <div className="stack-tight">
                <div className="muted">Status: {run.status}</div>
                <div className="muted">Modus: {run.execution_mode}</div>
                <div className="muted">Ausgewähltes Modell: {selectedModel ?? "Automatisch"}</div>
              </div>
            ) : (
              <div className="muted">Diese Hilfe gilt für die gesamte App und passt sich dem aktuellen Lauf an.</div>
            )}
          </div>

          <div className="card stack-tight">
            <strong>Wichtig zu wissen</strong>
            <div className="muted">
              Die vereinfachte Ansicht blendet technische Details aus. Im Entwickler-Modus sehen Sie weiterhin die
              komplette Architektur, Ereignisse und Prompt-Details.
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              The chat panel now always uses the fast planning model for plan adaptation, while execution keeps the
              heavier research model for row-level web research.
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
              Chat replies, output fields, and prompt templates now come from the planning model instead of backend
              string templates.
            </div>
          </div>
          <div className="card stack-tight">
            <strong>AI capability boundary</strong>
            <div className="muted">
              AI can begin inside Task Planner during chat refinement, and continues inside Web Research during row
              execution.
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
              {PLANNING_LANE.map((node, index) => (
                <FlowNodeCard index={index} key={node.title} node={node} total={PLANNING_LANE.length} />
              ))}
            </div>
            <div className="card muted">
              File Analyst is a parallel planning helper: it profiles the sheet and feeds context into the planner, but
              the visible assistant reply now comes from the planning model.
            </div>
          </section>

          <section className="card stack-tight">
            <strong>Execution lane</strong>
            <div className="agent-track">
              {EXECUTION_LANE.map((node, index) => (
                <FlowNodeCard index={index} key={node.title} node={node} total={EXECUTION_LANE.length} />
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
          <pre className="code-block">{AGENT_FLOW_MERMAID}</pre>
        </div>

        <div className="card stack-tight">
          <strong>Current code reality</strong>
          <div className="muted">
            Advanced sandbox mode exists as a service shell, but the present run path does not generate code, tests, or
            a separate coding agent during planning or execution.
          </div>
        </div>

        <div className="card stack-tight">
          <strong>Prompt Sources</strong>
          <div className="muted">Planning model system prompt: `apps/api/app/domain/planning/service.py`</div>
          <div className="muted">Web research system prompt: `apps/api/app/domain/research/service.py`</div>
          <div className="muted">Execution prompt template builder: `apps/api/app/domain/planning/service.py`</div>
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
