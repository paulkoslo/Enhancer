import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { RunWorkspace } from "@/components/run-workspace";

const apiMocks = vi.hoisted(() => ({
  addRunMessage: vi.fn(),
  approveDryRun: vi.fn(),
  approvePlan: vi.fn(),
  applyRunAction: vi.fn(),
  executeRun: vi.fn(),
  getRun: vi.fn(),
  startDryRun: vi.fn(),
  updateDraftPlan: vi.fn(),
  downloadRunUrl: vi.fn(() => "/api/runs/run-1/download"),
  downloadDryRunUrl: vi.fn(() => "/api/runs/run-1/dry-run/download"),
}));

vi.mock("@/lib/api", () => ({
  addRunMessage: apiMocks.addRunMessage,
  approveDryRun: apiMocks.approveDryRun,
  approvePlan: apiMocks.approvePlan,
  applyRunAction: apiMocks.applyRunAction,
  executeRun: apiMocks.executeRun,
  getRun: apiMocks.getRun,
  startDryRun: apiMocks.startDryRun,
  updateDraftPlan: apiMocks.updateDraftPlan,
  downloadRunUrl: apiMocks.downloadRunUrl,
  downloadDryRunUrl: apiMocks.downloadDryRunUrl,
}));

vi.mock("@/components/run-events", () => ({
  RunEvents: () => <div>events</div>,
}));

function renderWorkspace(initialRun: Parameters<typeof RunWorkspace>[0]["initialRun"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RunWorkspace initialRun={initialRun} />
    </QueryClientProvider>,
  );
}

describe("RunWorkspace", () => {
  it("shows a dry-run download link and patches draft plan controls", async () => {
    const initialRun = {
      id: "run-1",
      file_id: "file-1",
      status: "awaiting_plan_approval",
      execution_mode: "declarative" as const,
      selected_sheet: "Companies",
      task: "Research company website, company size, industry, and a short summary.",
      selected_model_profile: "best-quality",
      selected_model_id: null,
      requires_research: true,
      is_advanced_mode: false,
      created_at: "2026-03-06T10:00:00.000Z",
      updated_at: "2026-03-06T10:00:00.000Z",
      messages: [],
      draft_plan: {
        execution_mode: "declarative" as const,
        sheet_name: "Companies",
        task: "Research companies",
        input_columns: ["Company Name"],
        output_fields: [
          { name: "Website", description: "Official website", required: true, field_type: "string" },
          { name: "Company Size", description: "Approximate size", required: true, field_type: "string" },
          { name: "Industry", description: "Industry", required: true, field_type: "string" },
          { name: "Summary", description: "Summary", required: true, field_type: "string" },
        ],
        prompt_template: "Prompt",
        stricter_prompt_template: "Strict prompt",
        model_profile: "best-quality",
        model_id: null,
        sample_row_indices: [0, 1],
        research_policy: {},
        retry_policy: {},
        budget_policy: {},
        export_policy: {},
        notes: ["Research is required"],
      },
      approved_plan: null,
      draft_controls: {
        available_sheets: ["Companies"],
        available_output_fields: [
          { name: "Website", description: "Official website", required: true, field_type: "string" },
          { name: "Company Size", description: "Approximate size", required: true, field_type: "string" },
          { name: "Industry", description: "Industry", required: true, field_type: "string" },
          { name: "Summary", description: "Summary", required: true, field_type: "string" },
        ],
        available_model_profiles: [
          {
            profile_id: "best-quality",
            provider: "openrouter",
            model_id: "openai/gpt-5.4",
            display_name: "Best Quality",
            supports_web_research: true,
            supports_structured_output: true,
            cost_tier: "premium",
            latency_tier: "medium",
            recommended_concurrency: 2,
          },
        ],
        selected_sheet: "Companies",
        enabled_output_fields: ["Website", "Company Size", "Industry", "Summary"],
        model_profile: "best-quality",
        model_id: null,
      },
      row_results: [],
      artifacts: [
        {
          id: "artifact-dry-run",
          kind: "dry_run_results",
          content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          metadata: {},
          created_at: "2026-03-06T10:00:00.000Z",
        },
      ],
      latest_events: [],
    };

    apiMocks.getRun.mockResolvedValue(initialRun);
    apiMocks.updateDraftPlan.mockResolvedValue({
      ...initialRun,
      draft_plan: {
        ...initialRun.draft_plan,
        output_fields: initialRun.draft_plan.output_fields.filter((field) => field.name !== "Company Size"),
      },
    });

    renderWorkspace(initialRun);

    expect(screen.getByRole("link", { name: /Download Dry Run/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Company Size/i));
    fireEvent.click(screen.getByRole("button", { name: /Update Draft Plan/i }));

    await waitFor(() => {
      expect(apiMocks.updateDraftPlan).toHaveBeenCalledWith("run-1", expect.objectContaining({
        enabled_output_fields: ["Website", "Industry", "Summary"],
      }));
    });
  });
});
