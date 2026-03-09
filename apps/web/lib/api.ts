export type FileSheet = {
  id: string;
  sheet_name: string;
  row_count: number;
  column_count: number;
  columns: string[];
  preview: Record<string, unknown>[];
  profile: Record<string, unknown>;
};

export type FileRecord = {
  id: string;
  original_name: string;
  media_type: string;
  size_bytes: number;
  created_at: string;
  sheets: FileSheet[];
};

export type OutputField = {
  name: string;
  description: string;
  required: boolean;
  field_type: string;
};

export type RunPlan = {
  execution_mode: "declarative" | "script";
  sheet_name: string;
  task: string;
  input_columns: string[];
  output_fields: OutputField[];
  prompt_template: string;
  stricter_prompt_template: string;
  model_profile: string;
  model_id?: string | null;
  sample_row_indices: number[];
  research_policy: Record<string, unknown>;
  retry_policy: Record<string, unknown>;
  budget_policy: Record<string, unknown>;
  export_policy: Record<string, unknown>;
  notes: string[];
};

export type ModelProfile = {
  profile_id: string;
  provider: string;
  model_id: string;
  display_name: string;
  supports_web_research: boolean;
  supports_structured_output: boolean;
  cost_tier: string;
  latency_tier: string;
  recommended_concurrency: number;
};

export type RunMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export type RowResult = {
  row_index: number;
  row_key: string;
  status: string;
  output_json: Record<string, unknown>;
  warnings: string[];
  retry_count: number;
  validation_state: string;
  confidence: number;
  evidence_refs: string[];
};

export type Artifact = {
  id: string;
  kind: string;
  content_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RunEvent = {
  id?: string;
  type: string;
  message: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type DraftPlanControls = {
  available_sheets: string[];
  available_output_fields: OutputField[];
  available_model_profiles: ModelProfile[];
  selected_sheet: string;
  enabled_output_fields: string[];
  model_profile: string;
  model_id?: string | null;
};

export type RunRecord = {
  id: string;
  file_id: string;
  status: string;
  execution_mode: "declarative" | "script";
  selected_sheet: string;
  task: string;
  selected_model_profile: string;
  selected_model_id?: string | null;
  requires_research: boolean;
  is_advanced_mode: boolean;
  created_at: string;
  updated_at: string;
  messages: RunMessage[];
  draft_plan?: RunPlan | null;
  approved_plan?: RunPlan | null;
  draft_controls?: DraftPlanControls | null;
  row_results: RowResult[];
  artifacts: Artifact[];
  latest_events: RunEvent[];
};

export type SettingsResponse = {
  has_api_key: boolean;
  configured: boolean;
  api_key_preview?: string | null;
  api_key_updated_at?: string | null;
  default_model_profile: string;
  default_model_id?: string | null;
  available_profiles: ModelProfile[];
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return (await response.json()) as T;
}

export async function uploadFile(file: File): Promise<FileRecord> {
  const formData = new FormData();
  formData.append("upload", file);
  return request<FileRecord>("/files", {
    method: "POST",
    body: formData,
  });
}

export async function getSettings(): Promise<SettingsResponse> {
  return request<SettingsResponse>("/settings/openrouter");
}

export async function updateSettings(payload: {
  api_key?: string;
  default_model_profile: string;
  default_model_id?: string | null;
}): Promise<SettingsResponse> {
  return request<SettingsResponse>("/settings/openrouter", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export async function deleteSettingsApiKey(): Promise<SettingsResponse> {
  return request<SettingsResponse>("/settings/openrouter", {
    method: "DELETE",
  });
}

export async function createRun(payload: {
  file_id: string;
  task: string;
  sheet_name: string;
  requested_model_profile?: string;
  advanced_mode?: boolean;
}): Promise<RunRecord> {
  return request<RunRecord>("/runs", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export async function getRun(runId: string): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${runId}`);
}

export async function addRunMessage(runId: string, content: string): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${runId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function updateDraftPlan(
  runId: string,
  payload: {
    sheet_name?: string;
    enabled_output_fields?: string[];
    model_profile?: string;
    model_id?: string | null;
    prompt_template?: string | null;
    stricter_prompt_template?: string | null;
  },
): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${runId}/plan/draft`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export async function approvePlan(runId: string): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${runId}/plan/approve`, { method: "POST" });
}

export async function startDryRun(runId: string): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${runId}/dry-run`, { method: "POST" });
}

export async function approveDryRun(runId: string): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${runId}/dry-run/approve`, { method: "POST" });
}

export async function executeRun(runId: string): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${runId}/execute`, { method: "POST" });
}

export async function applyRunAction(
  runId: string,
  action: "pause" | "cancel" | "retry-failed",
): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${runId}/actions/${action}`, { method: "POST" });
}

export function downloadRunUrl(runId: string): string {
  return `${baseUrl}/runs/${runId}/download`;
}

export function downloadDryRunUrl(runId: string): string {
  return `${baseUrl}/runs/${runId}/dry-run/download`;
}

export function eventsUrl(runId: string): string {
  return `${baseUrl}/runs/${runId}/events`;
}
