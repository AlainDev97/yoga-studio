import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Navbar from "./Navbar";
import { authService } from "../services/auth.service";

describe("Navbar", () => {
  beforeEach(() => {
    vi.spyOn(authService, "isAuthenticated").mockReturnValue(false);
    vi.spyOn(authService, "getCurrentUser").mockReturnValue(null);
  });

  it("affiche Login et Register si l'utilisateur est déconnecté", () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
  });

  it("n'affiche pas Logout si l'utilisateur est déconnecté", () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Logout" }),
    ).not.toBeInTheDocument();
  });
});
