import type { RunPlan } from "@/lib/api";

export function PlanCard({
  draftPlan,
  approvedPlan,
  variant = "developer",
}: {
  draftPlan?: RunPlan | null;
  approvedPlan?: RunPlan | null;
  variant?: "developer" | "user";
}) {
  const selectedPlan = approvedPlan ?? draftPlan;

  if (!selectedPlan) {
    return <div className="card muted">{variant === "user" ? "Es wurde noch kein Plan erstellt." : "No plan has been generated yet."}</div>;
  }

  return <PlanSection label={approvedPlan ? "Approved Plan" : "Draft Plan"} plan={selectedPlan} variant={variant} />;
}

function PlanSection({
  label,
  plan,
  variant,
}: {
  label: string;
  plan: RunPlan;
  variant: "developer" | "user";
}) {
  const isUserView = variant === "user";
  const localizedLabel = isUserView ? (label === "Approved Plan" ? "Freigegebener Plan" : "Plan-Entwurf") : label;
  const inputLabel = isUserView ? "Eingabespalten" : "Input columns";
  const outputLabel = isUserView ? "Ausgabefelder" : "Output fields";
  const notesLabel = isUserView ? "Wichtige Hinweise" : "Notes";
  const promptLabel = isUserView ? "Anweisung" : "Prompt Template";
  const taskLabel = isUserView ? "Aufgabe" : "Task";

  return (
    <div className={`card stack${isUserView ? " user-plan-card" : ""}`}>
      <div className="agent-card-header">
        <div className="status-chip">{localizedLabel}</div>
        <div className="pill-list">
          <span className="pill">{plan.execution_mode}</span>
          <span className="pill">{plan.model_profile}</span>
          <span className="pill">{plan.sheet_name}</span>
        </div>
      </div>
      <div className={isUserView ? "user-plan-summary" : undefined}>
        <strong>{taskLabel}</strong>
        <div className="muted">{plan.task}</div>
      </div>
      {isUserView ? (
        <>
          <details className="user-details" open>
            <summary>{inputLabel}</summary>
            <div className="user-collapsible-content">
              <div className="pill-list">
                {plan.input_columns.map((column) => (
                  <span key={column} className="pill">
                    {column}
                  </span>
                ))}
              </div>
            </div>
          </details>
          <details className="user-details" open>
            <summary>{outputLabel}</summary>
            <div className="user-collapsible-content">
              <div className="list user-output-field-list">
                {plan.output_fields.map((field) => (
                  <div className="card user-output-field-card" key={field.name}>
                    <strong>{field.name}</strong>
                    <div className="muted">{field.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </details>
          <details className="user-details" open>
            <summary>{notesLabel}</summary>
            <div className="user-collapsible-content">
              <div className="list user-note-list">
                {plan.notes.map((note) => (
                  <div className="card" key={note}>
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </>
      ) : (
        <>
          <div>
            <strong>{inputLabel}</strong>
            <div className="pill-list" style={{ marginTop: 8 }}>
              {plan.input_columns.map((column) => (
                <span key={column} className="pill">
                  {column}
                </span>
              ))}
            </div>
          </div>
          <div>
            <strong>{outputLabel}</strong>
            <div className={`list${isUserView ? " user-output-field-list" : ""}`} style={{ marginTop: 8 }}>
              {plan.output_fields.map((field) => (
                <div className={`card${isUserView ? " user-output-field-card" : ""}`} key={field.name}>
                  <strong>{field.name}</strong>
                  <div className="muted">{field.description}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <strong>{notesLabel}</strong>
            <div className={`list${isUserView ? " user-note-list" : ""}`} style={{ marginTop: 8 }}>
              {plan.notes.map((note) => (
                <div className="card" key={note}>
                  {note}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {isUserView ? (
        <details className="user-details">
          <summary>{promptLabel}</summary>
          <div className="user-collapsible-content">
            <pre className="code-block">{plan.prompt_template}</pre>
          </div>
        </details>
      ) : (
        <div className="card stack">
          <strong>{promptLabel}</strong>
          <pre className="code-block">{plan.prompt_template}</pre>
        </div>
      )}
    </div>
  );
}
