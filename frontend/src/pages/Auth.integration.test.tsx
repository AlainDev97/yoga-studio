import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";

import Login from "./Login";
import Register from "./Register";
import { authService } from "../services/auth.service";
import { server } from "../test/server";
import type { AuthResponse } from "../types";

const mockUser: AuthResponse = {
  id: 1,
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean@example.com",
  admin: false,
  token: "integration-test-token",
};

function renderAuth(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/sessions" element={<div>Sessions page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillLogin(email = "jean@example.com", password = "Password123") {
  const user = userEvent.setup();

  await user.type(
    document.querySelector<HTMLInputElement>('input[type="email"]')!,
    email,
  );

  await user.type(
    document.querySelector<HTMLInputElement>('input[type="password"]')!,
    password,
  );

  return user;
}

async function fillRegister(email = "jean@example.com") {
  const user = userEvent.setup();

  await user.type(
    document.querySelector<HTMLInputElement>('input[name="firstName"]')!,
    "Jean",
  );

  await user.type(
    document.querySelector<HTMLInputElement>('input[name="lastName"]')!,
    "Dupont",
  );

  await user.type(
    document.querySelector<HTMLInputElement>('input[type="email"]')!,
    email,
  );

  await user.type(
    document.querySelector<HTMLInputElement>('input[type="password"]')!,
    "Password123",
  );

  return user;
}

describe("Auth - tests d'intégration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("connecte un utilisateur et stocke son token", async () => {
    let receivedCredentials: unknown;

    server.use(
      http.post("*/api/auth/login", async ({ request }) => {
        receivedCredentials = await request.json();

        return HttpResponse.json(mockUser);
      }),
    );

    renderAuth();

    const user = await fillLogin();

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();

    expect(receivedCredentials).toEqual({
      email: "jean@example.com",
      password: "Password123",
    });

    expect(authService.getToken()).toBe("integration-test-token");

    expect(authService.getCurrentUser()).toEqual(mockUser);
    expect(authService.isAuthenticated()).toBe(true);
  });

  it("affiche l'erreur API si les identifiants sont incorrects", async () => {
    server.use(
      http.post("*/api/auth/login", () => {
        return HttpResponse.json(
          { message: "Invalid credentials" },
          { status: 401 },
        );
      }),
    );

    renderAuth();

    const user = await fillLogin("wrong@example.com", "WrongPassword");

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();

    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getCurrentUser()).toBeNull();
  });

  it("affiche l'erreur générique Login failed si l'API ne fournit pas de message", async () => {
    server.use(
      http.post("*/api/auth/login", () => {
        return HttpResponse.json({}, { status: 500 });
      }),
    );

    renderAuth();

    const user = await fillLogin();

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Login failed")).toBeInTheDocument();

    expect(authService.getToken()).toBeNull();
  });

  it("inscrit un utilisateur et enregistre son authentification", async () => {
    let receivedRegistration: unknown;

    server.use(
      http.post("*/api/auth/register", async ({ request }) => {
        receivedRegistration = await request.json();

        return HttpResponse.json(mockUser, { status: 201 });
      }),
    );

    renderAuth("/register");

    const user = await fillRegister();

    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();

    expect(receivedRegistration).toEqual({
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean@example.com",
      password: "Password123",
    });

    expect(authService.getToken()).toBe("integration-test-token");

    expect(authService.getCurrentUser()).toEqual(mockUser);
  });

  it("affiche une erreur si l'adresse email existe déjà", async () => {
    server.use(
      http.post("*/api/auth/register", () => {
        return HttpResponse.json(
          { message: "Email already exists" },
          { status: 400 },
        );
      }),
    );

    renderAuth("/register");

    const user = await fillRegister();

    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("Email already exists")).toBeInTheDocument();

    expect(authService.isAuthenticated()).toBe(false);
  });

  it("affiche Registration failed si le serveur ne fournit pas de message", async () => {
    server.use(
      http.post("*/api/auth/register", () => {
        return HttpResponse.json({}, { status: 500 });
      }),
    );

    renderAuth("/register");

    const user = await fillRegister();

    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("Registration failed")).toBeInTheDocument();

    expect(localStorage.getItem("token")).toBeNull();
  });

  it("permet de naviguer de Login vers Register", async () => {
    renderAuth("/login");

    const user = userEvent.setup();

    await user.click(screen.getByRole("link", { name: "Register here" }));

    expect(
      await screen.findByText("Register for Yoga Studio"),
    ).toBeInTheDocument();
  });

  it("permet de naviguer de Register vers Login", async () => {
    renderAuth("/register");

    const user = userEvent.setup();

    await user.click(screen.getByRole("link", { name: "Login here" }));

    expect(await screen.findByText("Login to Yoga Studio")).toBeInTheDocument();
  });
});
