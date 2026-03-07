import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { DraftPlanEditor } from "@/components/draft-plan-editor";

describe("DraftPlanEditor", () => {
  it("renders output field names and descriptions", () => {
    const onSubmit = vi.fn();

    render(
      <DraftPlanEditor
        controls={{
          available_sheets: ["Companies"],
          available_output_fields: [
            {
              name: "Website",
              description: "Official company website URL.",
              required: true,
              field_type: "string",
            },
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
          enabled_output_fields: ["Website"],
          model_profile: "best-quality",
          model_id: null,
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("Official company website URL.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Update Draft Plan/i }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
