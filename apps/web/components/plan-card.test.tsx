import React from "react";

import { render, screen } from "@testing-library/react";

import { PlanCard } from "@/components/plan-card";


describe("PlanCard", () => {
  it("renders output fields from the selected plan", () => {
    render(
      <PlanCard
        draftPlan={{
          execution_mode: "declarative",
          sheet_name: "Companies",
          task: "Research companies",
          input_columns: ["Company Name"],
          output_fields: [
            {
              name: "Website",
              description: "Official website",
              required: true,
              field_type: "string",
            },
          ],
          prompt_template: "Prompt",
          stricter_prompt_template: "Strict prompt",
          model_profile: "best-quality",
          sample_row_indices: [0, 1],
          research_policy: {},
          retry_policy: {},
          budget_policy: {},
          export_policy: {},
          notes: ["Research is required"],
        }}
      />,
    );

    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("Prompt")).toBeInTheDocument();
  });
});
