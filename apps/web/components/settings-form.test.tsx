import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { SettingsForm } from "@/components/settings-form";
import { ViewModeProvider, type ViewMode } from "@/components/view-mode";

const apiMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  deleteSettingsApiKey: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getSettings: apiMocks.getSettings,
  updateSettings: apiMocks.updateSettings,
  deleteSettingsApiKey: apiMocks.deleteSettingsApiKey,
}));

function renderWithQueryClient(mode: ViewMode = "developer") {
  window.localStorage.setItem("enhancer:view-mode", mode);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ViewModeProvider initialMode={mode}>
        <SettingsForm />
      </ViewModeProvider>
    </QueryClientProvider>,
  );
}

describe("SettingsForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the masked key preview and allows deleting it", async () => {
    apiMocks.getSettings.mockResolvedValue({
      has_api_key: true,
      configured: true,
      api_key_preview: "sk-or-v1-s...1234",
      api_key_updated_at: "2026-03-06T10:00:00.000Z",
      default_model_profile: "best-quality",
      default_model_id: null,
      available_profiles: [
        {
          profile_id: "best-quality",
          provider: "openrouter",
          model_id: "openai/gpt-5.4",
          display_name: "Best Quality",
          supports_web_research: true,
          supports_structured_output: true,
          cost_tier: "premium",
          latency_tier: "medium",
          recommended_concurrency: 2,
        },
      ],
    });
    apiMocks.deleteSettingsApiKey.mockResolvedValue({
      has_api_key: false,
      configured: false,
      api_key_preview: null,
      api_key_updated_at: null,
      default_model_profile: "best-quality",
      default_model_id: null,
      available_profiles: [
        {
          profile_id: "best-quality",
          provider: "openrouter",
          model_id: "openai/gpt-5.4",
          display_name: "Best Quality",
          supports_web_research: true,
          supports_structured_output: true,
          cost_tier: "premium",
          latency_tier: "medium",
          recommended_concurrency: 2,
        },
      ],
    });

    renderWithQueryClient();

    expect(await screen.findByText(/Stored key: sk-or-v1-s\.\.\.1234/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Delete API Key/i }));

    await waitFor(() => {
      expect(apiMocks.deleteSettingsApiKey).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/Workspace API key deleted\./i)).toBeInTheDocument();
  });

  it("renders the simplified German settings in user view and saves them", async () => {
    apiMocks.getSettings.mockResolvedValue({
      has_api_key: true,
      configured: true,
      api_key_preview: "sk-or-v1-s...1234",
      api_key_updated_at: "2026-03-06T10:00:00.000Z",
      default_model_profile: "best-quality",
      default_model_id: null,
      available_profiles: [
        {
          profile_id: "best-quality",
          provider: "openrouter",
          model_id: "openai/gpt-5.4",
          display_name: "Best Quality",
          supports_web_research: true,
          supports_structured_output: true,
          cost_tier: "premium",
          latency_tier: "medium",
          recommended_concurrency: 2,
        },
      ],
    });
    apiMocks.updateSettings.mockResolvedValue({
      has_api_key: true,
      configured: true,
      api_key_preview: "sk-or-v1-s...5678",
      api_key_updated_at: "2026-03-06T11:00:00.000Z",
      default_model_profile: "best-quality",
      default_model_id: null,
      available_profiles: [
        {
          profile_id: "best-quality",
          provider: "openrouter",
          model_id: "openai/gpt-5.4",
          display_name: "Best Quality",
          supports_web_research: true,
          supports_structured_output: true,
          cost_tier: "premium",
          latency_tier: "medium",
          recommended_concurrency: 2,
        },
      ],
    });

    renderWithQueryClient("user");

    expect(await screen.findByText(/Zugang hinterlegen/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/API-Schlüssel/i), {
      target: { value: "sk-or-v1-new" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Einstellungen speichern/i }));

    await waitFor(() => {
      expect(apiMocks.updateSettings).toHaveBeenCalledWith({
        api_key: "sk-or-v1-new",
        default_model_profile: "best-quality",
      });
    });
  });
});
