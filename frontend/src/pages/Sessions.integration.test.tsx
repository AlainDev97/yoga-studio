import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";

import Sessions from "./Sessions";
import { authService } from "../services/auth.service";
import { server } from "../test/server";
import type { Session } from "../types";

const mockSessions: Session[] = [
  {
    id: 10,
    name: "Morning Yoga",
    date: "2026-10-20",
    description: "Beginner yoga session",
    teacher: {
      id: 2,
      firstName: "Emma",
      lastName: "Martin",
    },
    users: [1, 3],
  },
  {
    id: 11,
    name: "Evening Yoga",
    date: "2026-10-21",
    description: "Relaxation session",
    teacher: {
      id: 3,
      firstName: "Lucas",
      lastName: "Durand",
    },
    users: [2],
  },
];

const mockUser = {
  id: 1,
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean@example.com",
  admin: false,
  token: "integration-token",
};

function authenticate(admin = false) {
  localStorage.setItem("token", "integration-token");
  localStorage.setItem("user", JSON.stringify({ ...mockUser, admin }));
}

function renderSessions() {
  return render(
    <MemoryRouter initialEntries={["/sessions"]}>
      <Routes>
        <Route path="/sessions" element={<Sessions />} />
        <Route
          path="/sessions/create"
          element={<div>Create session page</div>}
        />
        <Route path="/sessions/:id" element={<div>Session detail page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockSessionList(data: Session[] = mockSessions) {
  server.use(
    http.get("*/api/session", ({ request }) => {
      if (request.headers.get("Authorization") !== "Bearer integration-token") {
        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      return HttpResponse.json(data);
    }),
  );
}

describe("Sessions - tests d'intégration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("charge les séances depuis l'API avec le token", async () => {
    authenticate();
    mockSessionList();

    renderSessions();

    expect(await screen.findByText("Morning Yoga")).toBeInTheDocument();

    expect(screen.getByText("Evening Yoga")).toBeInTheDocument();

    expect(screen.getByText(/Teacher: Emma Martin/)).toBeInTheDocument();

    expect(authService.getToken()).toBe("integration-token");
  });

  it("affiche un message lorsque l'API retourne une liste vide", async () => {
    authenticate();
    mockSessionList([]);

    renderSessions();

    expect(
      await screen.findByText("No sessions available"),
    ).toBeInTheDocument();
  });

  it("affiche une erreur lorsque le serveur retourne HTTP 500", async () => {
    authenticate();

    vi.spyOn(console, "error").mockImplementation(() => {});

    server.use(
      http.get("*/api/session", () => {
        return HttpResponse.json(
          { message: "Internal server error" },
          { status: 500 },
        );
      }),
    );

    renderSessions();

    expect(
      await screen.findByText("Failed to load sessions"),
    ).toBeInTheDocument();
  });

  it("masque les actions administrateur pour un utilisateur standard", async () => {
    authenticate(false);
    mockSessionList();

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
    authenticate(true);
    mockSessionList();

    renderSessions();

    await screen.findByText("Morning Yoga");

    expect(
      screen.getByRole("link", { name: "Create Session" }),
    ).toHaveAttribute("href", "/sessions/create");

    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("supprime une séance via l'API et met à jour la liste", async () => {
    authenticate(true);
    mockSessionList();

    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    let deletedId: string | undefined;

    server.use(
      http.delete("*/api/session/:id", ({ params }) => {
        deletedId = String(params.id);

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderSessions();

    await screen.findByText("Morning Yoga");

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => {
      expect(deletedId).toBe("10");
    });

    await waitFor(() => {
      expect(screen.queryByText("Morning Yoga")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Evening Yoga")).toBeInTheDocument();

    expect(confirmSpy).toHaveBeenCalledOnce();
  });

  it("n'envoie aucune suppression si l'utilisateur annule", async () => {
    authenticate(true);
    mockSessionList();

    const user = userEvent.setup();

    vi.spyOn(window, "confirm").mockReturnValue(false);

    let deleteCalls = 0;

    server.use(
      http.delete("*/api/session/:id", () => {
        deleteCalls += 1;

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderSessions();

    await screen.findByText("Morning Yoga");

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(deleteCalls).toBe(0);
    expect(screen.getByText("Morning Yoga")).toBeInTheDocument();
  });
});
