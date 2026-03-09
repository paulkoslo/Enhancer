"use client";

import { useEffect, useState } from "react";

import type { DraftPlanControls } from "@/lib/api";

type DraftPlanEditorProps = {
  controls?: DraftPlanControls | null;
  promptTemplate?: string;
  stricterPromptTemplate?: string;
  onSubmit: (payload: {
    sheet_name: string;
    enabled_output_fields: string[];
    model_profile: string;
    model_id?: string | null;
    prompt_template?: string | null;
    stricter_prompt_template?: string | null;
  }) => void;
  pending?: boolean;
  variant?: "developer" | "user";
};

export function DraftPlanEditor({
  controls,
  promptTemplate,
  stricterPromptTemplate,
  onSubmit,
  pending = false,
  variant = "developer",
}: DraftPlanEditorProps) {
  const [sheetName, setSheetName] = useState("");
  const [enabledOutputFields, setEnabledOutputFields] = useState<string[]>([]);
  const [modelProfile, setModelProfile] = useState("");
  const [editablePromptTemplate, setEditablePromptTemplate] = useState("");
  const [editableStricterPromptTemplate, setEditableStricterPromptTemplate] = useState("");

  useEffect(() => {
    if (!controls) {
      return;
    }
    setSheetName(controls.selected_sheet);
    setEnabledOutputFields(controls.enabled_output_fields);
    setModelProfile(controls.model_profile);
    setEditablePromptTemplate(promptTemplate ?? "");
    setEditableStricterPromptTemplate(stricterPromptTemplate ?? "");
  }, [controls, promptTemplate, stricterPromptTemplate]);

  if (!controls) {
    return null;
  }

  const isUserView = variant === "user";
  const title = isUserView ? "Lauf anpassen" : "Draft Plan Controls";
  const sheetLabel = isUserView ? "Blatt" : "Sheet";
  const profileLabel = isUserView ? "Qualitätsprofil" : "Model Profile";
  const outputFieldsLabel = isUserView ? "Gewünschte Ausgabefelder" : "Output Fields";
  const promptLabel = isUserView ? "Anweisung" : "Prompt Template";
  const strictPromptLabel = isUserView ? "Strengere Anweisung" : "Strict Prompt";
  const submitLabel = isUserView ? "Änderungen übernehmen" : "Update Draft Plan";

  const toggleField = (fieldName: string) => {
    setEnabledOutputFields((current) =>
      current.includes(fieldName) ? current.filter((name) => name !== fieldName) : [...current, fieldName],
    );
  };

  return (
    <div className="card stack">
      <strong>{title}</strong>
      <div className="form-grid compact">
        <div className="field">
          <label htmlFor="draft-sheet">{sheetLabel}</label>
          <select id="draft-sheet" value={sheetName} onChange={(event) => setSheetName(event.target.value)}>
            {controls.available_sheets.map((sheet) => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="draft-model-profile">{profileLabel}</label>
          <select
            id="draft-model-profile"
            value={modelProfile}
            onChange={(event) => setModelProfile(event.target.value)}
          >
            {controls.available_model_profiles.map((profile) => (
              <option key={profile.profile_id} value={profile.profile_id}>
                {profile.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{outputFieldsLabel}</label>
        <div className="checkbox-grid">
          {controls.available_output_fields.map((field) => {
            const checked = enabledOutputFields.includes(field.name);
            const inputId = `draft-output-${field.name.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <div className={`checkbox-card${checked ? " selected" : ""}`} key={field.name}>
                <label className="checkbox-row" htmlFor={inputId}>
                  <input
                    checked={checked}
                    id={inputId}
                    onChange={() => toggleField(field.name)}
                    type="checkbox"
                  />
                  <div className="checkbox-copy">
                    <div className="checkbox-title">{field.name}</div>
                    <div className="checkbox-description muted">{field.description}</div>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>
      {isUserView ? (
        <details className="user-details">
          <summary>Erweiterte Texte bearbeiten</summary>
          <div className="form-grid user-collapsible-content">
            <div className="field">
              <label htmlFor="draft-prompt-template">{promptLabel}</label>
              <textarea
                id="draft-prompt-template"
                value={editablePromptTemplate}
                onChange={(event) => setEditablePromptTemplate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="draft-stricter-prompt-template">{strictPromptLabel}</label>
              <textarea
                id="draft-stricter-prompt-template"
                value={editableStricterPromptTemplate}
                onChange={(event) => setEditableStricterPromptTemplate(event.target.value)}
              />
            </div>
          </div>
        </details>
      ) : (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="draft-prompt-template">{promptLabel}</label>
            <textarea
              id="draft-prompt-template"
              value={editablePromptTemplate}
              onChange={(event) => setEditablePromptTemplate(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="draft-stricter-prompt-template">{strictPromptLabel}</label>
            <textarea
              id="draft-stricter-prompt-template"
              value={editableStricterPromptTemplate}
              onChange={(event) => setEditableStricterPromptTemplate(event.target.value)}
            />
          </div>
        </div>
      )}
      <div className="button-row">
        <button
          className="secondary"
          disabled={pending}
          onClick={() =>
            onSubmit({
              sheet_name: sheetName,
              enabled_output_fields: enabledOutputFields,
              model_profile: modelProfile,
              model_id: controls.model_id,
              prompt_template: editablePromptTemplate,
              stricter_prompt_template: editableStricterPromptTemplate,
            })
          }
          type="button"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
