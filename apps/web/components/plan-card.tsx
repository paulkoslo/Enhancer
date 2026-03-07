import type { RunPlan } from "@/lib/api";

export function PlanCard({
  draftPlan,
  approvedPlan,
}: {
  draftPlan?: RunPlan | null;
  approvedPlan?: RunPlan | null;
}) {
  if (!draftPlan && !approvedPlan) {
    return <div className="card muted">No plan has been generated yet.</div>;
  }

  return (
    <div className="stack">
      {draftPlan ? <PlanSection label="Draft Plan" plan={draftPlan} /> : null}
      {approvedPlan ? <PlanSection label="Approved Plan" plan={approvedPlan} /> : null}
    </div>
  );
}

function PlanSection({ label, plan }: { label: string; plan: RunPlan }) {
  return (
    <div className="card stack">
      <div className="status-chip">{label}</div>
      <div className="pill-list">
        <span className="pill">{plan.execution_mode}</span>
        <span className="pill">{plan.model_profile}</span>
        <span className="pill">{plan.sheet_name}</span>
      </div>
      <div>
        <strong>Input columns</strong>
        <div className="pill-list" style={{ marginTop: 8 }}>
          {plan.input_columns.map((column) => (
            <span key={column} className="pill">
              {column}
            </span>
          ))}
        </div>
      </div>
      <div>
        <strong>Output fields</strong>
        <div className="list" style={{ marginTop: 8 }}>
          {plan.output_fields.map((field) => (
            <div className="card" key={field.name}>
              <strong>{field.name}</strong>
              <div className="muted">{field.description}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <strong>Notes</strong>
        <div className="list" style={{ marginTop: 8 }}>
          {plan.notes.map((note) => (
            <div className="card" key={note}>
              {note}
            </div>
          ))}
        </div>
      </div>
      <div className="card stack">
        <strong>Prompt Template</strong>
        <pre className="code-block">{plan.prompt_template}</pre>
      </div>
    </div>
  );
}
