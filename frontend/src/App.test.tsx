import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./pages/Login", () => ({
  default: () => <div>Login page</div>,
}));

vi.mock("./pages/Register", () => ({
  default: () => <div>Register page</div>,
}));

vi.mock("./pages/Sessions", () => ({
  default: () => <div>Sessions page</div>,
}));

vi.mock("./pages/SessionDetail", () => ({
  default: () => <div>Session detail page</div>,
}));

vi.mock("./pages/SessionForm", () => ({
  default: () => <div>Session form page</div>,
}));

vi.mock("./pages/Profile", () => ({
  default: () => <div>Profile page</div>,
}));

const mockUser = {
  id: 1,
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  admin: false,
  token: "fake-token",
};

function authenticate(admin = false) {
  localStorage.setItem("token", "fake-token");
  localStorage.setItem("user", JSON.stringify({ ...mockUser, admin }));
}

function renderAt(path: string) {
  window.history.replaceState({}, "", path);
  return render(<App />);
}

describe("App - tests d'intégration des routes", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("redirige un visiteur de / vers /login", async () => {
    renderAt("/");

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("affiche la page Login sans connexion", () => {
    renderAt("/login");

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("affiche la page Register sans connexion", () => {
    renderAt("/register");

    expect(screen.getByText("Register page")).toBeInTheDocument();
  });

  it("protège la liste des séances", async () => {
    renderAt("/sessions");

    expect(await screen.findByText("Login page")).toBeInTheDocument();

    expect(screen.queryByText("Sessions page")).not.toBeInTheDocument();
  });

  it("autorise l'accès aux séances pour un utilisateur connecté", () => {
    authenticate();

    renderAt("/sessions");

    expect(screen.getByText("Sessions page")).toBeInTheDocument();
  });

  it("protège les détails d'une séance", async () => {
    renderAt("/sessions/10");

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("autorise les détails d'une séance pour un utilisateur connecté", () => {
    authenticate();

    renderAt("/sessions/10");

    expect(screen.getByText("Session detail page")).toBeInTheDocument();
  });

  it("protège la création d'une séance", async () => {
    renderAt("/sessions/create");

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("autorise l'accès à la création pour un administrateur", () => {
    authenticate(true);

    renderAt("/sessions/create");

    expect(screen.getByText("Session form page")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Create Session" }),
    ).toBeInTheDocument();
  });

  it("protège la modification d'une séance", async () => {
    renderAt("/sessions/edit/10");

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("autorise l'accès à la modification si l'utilisateur est connecté", () => {
    authenticate(true);

    renderAt("/sessions/edit/10");

    expect(screen.getByText("Session form page")).toBeInTheDocument();
  });

  it("protège la page Profile", async () => {
    renderAt("/profile");

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("autorise la page Profile pour un utilisateur connecté", () => {
    authenticate();

    renderAt("/profile");

    expect(screen.getByText("Profile page")).toBeInTheDocument();
  });

  it("redirige / vers les séances si l'utilisateur est connecté", async () => {
    authenticate();

    renderAt("/");

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();
  });

  it("navigue vers Profile depuis la Navbar", async () => {
    authenticate();

    const user = userEvent.setup();

    renderAt("/sessions");

    await user.click(screen.getByRole("link", { name: "Profile" }));

    expect(await screen.findByText("Profile page")).toBeInTheDocument();
  });

  it("déconnecte l'utilisateur depuis la Navbar", async () => {
    authenticate();

    const user = userEvent.setup();

    renderAt("/sessions");

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(await screen.findByText("Login page")).toBeInTheDocument();

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });
});
