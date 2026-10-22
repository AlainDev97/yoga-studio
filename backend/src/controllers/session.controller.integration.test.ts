import { afterAll, beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

interface AuthResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  admin: boolean;
  token: string;
}

interface SessionResponse {
  id: number;
  name: string;
  date: string;
  description: string;
  teacher: {
    id: number;
    firstName: string;
    lastName: string;
  };
  users: number[];
  createdAt: string;
  updatedAt: string;
}

let server: Server | undefined;
let baseUrl: string;
let admin: AuthResponse;
let user: AuthResponse;

const createdSessions = new Set<number>();

const validSession = {
  name: "Yoga Integration Test",
  date: "2027-01-15",
  description: "Séance créée par Vitest",
  teacherId: 1,
};

function headers(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, options);
}

async function sendJson(
  method: string,
  path: string,
  data: unknown,
  token?: string,
): Promise<Response> {
  return api(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers(token),
    },
    body: JSON.stringify(data),
  });
}

async function createTemporarySession(): Promise<SessionResponse> {
  const response = await sendJson(
    "POST",
    "/api/session",
    {
      ...validSession,
      name: `Yoga Test ${randomUUID().slice(0, 8)}`,
    },
    admin.token,
  );

  expect(response.status).toBe(201);

  const session = (await response.json()) as SessionResponse;

  createdSessions.add(session.id);

  return session;
}

async function deleteTemporarySession(sessionId: number): Promise<Response> {
  const response = await api(`/api/session/${sessionId}`, {
    method: "DELETE",
    headers: headers(admin.token),
  });

  if (response.ok) {
    createdSessions.delete(sessionId);
  }

  return response;
}

beforeAll(async () => {
  const result = dotenv.config({
    path: ".env.e2e",
    override: true,
  });

  if (result.error) {
    throw new Error("Impossible de charger .env.e2e");
  }

  const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(
    1,
  );

  if (databaseName !== "yoga_studio_e2e") {
    throw new Error("Tests interdits hors de yoga_studio_e2e");
  }

  process.env.NODE_ENV = "test";

  const { default: app } = await import("../app");

  server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1");

    instance.once("listening", () => resolve(instance));
    instance.once("error", reject);
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  const loginResponse = await sendJson("POST", "/api/auth/login", {
    email: "yoga@studio.com",
    password: "test!1234",
  });

  expect(loginResponse.status).toBe(200);
  admin = (await loginResponse.json()) as AuthResponse;

  const registerResponse = await sendJson("POST", "/api/auth/register", {
    email: `s-${randomUUID().slice(0, 8)}@example.com`,
    password: "Password123!",
    firstName: "Session",
    lastName: "Tester",
  });

  expect(registerResponse.status).toBe(201);
  user = (await registerResponse.json()) as AuthResponse;
}, 30000);

afterAll(async () => {
  try {
    // Nettoyage des séances temporaires,
    // même lorsqu'un test échoue.
    if (admin?.token) {
      for (const sessionId of [...createdSessions]) {
        const response = await deleteTemporarySession(sessionId);

        if (!response.ok) {
          console.error(
            `Nettoyage séance ${sessionId}: HTTP ${response.status}`,
          );
        }
      }
    }

    // Nettoyage du compte temporaire.
    if (user?.token) {
      const response = await api(`/api/user/${user.id}`, {
        method: "DELETE",
        headers: headers(user.token),
      });

      if (!response.ok) {
        console.error(`Nettoyage utilisateur: HTTP ${response.status}`);
      }
    }
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  }
});

