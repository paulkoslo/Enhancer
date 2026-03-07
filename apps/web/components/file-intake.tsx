"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createRun, type FileRecord, uploadFile } from "@/lib/api";

type IntakeState = {
  file?: FileRecord;
  task: string;
  sheetName: string;
  modelProfile: string;
  advancedMode: boolean;
};

const initialState: IntakeState = {
  task: "Research company website, company size, industry, and a short summary.",
  sheetName: "",
  modelProfile: "best-quality",
  advancedMode: false,
};

export function FileIntake() {
  const router = useRouter();
  const [state, setState] = useState<IntakeState>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadFile(file);
      setState((current) => ({
        ...current,
        file: uploaded,
        sheetName: uploaded.sheets[0]?.sheet_name ?? "",
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.file) {
      setError("Upload a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const run = await createRun({
        file_id: state.file.id,
        task: state.task,
        sheet_name: state.sheetName,
        requested_model_profile: state.modelProfile,
        advanced_mode: state.advancedMode,
      });
      router.push(`/runs/${run.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Run creation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid two">
      <section className="panel stack">
        <div>
          <h2 className="panel-title">Intake</h2>
          <p className="panel-subtitle">
            Upload a spreadsheet, inspect the detected sheet structure, then start a research-first run.
          </p>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="file-upload">Workbook</label>
            <input id="file-upload" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
          </div>
          {state.file ? (
            <div className="card stack">
              <div>
                <strong>{state.file.original_name}</strong>
                <div className="muted">{state.file.sheets.length} detected sheet(s)</div>
              </div>
              <div className="field">
                <label htmlFor="sheet">Target Sheet</label>
                <select
                  id="sheet"
                  value={state.sheetName}
                  onChange={(event) => setState((current) => ({ ...current, sheetName: event.target.value }))}
                >
                  {state.file.sheets.map((sheet) => (
                    <option key={sheet.id} value={sheet.sheet_name}>
                      {sheet.sheet_name} ({sheet.row_count} rows)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <form className="form-grid" onSubmit={handleCreateRun}>
            <div className="field">
              <label htmlFor="task">Task</label>
              <textarea
                id="task"
                value={state.task}
                onChange={(event) => setState((current) => ({ ...current, task: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="profile">Model Profile</label>
              <select
                id="profile"
                value={state.modelProfile}
                onChange={(event) => setState((current) => ({ ...current, modelProfile: event.target.value }))}
              >
                <option value="best-quality">Best Quality</option>
                <option value="balanced">Balanced</option>
                <option value="research-heavy">Research Heavy</option>
                <option value="coding-heavy">Coding Heavy</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="advanced">Advanced Sandbox Mode</label>
              <select
                id="advanced"
                value={state.advancedMode ? "true" : "false"}
                onChange={(event) =>
                  setState((current) => ({ ...current, advancedMode: event.target.value === "true" }))
                }
              >
                <option value="false">Off</option>
                <option value="true">On</option>
              </select>
            </div>
            <div className="button-row">
              <button className="primary" disabled={busy || !state.file}>
                {busy ? "Working..." : "Create Run"}
              </button>
              <a className="secondary" href="/settings">
                Settings
              </a>
            </div>
          </form>
          {error ? <div className="card" style={{ color: "var(--danger)" }}>{error}</div> : null}
        </div>
      </section>
      <section className="panel stack">
        <div>
          <h2 className="panel-title">Detected Preview</h2>
          <p className="panel-subtitle">
            The uploaded workbook is profiled immediately so the planner can ground itself in the actual sheet.
          </p>
        </div>
        {state.file ? (
          <>
            <div className="pill-list">
              {state.file.sheets.find((sheet) => sheet.sheet_name === state.sheetName)?.columns.map((column) => (
                <span className="pill" key={column}>
                  {column}
                </span>
              ))}
            </div>
            <div className="table-wrap bounded">
              <table className="data-table">
                <thead>
                  <tr>
                    {state.file.sheets
                      .find((sheet) => sheet.sheet_name === state.sheetName)
                      ?.columns.slice(0, 6)
                      .map((column) => <th key={column}>{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {state.file.sheets
                    .find((sheet) => sheet.sheet_name === state.sheetName)
                    ?.preview.map((row, index) => (
                      <tr key={index}>
                        {Object.entries(row)
                          .slice(0, 6)
                          .map(([key, value]) => (
                            <td key={key}>
                              <div className="cell-value" title={String(value ?? "")}>
                                {String(value ?? "") || "—"}
                              </div>
                            </td>
                          ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="card muted">Upload a workbook to inspect its detected sheet and preview rows.</div>
        )}
      </section>
    </div>
  );
}
