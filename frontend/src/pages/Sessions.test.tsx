import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Sessions from "./Sessions";
import api from "../services/api";
import { authService } from "../services/auth.service";
import type { Session } from "../types";

vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../services/auth.service", () => ({
  authService: {
    getCurrentUser: vi.fn(),
    getToken: vi.fn(),
  },
}));

const mockSessions: Session[] = [
  {
    id: 1,
    name: "Morning Yoga",
    date: "2026-10-20",
    description: "Beginner yoga session",
    teacher: {
      id: 1,
      firstName: "Emma",
      lastName: "Martin",
    },
    users: [1, 2],
  },
  {
    id: 2,
    name: "Evening Yoga",
    date: "2026-10-21",
    description: "Relaxation session",
    teacher: {
      id: 2,
      firstName: "Lucas",
      lastName: "Durand",
    },
    users: [3],
  },
];

const mockUser = {
  id: 1,
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  admin: false,
  token: "fake-token",
};

const renderSessions = (): void => {
  render(
    <MemoryRouter>
      <Sessions />
    </MemoryRouter>,
  );
};

describe("Sessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(authService.getCurrentUser).mockReturnValue(mockUser);

    vi.mocked(authService.getToken).mockReturnValue("fake-token");

    vi.mocked(api.get).mockResolvedValue({
      data: mockSessions,
    });
  });

  it("affiche la liste des séances", async () => {
    renderSessions();

    expect(await screen.findByText("Morning Yoga")).toBeInTheDocument();

    expect(screen.getByText("Evening Yoga")).toBeInTheDocument();

    expect(
      screen.getByText("Emma Martin", { exact: false }),
    ).toBeInTheDocument();

    expect(api.get).toHaveBeenCalledWith(
      "/session",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer fake-token",
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("affiche un message si aucune séance n'existe", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
    });

    renderSessions();

    expect(
      await screen.findByText("No sessions available"),
    ).toBeInTheDocument();
  });

  it("masque les actions administrateur pour un utilisateur classique", async () => {
    renderSessions();

    await screen.findByText("Morning Yoga");

    expect(
      screen.queryByRole("link", { name: "Create Session" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: "View Details" })).toHaveLength(
      2,
    );
  });

  it("affiche les actions administrateur pour un admin", async () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      ...mockUser,
      admin: true,
    });

    renderSessions();

    await screen.findByText("Morning Yoga");

    expect(
      screen.getByRole("link", { name: "Create Session" }),
    ).toHaveAttribute("href", "/sessions/create");

    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("permet à un administrateur de supprimer une séance", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.getCurrentUser).mockReturnValue({
      ...mockUser,
      admin: true,
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.mocked(api.delete).mockResolvedValue({
      data: {},
    });

    renderSessions();

    await screen.findByText("Morning Yoga");

    const deleteButtons = screen.getAllByRole("button", {
      name: "Delete",
    });

    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(
        "/session/1",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer fake-token",
          },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("Morning Yoga")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Evening Yoga")).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement échoue", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

    vi.spyOn(console, "error").mockImplementation(() => {});

    renderSessions();

    expect(
      await screen.findByText("Failed to load sessions"),
    ).toBeInTheDocument();
  });
});
