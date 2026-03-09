import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";

import { GlobalAgentMap } from "@/components/global-agent-map";
import { ViewModeProvider } from "@/components/view-mode";

describe("GlobalAgentMap", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the technical help surface in developer view", () => {
    window.localStorage.setItem("enhancer:view-mode", "developer");
    render(
      <ViewModeProvider initialMode="developer">
        <GlobalAgentMap />
      </ViewModeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Agent Map/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/This is the app-wide architecture view/i)).toBeInTheDocument();
    expect(screen.getByText(/Web Research via OpenRouter/i)).toBeInTheDocument();
  });

  it("renders the simplified German help surface in user view", () => {
    window.localStorage.setItem("enhancer:view-mode", "user");
    render(
      <ViewModeProvider initialMode="user">
        <GlobalAgentMap />
      </ViewModeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /So funktioniert es/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Der Lauf arbeitet in klaren Schritten/i)).toBeInTheDocument();
    expect(screen.getByText(/Die User View zeigt nur das Wesentliche/i)).toBeInTheDocument();
  });
});
