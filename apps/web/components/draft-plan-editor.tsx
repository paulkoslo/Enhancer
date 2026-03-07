"use client";

import { useEffect, useState } from "react";

import type { DraftPlanControls } from "@/lib/api";

type DraftPlanEditorProps = {
  controls?: DraftPlanControls | null;
  onSubmit: (payload: {
    sheet_name: string;
    enabled_output_fields: string[];
    model_profile: string;
    model_id?: string | null;
  }) => void;
  pending?: boolean;
};

export function DraftPlanEditor({ controls, onSubmit, pending = false }: DraftPlanEditorProps) {
  const [sheetName, setSheetName] = useState("");
  const [enabledOutputFields, setEnabledOutputFields] = useState<string[]>([]);
  const [modelProfile, setModelProfile] = useState("");

  useEffect(() => {
    if (!controls) {
      return;
    }
    setSheetName(controls.selected_sheet);
    setEnabledOutputFields(controls.enabled_output_fields);
    setModelProfile(controls.model_profile);
  }, [controls]);

  if (!controls) {
    return null;
  }

  const toggleField = (fieldName: string) => {
    setEnabledOutputFields((current) =>
      current.includes(fieldName) ? current.filter((name) => name !== fieldName) : [...current, fieldName],
    );
  };

  return (
    <div className="card stack">
      <strong>Draft Plan Controls</strong>
      <div className="form-grid compact">
        <div className="field">
          <label htmlFor="draft-sheet">Sheet</label>
          <select id="draft-sheet" value={sheetName} onChange={(event) => setSheetName(event.target.value)}>
            {controls.available_sheets.map((sheet) => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="draft-model-profile">Model Profile</label>
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
        <label>Output Fields</label>
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
            })
          }
          type="button"
        >
          Update Draft Plan
        </button>
      </div>
    </div>
  );
}
