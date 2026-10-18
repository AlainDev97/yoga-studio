import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Navbar from "./Navbar";
import { authService } from "../services/auth.service";

vi.mock("../services/auth.service", () => ({
  authService: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockUser = {
  id: 1,
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean@example.com",
  admin: false,
  token: "fake-token",
};

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Navbar />

      <Routes>
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/register" element={<div>Register page</div>} />
        <Route path="/sessions" element={<div>Sessions page</div>} />
        <Route path="/profile" element={<div>Profile page</div>} />
        <Route
          path="/sessions/create"
          element={<div>Create session page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(authService.isAuthenticated).mockReturnValue(false);
    vi.mocked(authService.getCurrentUser).mockReturnValue(null);
  });

  it("affiche Login et Register si l'utilisateur est déconnecté", () => {
    renderNavbar();

    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute(
      "href",
      "/login",
    );

    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("masque les liens privés lorsque l'utilisateur est déconnecté", () => {
    renderNavbar();

    expect(
      screen.queryByRole("link", { name: "Sessions" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: "Profile" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Logout" }),
    ).not.toBeInTheDocument();
  });

  it("affiche les liens privés pour un utilisateur connecté", () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(true);
    vi.mocked(authService.getCurrentUser).mockReturnValue(mockUser);

    renderNavbar();

    expect(screen.getByRole("link", { name: "Sessions" })).toHaveAttribute(
      "href",
      "/sessions",
    );

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );

    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: "Login" }),
    ).not.toBeInTheDocument();
  });

  it("masque Create Session pour un utilisateur non administrateur", () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(true);
    vi.mocked(authService.getCurrentUser).mockReturnValue(mockUser);

    renderNavbar();

    expect(
      screen.queryByRole("link", { name: "Create Session" }),
    ).not.toBeInTheDocument();
  });

  it("affiche Create Session pour un administrateur", () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(true);
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      ...mockUser,
      admin: true,
    });

    renderNavbar();

    expect(
      screen.getByRole("link", { name: "Create Session" }),
    ).toHaveAttribute("href", "/sessions/create");
  });

  it("ne montre pas les actions administrateur sans utilisateur chargé", () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(true);
    vi.mocked(authService.getCurrentUser).mockReturnValue(null);

    renderNavbar();

    expect(
      screen.queryByRole("link", { name: "Create Session" }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("déconnecte l'utilisateur et redirige vers Login", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.isAuthenticated).mockReturnValue(true);
    vi.mocked(authService.getCurrentUser).mockReturnValue(mockUser);

    renderNavbar();

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(authService.logout).toHaveBeenCalledOnce();

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });
});
