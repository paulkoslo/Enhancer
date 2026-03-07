import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";

import { GlobalAgentMap } from "@/components/global-agent-map";

describe("GlobalAgentMap", () => {
  it("renders a global floating trigger and opens the architecture modal", () => {
    render(<GlobalAgentMap />);

    fireEvent.click(screen.getByRole("button", { name: /Agent Map/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/This is the app-wide architecture view/i)).toBeInTheDocument();
    expect(screen.getByText(/Web Research via OpenRouter/i)).toBeInTheDocument();
  });
});
