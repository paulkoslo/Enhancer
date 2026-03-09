"use client";

import { useEffect, useMemo, useState } from "react";

import { eventsUrl, type RunEvent } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";

const ACTIVE_STATUSES = new Set([
  "planning",
  "dry_run_preparing",
  "dry_run_running",
  "full_run_queued",
  "full_run_running",
  "recovering_failed_rows",
  "exporting",
]);

type NormalizedEvent = {
  key: string;
  badge: string;
  title: string;
  detail: string;
  meta: string[];
  createdAt: string;
};

export function RunEvents({
  runId,
  initialEvents,
  pendingEvent,
  runStatus,
  visibleSince,
  variant = "developer",
}: {
  runId: string;
  initialEvents: RunEvent[];
  pendingEvent?: RunEvent | null;
  runStatus: string;
  visibleSince: string;
  variant?: "developer" | "user";
}) {
  const [events, setEvents] = useState<RunEvent[]>(() => initialEvents.filter((event) => isVisibleEvent(event, visibleSince)));

  useEffect(() => {
    setEvents(initialEvents.filter((event) => isVisibleEvent(event, visibleSince)));
  }, [runId, visibleSince]);

  useEffect(() => {
    setEvents((current) => mergeEvents(current, initialEvents.filter((event) => isVisibleEvent(event, visibleSince))));
  }, [initialEvents, visibleSince]);

  useEffect(() => {
    const source = new EventSource(eventsUrl(runId));
    source.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as RunEvent;
      if (!isVisibleEvent(parsed, visibleSince)) {
        return;
      }
      setEvents((current) => mergeEvents(current, [parsed]).slice(-60));
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [runId, visibleSince]);

  const normalizedEvents = useMemo(() => events.map((event) => normalizeEvent(event, variant)), [events, variant]);
  const currentActivity = useMemo(() => {
    if (pendingEvent) {
      return normalizeEvent(pendingEvent, variant);
    }
    const activeAgentEvent = findActiveAgentEvent(events);
    if (activeAgentEvent) {
      return normalizeEvent(activeAgentEvent, variant);
    }
    const activeStatusEvent = [...events]
      .reverse()
      .find((event) => ACTIVE_STATUSES.has(asString(event.payload.status) ?? ""));
    if (activeStatusEvent) {
      return normalizeEvent(activeStatusEvent, variant);
    }
    if (ACTIVE_STATUSES.has(runStatus)) {
      return normalizeEvent({
        id: "status-fallback",
        type: "status",
        message: `${formatStatus(runStatus)}.`,
        payload: {
          status: runStatus,
          task_label: formatStatus(runStatus),
        },
        created_at: new Date().toISOString(),
      }, variant);
    }
    return null;
  }, [events, pendingEvent, runStatus, variant]);
  const orderedEvents = useMemo(() => {
    const currentKey = currentActivity?.key;
    return [...normalizedEvents].reverse().filter((event) => event.key !== currentKey);
  }, [currentActivity?.key, normalizedEvents]);

  return (
    <div className="event-stream">
      <div className={`card event-current${currentActivity ? " active" : ""}`}>
        <div className="event-current-label">{variant === "user" ? "Aktueller Schritt" : "Current Activity"}</div>
        {currentActivity ? (
          <>
            <div className="event-current-head">
              <strong>{currentActivity.title}</strong>
              <span className="status-chip subtle">{currentActivity.badge}</span>
            </div>
            <div className="event-detail muted">{currentActivity.detail}</div>
            {currentActivity.meta.length ? (
              <div className="event-meta">
                {currentActivity.meta.map((item) => (
                  <span className="status-chip subtle" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="muted">{variant === "user" ? "Gerade ist kein aktiver Schritt sichtbar." : "No active step right now."}</div>
        )}
      </div>

      <div className="list event-feed">
        {orderedEvents.length ? (
          orderedEvents.map((event) => (
            <div className="card event-card compact" key={event.key}>
              <div className="event-row">
                <strong>{event.title}</strong>
                <span className="status-chip subtle">{event.badge}</span>
              </div>
              <div className="event-detail muted">{event.detail}</div>
              <div className="event-row">
                {event.meta.length ? (
                  <div className="event-meta">
                    {event.meta.map((item) => (
                      <span className="status-chip subtle" key={`${event.key}-${item}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span />
                )}
                <span className="event-time muted">{formatTimestamp(event.createdAt)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="card muted">{variant === "user" ? "Es wurden noch keine Aktivitaeten gestreamt." : "No events streamed yet."}</div>
        )}
      </div>
    </div>
  );
}

function mergeEvents(existing: RunEvent[], incoming: RunEvent[]): RunEvent[] {
  const merged = new Map<string, RunEvent>();
  for (const event of [...existing, ...incoming]) {
    merged.set(eventKey(event), event);
  }
  return [...merged.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function isVisibleEvent(event: RunEvent, visibleSince: string): boolean {
  const eventTime = Date.parse(event.created_at);
  const visibleSinceTime = Date.parse(visibleSince);
  if (Number.isNaN(eventTime) || Number.isNaN(visibleSinceTime)) {
    return event.created_at >= visibleSince;
  }
  return eventTime >= visibleSinceTime;
}

function eventKey(event: RunEvent): string {
  const rowIndex = asNumber(event.payload.row_index);
  return event.id ?? `${event.created_at}:${event.type}:${event.message}:${rowIndex ?? "na"}`;
}

function findActiveAgentEvent(events: RunEvent[]): RunEvent | null {
  const active = new Map<string, RunEvent>();
  for (const event of events) {
    if (event.type !== "agent") {
      continue;
    }
    const agent = asString(event.payload.agent);
    const action = asString(event.payload.action);
    const phase = asString(event.payload.phase);
    if (!agent || !action || !phase) {
      continue;
    }
    const rowIndex = asNumber(event.payload.row_index);
    const key = `${agent}:${action}:${rowIndex ?? "na"}`;
    if (phase === "start") {
      active.set(key, event);
      continue;
    }
    if (phase === "finish" || phase === "error") {
      active.delete(key);
    }
  }
  return [...active.values()].at(-1) ?? null;
}

function normalizeEvent(event: RunEvent, variant: "developer" | "user"): NormalizedEvent {
  const payload = asRecord(event.payload);
  const type = event.type;
  const agent = asString(payload.agent);
  const action = asString(payload.action);
  const phase = asString(payload.phase);
  const rowIndex = asNumber(payload.row_index);
  const status = asString(payload.status);
  const taskLabel = asString(payload.task_label);
  const usage = asRecord(payload.usage);
  const warnings = asArray(payload.warnings);
  const modelId = asString(payload.model_id);
  const modelProfile = asString(payload.model_profile);
  const workerCount = asNumber(payload.worker_count);

  let badge = variant === "user" ? formatTypeUser(type) : formatType(type);
  let title = taskLabel ?? event.message;
  let detail = event.message;

  if (type === "agent") {
    badge = phase === "start" ? (variant === "user" ? "Laeuft" : "Working") : phase === "finish" ? (variant === "user" ? "Fertig" : "Done") : (variant === "user" ? "Fehler" : "Error");
    title = [agent, taskLabel ?? formatAction(action)].filter(Boolean).join(" · ") || event.message;
    detail = phase === "start" ? (variant === "user" ? "Wird gerade ausgefuehrt." : "Running now.") : phase === "finish" ? (variant === "user" ? "Abgeschlossen." : "Finished.") : event.message;
  } else if (type === "row_progress") {
    badge = variant === "user" ? formatRowStatusUser(status) : formatRowStatus(status);
    title = rowIndex !== null ? (variant === "user" ? `Zeile ${rowIndex}` : `Row ${rowIndex}`) : (variant === "user" ? "Zeilen-Update" : "Row update");
    detail = warnings.length ? String(warnings[0]) : event.message;
  } else if (type === "status") {
    badge = ACTIVE_STATUSES.has(status ?? "") ? (variant === "user" ? "Laeuft" : "Working") : (variant === "user" ? "Status" : "Status");
    title = taskLabel ?? (variant === "user" ? formatStatusUser(status) : formatStatus(status)) ?? (variant === "user" ? "Status" : "Status update");
  } else if (type === "model_override") {
    badge = variant === "user" ? "Modell" : "Model";
    title = rowIndex !== null ? (variant === "user" ? `Zeile ${rowIndex} · Modellwechsel` : `Row ${rowIndex} · Model override`) : (variant === "user" ? "Modellwechsel" : "Model override");
  } else if (type === "error") {
    badge = variant === "user" ? "Fehler" : "Error";
    title = taskLabel ?? (variant === "user" ? "Lauffehler" : "Run error");
  } else if (type === "export") {
    badge = variant === "user" ? "Export" : "Export";
    title = taskLabel ?? (variant === "user" ? "Datei-Export" : "Workbook export");
  }

  const meta = variant === "user"
    ? [
        rowIndex !== null ? `Zeile ${rowIndex}` : null,
        modelProfile ? `Profil ${modelProfile}` : null,
      ].filter((item): item is string => Boolean(item))
    : [
        workerCount !== null ? `${workerCount} worker${workerCount === 1 ? "" : "s"}` : null,
        rowIndex !== null ? `row ${rowIndex}` : null,
        modelId ?? modelProfile,
        formatTokenMeta(usage, "input_tokens", "in"),
        formatTokenMeta(usage, "output_tokens", "out"),
        formatTokenMeta(usage, "total_tokens", "total"),
      ].filter((item): item is string => Boolean(item));

  return {
    key: eventKey(event),
    badge,
    title,
    detail,
    meta,
    createdAt: event.created_at,
  };
}

function formatTypeUser(type: string): string {
  const typeMap: Record<string, string> = {
    agent: "Agent",
    status: "Status",
    row_progress: "Zeile",
    error: "Fehler",
    export: "Export",
    model_override: "Modell",
  };
  return typeMap[type] ?? toTitleCase(type);
}

function formatType(type: string): string {
  return toTitleCase(type);
}

function formatAction(value: string | null): string {
  if (!value) {
    return "Step";
  }
  const actionMap: Record<string, string> = {
    create_run: "Create run",
    profile_sheet: "Profile sheet",
    draft_plan: "Draft plan",
    refine_plan: "Refine plan",
    patch_draft: "Patch draft",
    patch_draft_plan: "Patch draft plan",
    build_prompt_bundle: "Build prompt bundle",
    dry_run: "Dry run",
    full_run: "Full run",
    enrich_row: "Enrich row",
    validate_row: "Validate row",
    retry_row: "Retry row",
    retry_failed_rows: "Retry failed rows",
    final_workbook: "Final workbook",
    handle_feedback: "Handle feedback",
  };
  return actionMap[value] ?? toTitleCase(value);
}

function formatStatus(value: string | null): string {
  if (!value) {
    return "Status update";
  }
  const statusMap: Record<string, string> = {
    awaiting_plan_approval: "Awaiting plan approval",
    dry_run_preparing: "Dry run preparing",
    dry_run_running: "Dry run running",
    dry_run_review: "Dry run review",
    awaiting_final_approval: "Awaiting final approval",
    full_run_queued: "Full run queued",
    full_run_running: "Full run running",
    recovering_failed_rows: "Retrying failed rows",
    exporting: "Exporting workbook",
    completed: "Completed",
    failed: "Failed",
    paused: "Paused",
    cancelled: "Cancelled",
  };
  return statusMap[value] ?? toTitleCase(value);
}

function formatStatusUser(value: string | null): string {
  const statusMap: Record<string, string> = {
    awaiting_plan_approval: "Wartet auf Planfreigabe",
    dry_run_preparing: "Testlauf wird vorbereitet",
    dry_run_running: "Testlauf laeuft",
    dry_run_review: "Testlauf zur Freigabe bereit",
    awaiting_final_approval: "Bereit fuer den Gesamtlauf",
    full_run_queued: "Gesamtlauf eingeplant",
    full_run_running: "Gesamtlauf laeuft",
    recovering_failed_rows: "Problematische Zeilen werden erneut versucht",
    exporting: "Datei wird exportiert",
    completed: "Abgeschlossen",
    failed: "Fehlgeschlagen",
    paused: "Pausiert",
    cancelled: "Abgebrochen",
  };
  return statusMap[value ?? ""] ?? formatStatus(value);
}

function formatRowStatus(value: string | null): string {
  if (!value) {
    return "Row";
  }
  const statusMap: Record<string, string> = {
    completed: "Done",
    failed: "Failed",
    needs_review: "Review",
    running: "Working",
    pending: "Pending",
  };
  return statusMap[value] ?? toTitleCase(value);
}

function formatRowStatusUser(value: string | null): string {
  const statusMap: Record<string, string> = {
    completed: "Fertig",
    failed: "Fehlgeschlagen",
    needs_review: "Pruefen",
    running: "Laeuft",
    pending: "Wartet",
  };
  return statusMap[value ?? ""] ?? formatRowStatus(value);
}

function formatTokenMeta(usage: Record<string, unknown>, key: string, label: string): string | null {
  const value = usage[key];
  if (typeof value !== "number") {
    return null;
  }
  return `${label} ${formatTokenCount(value)}`;
}

function formatTokenCount(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(value);
}

function toTitleCase(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
