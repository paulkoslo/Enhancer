"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useViewMode } from "@/components/view-mode";
import { deleteSettingsApiKey, getSettings, updateSettings } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";

export function SettingsForm() {
  const queryClient = useQueryClient();
  const { mode } = useViewMode();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  const [apiKey, setApiKey] = useState("");
  const [modelProfile, setModelProfile] = useState("best-quality");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.default_model_profile) {
      setModelProfile(data.default_model_profile);
    }
  }, [data?.default_model_profile]);

  const mutation = useMutation({
    mutationFn: () =>
      updateSettings({
        api_key: apiKey || undefined,
        default_model_profile: modelProfile,
      }),
    onSuccess: (response) => {
      setApiKey("");
      setModelProfile(response.default_model_profile);
      setStatusMessage(mode === "user" ? "Einstellungen gespeichert." : "Settings saved.");
      queryClient.setQueryData(["settings"], response);
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : mode === "user" ? "Speichern fehlgeschlagen." : "Saving settings failed.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSettingsApiKey,
    onSuccess: (response) => {
      setStatusMessage(mode === "user" ? "API-Schlüssel gelöscht." : "Workspace API key deleted.");
      queryClient.setQueryData(["settings"], response);
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : mode === "user" ? "Löschen fehlgeschlagen." : "Deleting the API key failed.");
    },
  });

  if (mode === "user") {
    return (
      <section className="panel stack user-panel">
        <div className="user-summary-grid">
          <div className="card stack-tight">
            <strong>Verbindung</strong>
            <div className="muted">{data?.configured ? "Bereit" : "Noch nicht verbunden"}</div>
          </div>
          <div className="card stack-tight">
            <strong>Profil</strong>
            <div className="muted">
              {data?.available_profiles.find((profile) => profile.profile_id === modelProfile)?.display_name ?? "Noch nicht gewählt"}
            </div>
          </div>
          <div className="card stack-tight">
            <strong>Letzte Änderung</strong>
            <div className="muted">{data?.api_key_updated_at ? formatTimestamp(data.api_key_updated_at) : "Noch keine"}</div>
          </div>
        </div>

        <div className="card stack">
          <div className="stack-tight">
            <strong>Zugang hinterlegen</strong>
            <div className="muted">
              Der API-Schlüssel wird für neue Rechercheläufe verwendet. Vorhandene Schlüssel werden maskiert angezeigt.
            </div>
          </div>
          <div className="field">
            <label htmlFor="api-key">API-Schlüssel</label>
            <input
              id="api-key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={data?.configured ? "Neuen Schlüssel einsetzen" : "sk-or-v1-..."}
            />
          </div>
          <div className="muted">Aktuell gespeichert: {data?.api_key_preview ?? "nicht konfiguriert"}</div>
          <div className="field">
            <label htmlFor="model-profile">Standard-Qualität</label>
            <select
              id="model-profile"
              value={modelProfile}
              onChange={(event) => setModelProfile(event.target.value)}
            >
              {(data?.available_profiles ?? []).map((profile) => (
                <option key={profile.profile_id} value={profile.profile_id}>
                  {profile.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row">
            <button className="primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Einstellungen speichern
            </button>
            <button
              className="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={!data?.configured || deleteMutation.isPending}
            >
              API-Schlüssel löschen
            </button>
            <a className="secondary" href="/">
              Zurück
            </a>
          </div>
          {statusMessage ? <div className="card muted">{statusMessage}</div> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="panel stack">
      <div>
        <h2 className="panel-title">OpenRouter Settings</h2>
        <p className="panel-subtitle">
          Store the workspace API key and choose the default model profile for research-first runs.
        </p>
      </div>
      <div className="card stack">
        <div className="stack-tight">
          <div className="muted">Configured: {data?.configured ? "yes" : "no"}</div>
          <div className="muted">Stored key: {data?.api_key_preview ?? "not configured"}</div>
          {data?.api_key_updated_at ? (
            <div className="muted">Updated: {formatTimestamp(data.api_key_updated_at)}</div>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="api-key">Workspace API Key</label>
          <input
            id="api-key"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={data?.configured ? "Paste a replacement key" : "sk-or-v1-..."}
          />
        </div>
        <div className="field">
          <label htmlFor="model-profile">Default Model Profile</label>
          <select
            id="model-profile"
            value={modelProfile}
            onChange={(event) => setModelProfile(event.target.value)}
          >
            {(data?.available_profiles ?? []).map((profile) => (
              <option key={profile.profile_id} value={profile.profile_id}>
                {profile.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className="button-row">
          <button className="primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Save Settings
          </button>
          <button
            className="ghost"
            onClick={() => deleteMutation.mutate()}
            disabled={!data?.configured || deleteMutation.isPending}
          >
            Delete API Key
          </button>
          <a className="secondary" href="/">
            Back To Intake
          </a>
        </div>
        {statusMessage ? <div className="card muted">{statusMessage}</div> : null}
      </div>
    </section>
  );
}
