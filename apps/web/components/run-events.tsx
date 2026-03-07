"use client";

import { useEffect, useMemo, useState } from "react";

import { eventsUrl } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";

type RunEvent = {
  type: string;
  message: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export function RunEvents({
  runId,
  initialEvents,
}: {
  runId: string;
  initialEvents: Array<{ type: string; message: string; payload: Record<string, unknown>; created_at: string }>;
}) {
  const [events, setEvents] = useState<RunEvent[]>(initialEvents);

  useEffect(() => {
    const source = new EventSource(eventsUrl(runId));
    source.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as RunEvent;
      setEvents((current) => [...current.slice(-39), parsed]);
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [runId]);

  const ordered = useMemo(() => [...events].reverse(), [events]);

  return (
    <div className="list event-feed">
      {ordered.length ? (
        ordered.map((event, index) => (
          <div className="card event-card" key={`${event.created_at}-${index}`}>
            <div className="event-meta">
              <div className="status-chip">{event.type}</div>
              {typeof event.payload.agent === "string" ? <div className="status-chip subtle">{event.payload.agent}</div> : null}
              {typeof event.payload.row_index === "number" ? (
                <div className="status-chip subtle">row {String(event.payload.row_index)}</div>
              ) : null}
            </div>
            <div className="event-message">{event.message}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {formatTimestamp(event.created_at)}
            </div>
          </div>
        ))
      ) : (
        <div className="card muted">No events streamed yet.</div>
      )}
    </div>
  );
}
