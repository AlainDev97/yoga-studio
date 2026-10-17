import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axios from "axios";

import Register from "./Register";
import { authService } from "../services/auth.service";

vi.mock("../services/auth.service", () => ({
  authService: {
    register: vi.fn(),
  },
}));

const renderRegister = (): void => {
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/sessions" element={<div>Sessions page</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("Register", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("affiche le formulaire d'inscription", () => {
    renderRegister();

    expect(screen.getByText("Register for Yoga Studio")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Register" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Login here" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("inscrit un utilisateur avec des données valides", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.register).mockResolvedValue({
      id: 1,
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      admin: false,
      token: "fake-token",
    });

    renderRegister();

    await user.type(
      document.querySelector<HTMLInputElement>('input[name="firstName"]')!,
      "Test",
    );

    await user.type(
      document.querySelector<HTMLInputElement>('input[name="lastName"]')!,
      "User",
    );

    await user.type(
      document.querySelector<HTMLInputElement>('input[type="email"]')!,
      "test@example.com",
    );

    await user.type(
      document.querySelector<HTMLInputElement>('input[type="password"]')!,
      "Password123",
    );

    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "Password123",
      });
    });

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();
  });

  it("empêche l'inscription si les champs sont vides", async () => {
    const user = userEvent.setup();

    renderRegister();

    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(authService.register).not.toHaveBeenCalled();

    const firstNameInput = document.querySelector<HTMLInputElement>(
      'input[name="firstName"]',
    );

    expect(firstNameInput).toBeRequired();
  });

  it("impose un mot de passe d'au moins 8 caractères", () => {
    renderRegister();

    const passwordInput = document.querySelector<HTMLInputElement>(
      'input[type="password"]',
    );

    expect(passwordInput).not.toBeNull();
    expect(passwordInput).toBeRequired();
    expect(passwordInput).toHaveAttribute("minlength", "8");
  });

  it("affiche une erreur lorsque l'inscription échoue", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.register).mockRejectedValue(
      new Error("Network error"),
    );

    renderRegister();

    const firstName = document.querySelector<HTMLInputElement>(
      'input[name="firstName"]',
    )!;

    const lastName = document.querySelector<HTMLInputElement>(
      'input[name="lastName"]',
    )!;

    const email = document.querySelector<HTMLInputElement>(
      'input[type="email"]',
    )!;

    const password = document.querySelector<HTMLInputElement>(
      'input[type="password"]',
    )!;

    await user.type(firstName, "Test");
    await user.type(lastName, "User");
    await user.type(email, "test@example.com");
    await user.type(password, "Password123");

    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("An unexpected error occurred"),
    ).toBeInTheDocument();

    expect(screen.queryByText("Sessions page")).not.toBeInTheDocument();
  });

  it("affiche le message d'erreur renvoyé par l'API", async () => {
    const user = userEvent.setup();

    const apiError = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        data: { message: "Email already exists" },
        status: 400,
        statusText: "Bad Request",
        headers: {},
        config: { headers: new axios.AxiosHeaders() },
      },
    );

    vi.mocked(authService.register).mockRejectedValue(apiError);

    renderRegister();

    await user.type(
      document.querySelector<HTMLInputElement>('input[name="firstName"]')!,
      "Test",
    );

    await user.type(
      document.querySelector<HTMLInputElement>('input[name="lastName"]')!,
      "User",
    );

    await user.type(
      document.querySelector<HTMLInputElement>('input[type="email"]')!,
      "test@example.com",
    );

    await user.type(
      document.querySelector<HTMLInputElement>('input[type="password"]')!,
      "Password123",
    );

    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("Email already exists")).toBeInTheDocument();
  });
});
