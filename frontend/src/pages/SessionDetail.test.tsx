import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import SessionDetail from "./SessionDetail";
import api from "../services/api";
import { authService } from "../services/auth.service";
import type { Session } from "../types";

vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../services/auth.service", () => ({
  authService: {
    getCurrentUser: vi.fn(),
    getToken: vi.fn(),
  },
}));

const mockUser = {
  id: 1,
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  admin: false,
  token: "fake-token",
};

const mockSession: Session = {
  id: 10,
  name: "Morning Yoga",
  date: "2026-10-20",
  description: "Beginner yoga session",
  teacher: {
    id: 2,
    firstName: "Emma",
    lastName: "Martin",
  },
  users: [2, 3],
};

function renderSessionDetail(path = "/sessions/10") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sessions" element={<div>Sessions page</div>} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
        <Route
          path="/sessions/edit/:id"
          element={<div>Edit session page</div>}
        />
        <Route path="/missing-id" element={<SessionDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SessionDetail", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(authService.getCurrentUser).mockReturnValue(mockUser);

    vi.mocked(authService.getToken).mockReturnValue("fake-token");

    vi.mocked(api.get).mockResolvedValue({
      data: { ...mockSession, users: [...mockSession.users] },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche un indicateur pendant le chargement", () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

    renderSessionDetail();

    expect(screen.getByText("Loading session...")).toBeInTheDocument();
  });

  it("affiche les informations de la séance", async () => {
    renderSessionDetail();

    expect(
      await screen.findByRole("heading", {
        name: "Morning Yoga",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Beginner yoga session")).toBeInTheDocument();

    expect(screen.getByText(/Emma Martin/)).toBeInTheDocument();

    expect(screen.getByText(/Tuesday, October 20, 2026/)).toBeInTheDocument();

    expect(api.get).toHaveBeenCalledWith(
      "/session/10",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer fake-token",
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("affiche une erreur lorsque le chargement échoue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

    renderSessionDetail();

    expect(
      await screen.findByText("Failed to load session details"),
    ).toBeInTheDocument();
  });

  it("affiche un message si l'identifiant est absent", async () => {
    renderSessionDetail("/missing-id");

    expect(
      await screen.findByText("Session ID is missing"),
    ).toBeInTheDocument();

    expect(api.get).not.toHaveBeenCalled();
  });

  it("masque les actions admin pour un utilisateur classique", async () => {
    renderSessionDetail();

    await screen.findByText("Morning Yoga");

    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Join Session" }),
    ).toBeInTheDocument();
  });

  it("affiche les actions admin pour un administrateur", async () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      ...mockUser,
      admin: true,
    });

    renderSessionDetail();

    await screen.findByText("Morning Yoga");

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Join Session" }),
    ).not.toBeInTheDocument();
  });

  it("redirige vers la modification d'une séance", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.getCurrentUser).mockReturnValue({
      ...mockUser,
      admin: true,
    });

    renderSessionDetail();

    await screen.findByText("Morning Yoga");

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByText("Edit session page")).toBeInTheDocument();
  });

  it("permet à un utilisateur de rejoindre une séance", async () => {
    const user = userEvent.setup();

    vi.mocked(api.post).mockResolvedValue({ data: {} });

    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockSession })
      .mockResolvedValueOnce({
        data: { ...mockSession, users: [1, 2, 3] },
      });

    renderSessionDetail();

    await screen.findByText("Morning Yoga");

    await user.click(screen.getByRole("button", { name: "Join Session" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/session/10/participate/1",
        {},
        {
          headers: {
            Authorization: "Bearer fake-token",
          },
        },
      );
    });

    expect(
      await screen.findByRole("button", {
        name: "Leave Session",
      }),
    ).toBeInTheDocument();
  });

  it("permet à un utilisateur de quitter une séance", async () => {
    const user = userEvent.setup();

    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: { ...mockSession, users: [1, 2, 3] },
      })
      .mockResolvedValueOnce({ data: mockSession });

    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    renderSessionDetail();

    await screen.findByRole("button", {
      name: "Leave Session",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Leave Session",
      }),
    );

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/session/10/participate/1", {
        headers: {
          Authorization: "Bearer fake-token",
        },
      });
    });

    expect(
      await screen.findByRole("button", {
        name: "Join Session",
      }),
    ).toBeInTheDocument();
  });

  it("supprime une séance après confirmation", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.getCurrentUser).mockReturnValue({
      ...mockUser,
      admin: true,
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    renderSessionDetail();

    await screen.findByText("Morning Yoga");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/session/10", {
        headers: {
          Authorization: "Bearer fake-token",
        },
      });
    });

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();
  });

  it("annule la suppression si la confirmation est refusée", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.getCurrentUser).mockReturnValue({
      ...mockUser,
      admin: true,
    });

    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderSessionDetail();

    await screen.findByText("Morning Yoga");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.delete).not.toHaveBeenCalled();

    expect(screen.getByText("Morning Yoga")).toBeInTheDocument();
  });

  it("retourne vers la liste des séances", async () => {
    const user = userEvent.setup();

    renderSessionDetail();

    await screen.findByText("Morning Yoga");

    await user.click(
      screen.getByRole("button", {
        name: "Back to Sessions",
      }),
    );

    expect(screen.getByText("Sessions page")).toBeInTheDocument();
  });
});
