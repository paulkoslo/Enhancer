"use client";

import { useState } from "react";

import { AgentFlowModal } from "@/components/agent-flow-modal";

export function GlobalAgentMap() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Agent Map"
        className="floating-agent-trigger primary"
        onClick={() => setOpen(true)}
        type="button"
      >
        Agent Map
      </button>
      <AgentFlowModal onClose={() => setOpen(false)} open={open} />
    </>
  );
}
