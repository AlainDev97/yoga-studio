import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";

import SessionForm from "./SessionForm";
import api from "../services/api";
import { authService } from "../services/auth.service";
import type { Session, Teacher } from "../types";

vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("../services/auth.service", () => ({
  authService: {
    getCurrentUser: vi.fn(),
    getToken: vi.fn(),
  },
}));

const adminUser = {
  id: 1,
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "User",
  admin: true,
  token: "fake-token",
};

const teachers: Teacher[] = [
  { id: 2, firstName: "Emma", lastName: "Martin" },
  { id: 3, firstName: "Lucas", lastName: "Durand" },
];

const existingSession: Session = {
  id: 10,
  name: "Morning Yoga",
  date: "2026-10-20",
  description: "Beginner yoga session",
  teacher: teachers[0],
  users: [1, 3],
};

function renderSessionForm(path = "/sessions/create") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sessions/create" element={<SessionForm />} />
        <Route path="/sessions/edit/:id" element={<SessionForm />} />
        <Route path="/sessions" element={<div>Sessions page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillForm() {
  const user = userEvent.setup();

  await user.type(
    screen.getByRole("textbox", { name: "Session Name" }),
    "New Yoga Session",
  );

  await user.type(screen.getByLabelText("Date"), "2026-10-25");

  await user.selectOptions(
    screen.getByRole("combobox", { name: "Teacher" }),
    "2",
  );

  await user.type(
    screen.getByRole("textbox", { name: "Description" }),
    "A relaxing yoga session",
  );

  return user;
}

describe("SessionForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(authService.getCurrentUser).mockReturnValue(adminUser);

    vi.mocked(authService.getToken).mockReturnValue("fake-token");

    vi.mocked(api.get).mockImplementation((url) => {
      if (url === "/teacher") {
        return Promise.resolve({ data: teachers });
      }

      if (url === "/session/10") {
        return Promise.resolve({ data: existingSession });
      }

      return Promise.reject(new Error("Unknown endpoint"));
    });
  });

  it("affiche le formulaire de création", async () => {
    renderSessionForm();

    expect(
      screen.getByRole("heading", {
        name: "Create New Session",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Create Session",
      }),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("option", {
        name: "Emma Martin",
      }),
    ).toBeInTheDocument();
  });

  it("charge les enseignants depuis l'API", async () => {
    renderSessionForm();

    expect(
      await screen.findByRole("option", {
        name: "Lucas Durand",
      }),
    ).toBeInTheDocument();

    expect(api.get).toHaveBeenCalledWith(
      "/teacher",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer fake-token",
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("crée une séance avec des données valides", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });

    renderSessionForm();

    await screen.findByRole("option", {
      name: "Emma Martin",
    });

    const user = await fillForm();

    await user.click(
      screen.getByRole("button", {
        name: "Create Session",
      }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/session",
        {
          name: "New Yoga Session",
          date: "2026-10-25",
          teacherId: 2,
          description: "A relaxing yoga session",
        },
        {
          headers: {
            Authorization: "Bearer fake-token",
          },
        },
      );
    });

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();
  });

  it("empêche l'envoi si les champs sont vides", async () => {
    const user = userEvent.setup();

    renderSessionForm();

    await user.click(
      screen.getByRole("button", {
        name: "Create Session",
      }),
    );

    expect(api.post).not.toHaveBeenCalled();

    expect(
      screen.getByRole("textbox", {
        name: "Session Name",
      }),
    ).toBeRequired();
  });

  it("affiche les informations de la séance en mode modification", async () => {
    renderSessionForm("/sessions/edit/10");

    expect(
      await screen.findByRole("heading", {
        name: "Edit Session",
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", {
          name: "Session Name",
        }),
      ).toHaveValue("Morning Yoga");
    });

    expect(
      screen.getByRole("combobox", {
        name: "Teacher",
      }),
    ).toHaveValue("2");

    expect(
      screen.getByRole("textbox", {
        name: "Description",
      }),
    ).toHaveValue("Beginner yoga session");

    expect(api.get).toHaveBeenCalledWith(
      "/session/10",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("modifie une séance existante", async () => {
    const user = userEvent.setup();

    vi.mocked(api.put).mockResolvedValue({ data: {} });

    renderSessionForm("/sessions/edit/10");

    const nameInput = await screen.findByRole("textbox", {
      name: "Session Name",
    });

    await waitFor(() => {
      expect(nameInput).toHaveValue("Morning Yoga");
    });

    await user.clear(nameInput);
    await user.type(nameInput, "Updated Yoga");

    await user.click(
      screen.getByRole("button", {
        name: "Update Session",
      }),
    );

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        "/session/10",
        expect.objectContaining({
          name: "Updated Yoga",
          date: "2026-10-20",
          description: "Beginner yoga session",
          teacherId: 2,
        }),
        {
          headers: {
            Authorization: "Bearer fake-token",
          },
        },
      );
    });

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();
  });

  it("redirige un utilisateur non administrateur", async () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      ...adminUser,
      admin: false,
    });

    renderSessionForm();

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();

    expect(api.get).not.toHaveBeenCalled();
  });

  it("affiche une erreur si le chargement échoue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

    renderSessionForm();

    expect(
      await screen.findByText("Failed to load form data"),
    ).toBeInTheDocument();
  });

  it("affiche une erreur si l'API refuse la création", async () => {
    vi.mocked(api.post).mockRejectedValue(
      new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { message: "Invalid session data" },
        status: 400,
        statusText: "Bad Request",
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );

    renderSessionForm();

    await screen.findByRole("option", {
      name: "Emma Martin",
    });

    const user = await fillForm();

    await user.click(
      screen.getByRole("button", {
        name: "Create Session",
      }),
    );

    expect(await screen.findByText("Invalid session data")).toBeInTheDocument();
  });

  it("affiche une erreur inattendue si l'enregistrement échoue", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Unexpected error"));

    renderSessionForm();

    await screen.findByRole("option", {
      name: "Emma Martin",
    });

    const user = await fillForm();

    await user.click(
      screen.getByRole("button", {
        name: "Create Session",
      }),
    );

    expect(
      await screen.findByText("An unexpected error occurred"),
    ).toBeInTheDocument();
  });

  it("permet d'annuler et de revenir à la liste", async () => {
    const user = userEvent.setup();

    renderSessionForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();
  });
});
