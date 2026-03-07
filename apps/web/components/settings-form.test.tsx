import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { SettingsForm } from "@/components/settings-form";

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

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsForm />
    </QueryClientProvider>,
  );
}

describe("SettingsForm", () => {
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
});
