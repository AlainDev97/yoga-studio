import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Profile from "./Profile";
import api from "../services/api";
import { authService } from "../services/auth.service";
import type { User } from "../types";

vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../services/auth.service", () => ({
  authService: {
    getCurrentUser: vi.fn(),
    getToken: vi.fn(),
    logout: vi.fn(),
    updateCurrentUser: vi.fn(),
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

const mockProfile: User = {
  id: 1,
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean@example.com",
  admin: false,
  createdAt: "2026-09-01T12:00:00.000Z",
};

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/sessions" element={<div>Sessions page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Profile", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(authService.getCurrentUser).mockReturnValue(mockUser);

    vi.mocked(authService.getToken).mockReturnValue("fake-token");

    vi.mocked(api.get).mockResolvedValue({
      data: { ...mockProfile },
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("affiche un indicateur pendant le chargement", () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

    renderProfile();

    expect(screen.getByText("Loading profile...")).toBeInTheDocument();
  });

  it("affiche les informations de l'utilisateur", async () => {
    renderProfile();

    expect(
      await screen.findByRole("heading", {
        name: "My Profile",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Jean")).toBeInTheDocument();
    expect(screen.getByText("Dupont")).toBeInTheDocument();
    expect(screen.getByText("jean@example.com")).toBeInTheDocument();

    expect(screen.getByText("September 1, 2026")).toBeInTheDocument();

    expect(api.get).toHaveBeenCalledWith(
      "/user/1",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer fake-token",
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("affiche le statut utilisateur classique", async () => {
    renderProfile();

    expect(await screen.findByText("User")).toBeInTheDocument();

    expect(screen.queryByText("Administrator")).not.toBeInTheDocument();
  });

  it("affiche le statut administrateur", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...mockProfile, admin: true },
    });

    renderProfile();

    expect(await screen.findByText("Administrator")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Promote to Admin (Dev)",
      }),
    ).not.toBeInTheDocument();
  });

  it("affiche Unknown si la date de création est absente", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...mockProfile, createdAt: undefined },
    });

    renderProfile();

    expect(await screen.findByText("Unknown")).toBeInTheDocument();
  });

  it("affiche une erreur si l'utilisateur n'est pas connecté", async () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue(null);

    renderProfile();

    expect(
      await screen.findByText("User not authenticated"),
    ).toBeInTheDocument();

    expect(api.get).not.toHaveBeenCalled();
  });

  it("affiche une erreur lorsque le chargement échoue", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

    renderProfile();

    expect(
      await screen.findByText("Failed to load user information"),
    ).toBeInTheDocument();
  });

  it("annule la suppression du compte si la confirmation est refusée", async () => {
    const user = userEvent.setup();

    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderProfile();

    await screen.findByText("My Profile");

    await user.click(
      screen.getByRole("button", {
        name: "Delete Account",
      }),
    );

    expect(api.delete).not.toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it("supprime le compte après confirmation", async () => {
    const user = userEvent.setup();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    renderProfile();

    await screen.findByText("My Profile");

    await user.click(
      screen.getByRole("button", {
        name: "Delete Account",
      }),
    );

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/user/1", {
        headers: {
          Authorization: "Bearer fake-token",
        },
      });
    });

    expect(authService.logout).toHaveBeenCalled();

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("affiche une alerte si la suppression échoue", async () => {
    const user = userEvent.setup();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    vi.mocked(api.delete).mockRejectedValue(new Error("Delete failed"));

    renderProfile();

    await screen.findByText("My Profile");

    await user.click(
      screen.getByRole("button", {
        name: "Delete Account",
      }),
    );

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Failed to delete account");
    });

    expect(authService.logout).not.toHaveBeenCalled();
  });

  it("permet de revenir à la liste des séances", async () => {
    const user = userEvent.setup();

    renderProfile();

    await screen.findByText("My Profile");

    await user.click(
      screen.getByRole("button", {
        name: "Back to Sessions",
      }),
    );

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();
  });

  it("promeut l'utilisateur administrateur en développement", async () => {
    const user = userEvent.setup();

    vi.mocked(api.post).mockResolvedValue({
      data: { ...mockProfile, admin: true },
    });

    renderProfile();

    const promoteButton = await screen.findByRole("button", {
      name: "Promote to Admin (Dev)",
    });

    await user.click(promoteButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/user/promote-admin",
        {},
        {
          headers: {
            Authorization: "Bearer fake-token",
          },
        },
      );
    });

    expect(await screen.findByText("Administrator")).toBeInTheDocument();

    expect(authService.updateCurrentUser).toHaveBeenCalledWith({
      admin: true,
    });
  });
});
