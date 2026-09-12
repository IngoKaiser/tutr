import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "./account-menu";

afterEach(cleanup);

describe("AccountMenu", () => {
  it("zeigt zunächst nur den Avatar, kein Menü", () => {
    render(<AccountMenu label="Mia" logout={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Kontomenü öffnen" })).toHaveTextContent("M");
    expect(screen.queryByText("Einstellungen")).not.toBeInTheDocument();
  });

  it("ein Klick öffnet das Menü mit Einstellungen und Abmelden", () => {
    render(<AccountMenu label="Mia" logout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Kontomenü öffnen" }));

    expect(screen.getByText("Einstellungen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abmelden" })).toBeInTheDocument();
  });

  it("zeigt die E-Mail-Adresse nur, wenn sie übergeben wird", () => {
    render(<AccountMenu label="mama@beispiel.de" email="mama@beispiel.de" logout={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Kontomenü öffnen" }));
    expect(screen.getByText("mama@beispiel.de")).toBeInTheDocument();
  });

  it("ein Klick außerhalb schließt das Menü wieder", () => {
    render(
      <div>
        <AccountMenu label="Mia" logout={vi.fn()} />
        <button type="button">Woanders</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Kontomenü öffnen" }));
    expect(screen.getByText("Einstellungen")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Woanders" }));
    expect(screen.queryByText("Einstellungen")).not.toBeInTheDocument();
  });
});