describe("SessionController - intégration HTTP", () => {
  describe("GET /api/session", () => {
    it("retourne la liste des séances", async () => {
      const response = await api("/api/session", {
        headers: headers(user.token),
      });

      expect(response.status).toBe(200);

      const sessions = (await response.json()) as SessionResponse[];

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThanOrEqual(4);

      expect(sessions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Yoga Vinyasa",
          }),
        ]),
      );
    });

    it("refuse l'accès sans JWT", async () => {
      const response = await api("/api/session");

      expect(response.status).toBe(401);
    });

    it("refuse un JWT invalide", async () => {
      const response = await api("/api/session", {
        headers: headers("invalid-token"),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/session/:id", () => {
    it("retourne une séance et ses relations", async () => {
      const response = await api("/api/session/1", {
        headers: headers(user.token),
      });

      expect(response.status).toBe(200);

      const session = (await response.json()) as SessionResponse;

      expect(session).toMatchObject({
        id: 1,
        name: "Yoga Vinyasa",
      });

      expect(session.teacher).toMatchObject({
        id: 1,
        firstName: "Margot",
        lastName: "Delahaye",
      });

      expect(Array.isArray(session.users)).toBe(true);
    });

    it("refuse un identifiant invalide", async () => {
      const response = await api("/api/session/abc", {
        headers: headers(user.token),
      });

      expect(response.status).toBe(400);
    });

    it("refuse un identifiant nul", async () => {
      const response = await api("/api/session/0", {
        headers: headers(user.token),
      });

      expect(response.status).toBe(400);
    });

    it("retourne 404 pour une séance inconnue", async () => {
      const response = await api("/api/session/999999999", {
        headers: headers(user.token),
      });

      expect(response.status).toBe(404);
    });

    it("refuse l'accès sans JWT", async () => {
      const response = await api("/api/session/1");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/session", () => {
    it("permet à un administrateur de créer une séance", async () => {
      const response = await sendJson(
        "POST",
        "/api/session",
        validSession,
        admin.token,
      );

      expect(response.status).toBe(201);

      const session = (await response.json()) as SessionResponse;

      createdSessions.add(session.id);

      expect(session).toMatchObject({
        name: validSession.name,
        description: validSession.description,
        teacher: {
          id: 1,
        },
      });

      expect(session.id).toEqual(expect.any(Number));

      const verification = await api(`/api/session/${session.id}`, {
        headers: headers(admin.token),
      });

      expect(verification.status).toBe(200);
    });

    it("refuse la création par un utilisateur classique", async () => {
      const response = await sendJson(
        "POST",
        "/api/session",
        validSession,
        user.token,
      );

      expect(response.status).toBe(403);
    });

    it("refuse la création sans authentification", async () => {
      const response = await sendJson("POST", "/api/session", validSession);

      expect(response.status).toBe(401);
    });

    it("refuse un nom manquant", async () => {
      const response = await sendJson(
        "POST",
        "/api/session",
        { ...validSession, name: "" },
        admin.token,
      );

      expect(response.status).toBe(400);
    });

    it("refuse une description manquante", async () => {
      const response = await sendJson(
        "POST",
        "/api/session",
        { ...validSession, description: "" },
        admin.token,
      );

      expect(response.status).toBe(400);
    });

    it("refuse une date manquante", async () => {
      const response = await sendJson(
        "POST",
        "/api/session",
        { ...validSession, date: "" },
        admin.token,
      );

      expect(response.status).toBe(400);
    });

    it("refuse un professeur inexistant", async () => {
      const response = await sendJson(
        "POST",
        "/api/session",
        { ...validSession, teacherId: 999999 },
        admin.token,
      );

      expect(response.status).toBe(404);
    });

    it("refuse un identifiant professeur invalide", async () => {
      const response = await sendJson(
        "POST",
        "/api/session",
        { ...validSession, teacherId: "abc" },
        admin.token,
      );

      expect(response.status).toBe(400);
    });

    it("refuse une date invalide", async () => {
      const response = await sendJson(
        "POST",
        "/api/session",
        { ...validSession, date: "not-a-date" },
        admin.token,
      );

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/session/:id", () => {
    it("modifie réellement une séance", async () => {
      const session = await createTemporarySession();

      const response = await sendJson(
        "PUT",
        `/api/session/${session.id}`,
        {
          name: "Yoga Integration Updated",
          description: "Description modifiée",
          date: "2027-02-10",
          teacherId: 2,
        },
        admin.token,
      );

      expect(response.status).toBe(200);

      const updated = (await response.json()) as SessionResponse;

      expect(updated).toMatchObject({
        id: session.id,
        name: "Yoga Integration Updated",
        description: "Description modifiée",
        teacher: { id: 2 },
      });

      const verification = await api(`/api/session/${session.id}`, {
        headers: headers(admin.token),
      });

      expect(verification.status).toBe(200);

      const saved = (await verification.json()) as SessionResponse;

      expect(saved.name).toBe("Yoga Integration Updated");
      expect(saved.teacher.id).toBe(2);
    });

    it("accepte une modification partielle", async () => {
      const session = await createTemporarySession();

      const response = await sendJson(
        "PUT",
        `/api/session/${session.id}`,
        { name: "Yoga Partially Updated" },
        admin.token,
      );

      expect(response.status).toBe(200);

      const updated = (await response.json()) as SessionResponse;

      expect(updated.name).toBe("Yoga Partially Updated");
      expect(updated.description).toBe("Séance créée par Vitest");
    });

    it("refuse la modification par un utilisateur classique", async () => {
      const session = await createTemporarySession();

      const response = await sendJson(
        "PUT",
        `/api/session/${session.id}`,
        { name: "Unauthorized update" },
        user.token,
      );

      expect(response.status).toBe(403);
    });

    it("refuse la modification sans JWT", async () => {
      const response = await sendJson("PUT", "/api/session/1", {
        name: "Unauthorized update",
      });

      expect(response.status).toBe(401);
    });

    it("refuse un identifiant de séance invalide", async () => {
      const response = await sendJson(
        "PUT",
        "/api/session/abc",
        { name: "New name" },
        admin.token,
      );

      expect(response.status).toBe(400);
    });

    it("retourne 404 pour une séance inexistante", async () => {
      const response = await sendJson(
        "PUT",
        "/api/session/999999999",
        { name: "New name" },
        admin.token,
      );

      expect(response.status).toBe(404);
    });

    it("refuse un professeur inexistant", async () => {
      const session = await createTemporarySession();

      const response = await sendJson(
        "PUT",
        `/api/session/${session.id}`,
        { teacherId: 999999 },
        admin.token,
      );

      expect(response.status).toBe(404);
    });

    it("refuse une date invalide", async () => {
      const session = await createTemporarySession();

      const response = await sendJson(
        "PUT",
        `/api/session/${session.id}`,
        { date: "not-a-date" },
        admin.token,
      );

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/session/:id", () => {
    it("supprime réellement une séance", async () => {
      const session = await createTemporarySession();

      const response = await deleteTemporarySession(session.id);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        message: "Session deleted successfully",
      });

      const verification = await api(`/api/session/${session.id}`, {
        headers: headers(admin.token),
      });

      expect(verification.status).toBe(404);
    });

    it("refuse la suppression par un utilisateur classique", async () => {
      const session = await createTemporarySession();

      const response = await api(`/api/session/${session.id}`, {
        method: "DELETE",
        headers: headers(user.token),
      });

      expect(response.status).toBe(403);
    });

    it("refuse la suppression sans JWT", async () => {
      const response = await api("/api/session/1", {
        method: "DELETE",
      });

      expect(response.status).toBe(401);
    });

    it("refuse un identifiant invalide", async () => {
      const response = await api("/api/session/abc", {
        method: "DELETE",
        headers: headers(admin.token),
      });

      expect(response.status).toBe(400);
    });

    it("retourne 404 pour une séance inexistante", async () => {
      const response = await api("/api/session/999999999", {
        method: "DELETE",
        headers: headers(admin.token),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("Participation aux séances", () => {
    it("permet de rejoindre puis quitter une séance", async () => {
      const session = await createTemporarySession();

      const path = `/api/session/${session.id}/participate/${user.id}`;

      try {
        const joinResponse = await api(path, {
          method: "POST",
          headers: headers(user.token),
        });

        expect(joinResponse.status).toBe(200);
        expect(await joinResponse.json()).toEqual({
          message: "Successfully joined the session",
        });

        const detailsResponse = await api(`/api/session/${session.id}`, {
          headers: headers(user.token),
        });

        const details = (await detailsResponse.json()) as SessionResponse;

        expect(details.users).toContain(user.id);

        const leaveResponse = await api(path, {
          method: "DELETE",
          headers: headers(user.token),
        });

        expect(leaveResponse.status).toBe(200);
        expect(await leaveResponse.json()).toEqual({
          message: "Successfully left the session",
        });

        const updatedResponse = await api(`/api/session/${session.id}`, {
          headers: headers(user.token),
        });

        const updated = (await updatedResponse.json()) as SessionResponse;

        expect(updated.users).not.toContain(user.id);
      } finally {
        // La suppression de la séance nettoie
        // également ses participations.
        await deleteTemporarySession(session.id);
      }
    });

    it("refuse une double participation", async () => {
      const session = await createTemporarySession();

      const path = `/api/session/${session.id}/participate/${user.id}`;

      const firstResponse = await api(path, {
        method: "POST",
        headers: headers(user.token),
      });

      expect(firstResponse.status).toBe(200);

      const secondResponse = await api(path, {
        method: "POST",
        headers: headers(user.token),
      });

      expect(secondResponse.status).toBe(400);
    });

    it("interdit de participer à la place d'un autre utilisateur", async () => {
      const session = await createTemporarySession();

      const response = await api(
        `/api/session/${session.id}/participate/${admin.id}`,
        {
          method: "POST",
          headers: headers(user.token),
        },
      );

      expect(response.status).toBe(403);
    });

    it("refuse une participation sans JWT", async () => {
      const response = await api(`/api/session/1/participate/${user.id}`, {
        method: "POST",
      });

      expect(response.status).toBe(401);
    });

    it("retourne 404 pour une séance inexistante", async () => {
      const response = await api(
        `/api/session/999999999/participate/${user.id}`,
        {
          method: "POST",
          headers: headers(user.token),
        },
      );

      expect(response.status).toBe(404);
    });

    it("refuse une désinscription inexistante", async () => {
      const session = await createTemporarySession();

      const response = await api(
        `/api/session/${session.id}/participate/${user.id}`,
        {
          method: "DELETE",
          headers: headers(user.token),
        },
      );

      expect(response.status).toBe(404);
    });

    it("interdit de désinscrire un autre utilisateur", async () => {
      const session = await createTemporarySession();

      const response = await api(
        `/api/session/${session.id}/participate/${admin.id}`,
        {
          method: "DELETE",
          headers: headers(user.token),
        },
      );

      expect(response.status).toBe(403);
    });

    it("refuse une désinscription sans JWT", async () => {
      const response = await api(`/api/session/1/participate/${user.id}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(401);
    });
  });
});
