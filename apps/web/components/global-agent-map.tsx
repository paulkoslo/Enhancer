"use client";

import { useState } from "react";

import { AgentFlowModal } from "@/components/agent-flow-modal";
import { useViewMode } from "@/components/view-mode";

export function GlobalAgentMap() {
  const { mode } = useViewMode();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={mode === "user" ? "So funktioniert es" : "Agent Map"}
        className="floating-agent-trigger primary"
        onClick={() => setOpen(true)}
        type="button"
      >
        {mode === "user" ? "So funktioniert's" : "Agent Map"}
      </button>
      <AgentFlowModal onClose={() => setOpen(false)} open={open} />
    </>
  );
}
