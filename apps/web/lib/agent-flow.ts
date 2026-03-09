// Canonical agent-flow definition for the in-app viewer.
// Update this file whenever the planning, execution, or event-labeled agents change.

export type FlowNode = {
  title: string;
  capability: "UI-only" | "Deterministic" | "AI-backed" | "Hybrid";
  description: string;
};

export const AGENT_FLOW_MERMAID = `flowchart TD
  UI["RunWorkspace chat UI"] --> API["POST /api/runs/:run_id/messages"]
  API --> ORCH["Orchestrator"]
  ORCH --> TP["Task Planner (fast planning model)"]
  TP --> PS["Prompt/Schema builder"]
  ORCH --> FA["File Analyst (sheet profiler)"]
  TP --> MSG["Assistant reply"]
  PS --> PLAN["PlanVersion + prompt bundle"]
  FA --> PLAN
  PLAN --> APPROVE["User approves plan"]
  APPROVE --> EXEC["Execution worker"]
  EXEC --> WR["Web Research via OpenRouter"]
  WR --> VAL["Validation rules"]
  VAL --> EXPORT["Export workbook"]
  VAL -->|retryable| REC["Recovery retry"]
  REC --> WR`;

export const PLANNING_LANE: FlowNode[] = [
  {
    title: "Chat UI",
    capability: "UI-only",
    description: "Sends task text and plan feedback to the runs API. No model call happens here.",
  },
  {
    title: "Runs API",
    capability: "Deterministic",
    description: "Stores messages and forwards feedback into the planning service.",
  },
  {
    title: "Orchestrator",
    capability: "Deterministic",
    description: "Coordinates create-run, feedback handling, approvals, and agent-step events.",
  },
  {
    title: "Task Planner",
    capability: "AI-backed",
    description: "Always uses the fast planning model profile to adapt fields, prompt templates, and plan structure.",
  },
  {
    title: "Prompt/Schema",
    capability: "AI-backed",
    description: "Comes directly from the planner output instead of a fallback prompt-concatenation path.",
  },
  {
    title: "Assistant Message",
    capability: "AI-backed",
    description: "The visible assistant reply is authored by the same fast planning model.",
  },
];

export const EXECUTION_LANE: FlowNode[] = [
  {
    title: "Execution Worker",
    capability: "Deterministic",
    description: "Starts dry runs and full runs, loads rows, and fans out processing.",
  },
  {
    title: "Web Research",
    capability: "AI-backed",
    description: "Calls OpenRouter chat completions with the web plugin and a JSON schema.",
  },
  {
    title: "Validation",
    capability: "Deterministic",
    description: "Checks website quality, missing fields, citations, and confidence thresholds.",
  },
  {
    title: "Recovery",
    capability: "Hybrid",
    description: "Decides when to retry and then triggers a stricter second AI research pass.",
  },
  {
    title: "Export",
    capability: "Deterministic",
    description: "Writes dry-run workbooks and final output files from stored row results.",
  },
];
