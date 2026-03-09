"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ViewMode = "user" | "developer";

type ViewModeContextValue = {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
};

const STORAGE_KEY = "enhancer:view-mode";

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({
  children,
  initialMode = "user",
}: {
  children: React.ReactNode;
  initialMode?: ViewMode;
}) {
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "user" || stored === "developer") {
      setMode(stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [hydrated, mode]);

  return <ViewModeContext.Provider value={{ mode, setMode }}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within ViewModeProvider.");
  }
  return context;
}

export function getStoredViewMode(): ViewMode | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "user" || stored === "developer" ? stored : null;
}
