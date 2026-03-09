"use client";

import { SettingsForm } from "@/components/settings-form";
import { useViewMode } from "@/components/view-mode";

export function SettingsPageShell() {
  const { mode } = useViewMode();

  if (mode === "developer") {
    return (
      <main className="shell">
        <header className="hero">
          <div className="eyebrow">Workspace Settings</div>
          <h1 className="title">Control model access and defaults.</h1>
          <p className="subtitle">
            The backend routes model traffic through OpenRouter, but the default profile and workspace key are managed
            here.
          </p>
        </header>
        <SettingsForm />
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero user-hero">
        <div className="eyebrow">User View</div>
        <h1 className="title">Zugang verbinden und Standardqualitaet festlegen.</h1>
        <p className="subtitle">
          Hinterlegen Sie Ihren API-Zugang und waehlen Sie die Standardqualitaet fuer neue Laeufe. Die Entwickleransicht
          bleibt unveraendert erhalten.
        </p>
      </header>
      <SettingsForm />
    </main>
  );
}
