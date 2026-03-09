import React from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RunEvents } from "@/components/run-events";

class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  close() {
    return undefined;
  }
}

describe("RunEvents", () => {
  const originalEventSource = global.EventSource;

  beforeEach(() => {
    global.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
  });

  it("surfaces the active step and compact debugging metadata", () => {
    render(
      <RunEvents
        runId="run-1"
        runStatus="dry_run_running"
        visibleSince="2026-03-07T00:59:59.000Z"
        initialEvents={[
          {
            id: "evt-1",
            type: "agent",
            message: "Task Planner started draft_plan.",
            created_at: "2026-03-07T01:00:00.000Z",
            payload: {
              agent: "Task Planner",
              action: "draft_plan",
              phase: "start",
              task_label: "Initial plan draft",
              model_id: "openai/gpt-5-mini",
            },
          },
          {
            id: "evt-2",
            type: "row_progress",
            message: "Processed row 4.",
            created_at: "2026-03-07T01:00:02.000Z",
            payload: {
              row_index: 4,
              status: "completed",
              model_id: "openai/gpt-5.4",
              usage: {
                input_tokens: 1200,
                output_tokens: 320,
              },
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Current Activity")).toBeInTheDocument();
    expect(screen.getByText("Task Planner · Initial plan draft")).toBeInTheDocument();
    expect(screen.getByText("openai/gpt-5-mini")).toBeInTheDocument();
    expect(screen.getByText("Row 4")).toBeInTheDocument();
    expect(screen.getByText("in 1.2k")).toBeInTheDocument();
    expect(screen.getByText("out 320")).toBeInTheDocument();
  });

  it("shows a pending local action as the current activity", () => {
    render(
      <RunEvents
        runId="run-1"
        runStatus="dry_run_preparing"
        visibleSince="2026-03-07T00:59:59.000Z"
        initialEvents={[]}
        pendingEvent={{
          id: "local-dry-run",
          type: "status",
          message: "Starting dry run.",
          created_at: "2026-03-07T01:00:00.000Z",
          payload: {
            local: true,
            status: "dry_run_preparing",
            task_label: "Dry run preparation",
            model_id: "openai/gpt-5.4",
          },
        }}
      />,
    );

    expect(screen.getByText("Dry run preparation")).toBeInTheDocument();
    expect(screen.getByText("Starting dry run.")).toBeInTheDocument();
  });
});
