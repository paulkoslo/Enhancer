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

  it("prefers the approved plan instead of rendering both snapshots", () => {
    render(
      <PlanCard
        draftPlan={{
          execution_mode: "declarative",
          sheet_name: "Draft Sheet",
          task: "Draft task",
          input_columns: ["Company"],
          output_fields: [],
          prompt_template: "Draft prompt",
          stricter_prompt_template: "Draft strict prompt",
          model_profile: "balanced",
          sample_row_indices: [0],
          research_policy: {},
          retry_policy: {},
          budget_policy: {},
          export_policy: {},
          notes: ["Draft note"],
        }}
        approvedPlan={{
          execution_mode: "declarative",
          sheet_name: "Approved Sheet",
          task: "Approved task",
          input_columns: ["Company"],
          output_fields: [],
          prompt_template: "Approved prompt",
          stricter_prompt_template: "Approved strict prompt",
          model_profile: "best-quality",
          sample_row_indices: [0],
          research_policy: {},
          retry_policy: {},
          budget_policy: {},
          export_policy: {},
          notes: ["Approved note"],
        }}
      />,
    );

    expect(screen.getByText("Approved prompt")).toBeInTheDocument();
    expect(screen.queryByText("Draft prompt")).not.toBeInTheDocument();
    expect(screen.getByText("Approved Plan")).toBeInTheDocument();
  });

  it("renders a localized user-view plan card", () => {
    render(
      <PlanCard
        variant="user"
        draftPlan={{
          execution_mode: "declarative",
          sheet_name: "Firmen",
          task: "Recherchiere Webseiten und Beschreibungen.",
          input_columns: ["Firma"],
          output_fields: [
            {
              name: "Website",
              description: "Offizielle Firmenwebseite",
              required: true,
              field_type: "string",
            },
          ],
          prompt_template: "Prompt",
          stricter_prompt_template: "Strict prompt",
          model_profile: "best-quality",
          sample_row_indices: [0],
          research_policy: {},
          retry_policy: {},
          budget_policy: {},
          export_policy: {},
          notes: ["Nur verifizierte Quellen verwenden."],
        }}
      />,
    );

    expect(screen.getByText("Plan-Entwurf")).toBeInTheDocument();
    expect(screen.getByText("Aufgabe")).toBeInTheDocument();
    expect(screen.getByText("Recherchiere Webseiten und Beschreibungen.")).toBeInTheDocument();
    expect(screen.getByText("Ausgabefelder")).toBeInTheDocument();
  });
});
