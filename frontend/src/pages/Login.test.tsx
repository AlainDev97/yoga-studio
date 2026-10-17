import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Login from "./Login";
import { authService } from "../services/auth.service";

vi.mock("../services/auth.service", () => ({
  authService: {
    login: vi.fn(),
  },
}));

const renderLogin = (): void => {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/sessions" element={<div>Sessions page</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connecte l'utilisateur avec des identifiants valides", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.login).mockResolvedValue({
      id: 1,
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      admin: false,
      token: "fake-token",
    });

    renderLogin();

    await user.type(screen.getByRole("textbox"), "test@example.com");

    await user.type(
      document.querySelector<HTMLInputElement>('input[type="password"]')!,
      "Password123",
    );

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "Password123",
      });
    });

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();
  });

  it("affiche une erreur si les identifiants sont incorrects", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.login).mockRejectedValue(
      new Error("Invalid credentials"),
    );

    renderLogin();

    await user.type(screen.getByRole("textbox"), "wrong@example.com");

    await user.type(
      document.querySelector<HTMLInputElement>('input[type="password"]')!,
      "wrongpassword",
    );

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText("An unexpected error occurred"),
    ).toBeInTheDocument();

    expect(screen.queryByText("Sessions page")).not.toBeInTheDocument();
  });

  it("empêche l'envoi si les champs obligatoires sont vides", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(authService.login).not.toHaveBeenCalled();

    const emailInput = screen.getByRole("textbox");

    expect(emailInput).toBeRequired();
  });
});
