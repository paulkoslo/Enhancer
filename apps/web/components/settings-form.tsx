"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { deleteSettingsApiKey, getSettings, updateSettings } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";

export function SettingsForm() {
  const queryClient = useQueryClient();
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
      setStatusMessage("Settings saved.");
      queryClient.setQueryData(["settings"], response);
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : "Saving settings failed.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSettingsApiKey,
    onSuccess: (response) => {
      setStatusMessage("Workspace API key deleted.");
      queryClient.setQueryData(["settings"], response);
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : "Deleting the API key failed.");
    },
  });

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
