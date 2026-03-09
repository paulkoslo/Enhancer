import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";

import { ViewMenu } from "@/components/view-menu";
import { ViewModeProvider, useViewMode } from "@/components/view-mode";

function ModeProbe() {
  const { mode } = useViewMode();
  return <div>mode:{mode}</div>;
}

describe("ViewMenu", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists the selected mode across renders", () => {
    const { unmount } = render(
      <ViewModeProvider initialMode="user">
        <ViewMenu />
        <ModeProbe />
      </ViewModeProvider>,
    );

    expect(screen.getByText("mode:user")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /View/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Developer View/i }));

    expect(screen.getByText("mode:developer")).toBeInTheDocument();
    expect(window.localStorage.getItem("enhancer:view-mode")).toBe("developer");

    unmount();

    render(
      <ViewModeProvider initialMode="user">
        <ViewMenu />
        <ModeProbe />
      </ViewModeProvider>,
    );

    expect(screen.getByText("mode:developer")).toBeInTheDocument();
  });
});
