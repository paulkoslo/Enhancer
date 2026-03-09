"use client";

import { useEffect, useRef, useState } from "react";

import { useViewMode } from "@/components/view-mode";

export function ViewMenu() {
  const { mode, setMode } = useViewMode();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="view-menu" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="secondary view-menu-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        View
        <span className="status-chip subtle">{mode === "user" ? "User" : "Developer"}</span>
      </button>
      {open ? (
        <div className="view-menu-popover card" role="menu">
          <div className="stack-tight">
            <strong>Ansicht</strong>
            <div className="muted">Die Auswahl gilt app-weit, bis Sie sie wieder aendern.</div>
          </div>
          <button
            className={`view-menu-option${mode === "user" ? " active" : ""}`}
            onClick={() => {
              setMode("user");
              setOpen(false);
            }}
            role="menuitemradio"
            type="button"
          >
            <span>User View</span>
            <span className="muted">Deutsch, reduziert, schrittweise</span>
          </button>
          <button
            className={`view-menu-option${mode === "developer" ? " active" : ""}`}
            onClick={() => {
              setMode("developer");
              setOpen(false);
            }}
            role="menuitemradio"
            type="button"
          >
            <span>Developer View</span>
            <span className="muted">Bestehende Expertenoberflaeche</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
