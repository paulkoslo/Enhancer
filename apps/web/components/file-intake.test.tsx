import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { FileIntake } from "@/components/file-intake";
import { ViewModeProvider } from "@/components/view-mode";

const apiMocks = vi.hoisted(() => ({
  createRun: vi.fn(),
  uploadFile: vi.fn(),
}));

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/api", () => ({
  createRun: apiMocks.createRun,
  uploadFile: apiMocks.uploadFile,
}));

describe("FileIntake", () => {
  beforeEach(() => {
    pushMock.mockReset();
    apiMocks.createRun.mockReset();
    apiMocks.uploadFile.mockReset();
  });

  it("creates a run from the German user view flow", async () => {
    apiMocks.uploadFile.mockResolvedValue({
      id: "file-1",
      original_name: "companies.csv",
      media_type: "text/csv",
      size_bytes: 1200,
      created_at: "2026-03-06T10:00:00.000Z",
      sheets: [
        {
          id: "sheet-1",
          sheet_name: "Companies",
          row_count: 24,
          column_count: 3,
          columns: ["Company", "Country", "Website"],
          preview: [{ Company: "Acme", Country: "DE", Website: "" }],
          profile: {},
        },
      ],
    });
    apiMocks.createRun.mockResolvedValue({ id: "run-1" });

    render(
      <ViewModeProvider initialMode="user">
        <FileIntake />
      </ViewModeProvider>,
    );

    const file = new File(["company"], "companies.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/Datei auswählen/i), {
      target: { files: [file] },
    });

    expect(await screen.findByText("companies.csv")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Was soll der Lauf erledigen/i), {
      target: { value: "Bitte Firmenwebseiten recherchieren." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Lauf starten/i }));

    await waitFor(() => {
      expect(apiMocks.createRun).toHaveBeenCalledWith({
        file_id: "file-1",
        task: "Bitte Firmenwebseiten recherchieren.",
        sheet_name: "Companies",
        requested_model_profile: "best-quality",
        advanced_mode: false,
      });
    });
    expect(pushMock).toHaveBeenCalledWith("/runs/run-1");
  });
});
