import type { RunRecord } from "@/lib/api";

export type UserRunStep = {
  key: string;
  title: string;
  description: string;
  state: "complete" | "current" | "upcoming";
};

export type UserPrimaryAction =
  | {
      key: "approve-and-dry-run";
      label: string;
      description: string;
      disabled?: boolean;
    }
  | {
      key: "approve-dry-run";
      label: string;
      description: string;
      disabled?: boolean;
    }
  | {
      key: "execute";
      label: string;
      description: string;
      disabled?: boolean;
    }
  | {
      key: "download";
      label: string;
      description: string;
      disabled?: boolean;
    }
  | {
      key: "none";
      label: string;
      description: string;
      disabled: true;
    };

const STEP_DEFINITIONS = [
  {
    key: "setup",
    title: "Plan bestätigen",
    description: "Der Lauf ist vorbereitet. Prüfen Sie kurz Aufgabe und Felder.",
    statuses: ["planning", "awaiting_plan_approval"],
  },
  {
    key: "dry-run",
    title: "Testlauf prüfen",
    description: "Ein kleiner Test prüft das Ergebnis, bevor alle Zeilen bearbeitet werden.",
    statuses: ["dry_run_preparing", "dry_run_running", "dry_run_review"],
  },
  {
    key: "full-run",
    title: "Gesamten Lauf ausführen",
    description: "Nach dem Testlauf startet die vollständige Verarbeitung im Hintergrund.",
    statuses: ["awaiting_final_approval", "full_run_queued", "full_run_running", "recovering_failed_rows", "exporting", "paused"],
  },
  {
    key: "done",
    title: "Ergebnis herunterladen",
    description: "Der fertige Export steht als Datei bereit.",
    statuses: ["completed"],
  },
];

export function getUserRunSteps(status: string): UserRunStep[] {
  const currentIndex = Math.max(
    STEP_DEFINITIONS.findIndex((step) => step.statuses.includes(status)),
    0,
  );

  return STEP_DEFINITIONS.map((step, index) => ({
    key: step.key,
    title: step.title,
    description: step.description,
    state: index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming",
  }));
}

export function getUserRunHeadline(run: RunRecord, hasOutputArtifact: boolean) {
  if (run.status === "failed") {
    return {
      title: "Der Lauf benötigt Aufmerksamkeit.",
      description: "Mindestens ein Schritt ist fehlgeschlagen. Prüfen Sie die Hinweise oder versuchen Sie problematische Zeilen erneut.",
      tone: "danger" as const,
    };
  }
  if (run.status === "cancelled") {
    return {
      title: "Der Lauf wurde gestoppt.",
      description: "Es wurden keine weiteren Schritte ausgeführt. Vorhandene Teilergebnisse bleiben sichtbar.",
      tone: "danger" as const,
    };
  }
  if (run.status === "paused") {
    return {
      title: "Der Lauf ist pausiert.",
      description: "Sie können problematische Zeilen erneut versuchen oder den Lauf im Entwickler-Modus weiter untersuchen.",
      tone: "warning" as const,
    };
  }
  if (run.status === "completed" && hasOutputArtifact) {
    return {
      title: "Das Ergebnis ist bereit.",
      description: "Der Export wurde erstellt und kann jetzt heruntergeladen werden.",
      tone: "success" as const,
    };
  }
  const current = STEP_DEFINITIONS.find((step) => step.statuses.includes(run.status)) ?? STEP_DEFINITIONS[0];
  return {
    title: current.title,
    description: current.description,
    tone: "active" as const,
  };
}

export function getUserPrimaryAction({
  run,
  hasOutputArtifact,
}: {
  run: RunRecord;
  hasOutputArtifact: boolean;
}): UserPrimaryAction {
  switch (run.status) {
    case "awaiting_plan_approval":
      return {
        key: "approve-and-dry-run",
        label: "Plan freigeben und Testlauf starten",
        description: "Bestätigt den aktuellen Plan und startet direkt den Testlauf.",
      };
    case "dry_run_review":
      return {
        key: "approve-dry-run",
        label: "Testlauf freigeben",
        description: "Der Testlauf sieht gut aus und der komplette Lauf darf starten.",
      };
    case "awaiting_final_approval":
      return {
        key: "execute",
        label: "Kompletten Lauf starten",
        description: "Alle Zeilen werden nun im Hintergrund verarbeitet.",
      };
    case "completed":
      return {
        key: "download",
        label: "Ergebnis herunterladen",
        description: "Lädt die fertig bearbeitete Datei herunter.",
        disabled: !hasOutputArtifact,
      };
    case "dry_run_preparing":
    case "dry_run_running":
    case "full_run_queued":
    case "full_run_running":
    case "recovering_failed_rows":
    case "exporting":
      return {
        key: "none",
        label: "Verarbeitung läuft",
        description: "Sobald der aktuelle Schritt fertig ist, erscheint hier automatisch die nächste Aktion.",
        disabled: true,
      };
    default:
      return {
        key: "none",
        label: "Aktuell keine Hauptaktion",
        description: "Nutzen Sie bei Bedarf die weiteren Aktionen oder wechseln Sie in die Entwickleransicht.",
        disabled: true,
      };
  }
}

export function formatUserStatus(status: string): string {
  const statusMap: Record<string, string> = {
    planning: "Plan wird erstellt",
    awaiting_plan_approval: "Wartet auf Planfreigabe",
    dry_run_preparing: "Testlauf wird vorbereitet",
    dry_run_running: "Testlauf läuft",
    dry_run_review: "Testlauf wartet auf Freigabe",
    awaiting_final_approval: "Bereit für den kompletten Lauf",
    full_run_queued: "Kompletter Lauf ist eingeplant",
    full_run_running: "Kompletter Lauf läuft",
    recovering_failed_rows: "Problematische Zeilen werden erneut versucht",
    exporting: "Datei wird exportiert",
    completed: "Abgeschlossen",
    failed: "Fehlgeschlagen",
    paused: "Pausiert",
    cancelled: "Abgebrochen",
  };
  return statusMap[status] ?? status;
}

export function formatUserMessageRole(role: string): string {
  if (role === "assistant") {
    return "Assistent";
  }
  if (role === "user") {
    return "Sie";
  }
  return role;
}
