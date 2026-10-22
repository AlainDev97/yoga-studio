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

let server: Server | undefined;
let baseUrl: string;
let admin: AuthResponse;

const ADMIN_EMAIL = "yoga@studio.com";
const ADMIN_PASSWORD = "test!1234";

function authHeaders(token: string = admin.token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function registerTemporaryUser(): Promise<AuthResponse> {
  const email = `u-${randomUUID().slice(0, 8)}@example.com`;

  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: "Password123!",
      firstName: "Temporary",
      lastName: "User",
    }),
  });

  expect(response.status).toBe(201);

  return (await response.json()) as AuthResponse;
}

async function deleteTemporaryUser(user: AuthResponse) {
  return fetch(`${baseUrl}/api/user/${user.id}`, {
    method: "DELETE",
    headers: authHeaders(user.token),
  });
}

beforeAll(async () => {
  const result = dotenv.config({
    path: ".env.e2e",
    override: true,
  });

  if (result.error) {
    throw new Error("Impossible de charger .env.e2e");
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databaseName = new URL(databaseUrl).pathname.slice(1);

  if (databaseName !== "yoga_studio_e2e") {
    throw new Error("Tests interdits hors de la base yoga_studio_e2e");
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

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  expect(response.status).toBe(200);

  admin = (await response.json()) as AuthResponse;
}, 30000);

afterAll(async () => {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server!.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

describe("UserController - intégration HTTP", () => {
  describe("GET /api/user/:id", () => {
    it("retourne les informations d'un utilisateur existant", async () => {
      const response = await fetch(`${baseUrl}/api/user/${admin.id}`, {
        headers: authHeaders(),
      });

      expect(response.status).toBe(200);

      const user = await response.json();

      expect(user).toMatchObject({
        id: admin.id,
        email: ADMIN_EMAIL,
        admin: true,
      });
    });

    it("n'expose jamais le mot de passe", async () => {
      const response = await fetch(`${baseUrl}/api/user/${admin.id}`, {
        headers: authHeaders(),
      });

      expect(response.status).toBe(200);

      const user = await response.json();

      expect(user).not.toHaveProperty("password");
    });

    it("refuse une consultation sans JWT", async () => {
      const response = await fetch(`${baseUrl}/api/user/${admin.id}`);

      expect(response.status).toBe(401);
    });

    it("refuse un JWT invalide", async () => {
      const response = await fetch(`${baseUrl}/api/user/${admin.id}`, {
        headers: authHeaders("invalid-token"),
      });

      expect(response.status).toBe(401);
    });

    it("refuse un identifiant non numérique", async () => {
      const response = await fetch(`${baseUrl}/api/user/abc`, {
        headers: authHeaders(),
      });

      expect(response.status).toBe(400);
    });

    it("refuse un identifiant nul", async () => {
      const response = await fetch(`${baseUrl}/api/user/0`, {
        headers: authHeaders(),
      });

      expect(response.status).toBe(400);
    });

    it("refuse un identifiant négatif", async () => {
      const response = await fetch(`${baseUrl}/api/user/-1`, {
        headers: authHeaders(),
      });

      expect(response.status).toBe(400);
    });

    it("retourne 404 si l'utilisateur n'existe pas", async () => {
      const response = await fetch(`${baseUrl}/api/user/999999999`, {
        headers: authHeaders(),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/user/:id", () => {
    it("permet à un utilisateur de supprimer son propre compte", async () => {
      const temporaryUser = await registerTemporaryUser();
      let deleted = false;

      try {
        const response = await deleteTemporaryUser(temporaryUser);

        expect(response.status).toBe(200);

        const result = await response.json();

        expect(result).toEqual({
          message: "User deleted successfully",
        });

        deleted = true;

        const verification = await fetch(
          `${baseUrl}/api/user/${temporaryUser.id}`,
          { headers: authHeaders() },
        );

        expect(verification.status).toBe(404);
      } finally {
        if (!deleted) {
          await deleteTemporaryUser(temporaryUser);
        }
      }
    });

    it("interdit de supprimer le compte d'un autre utilisateur", async () => {
      const temporaryUser = await registerTemporaryUser();

      try {
        const response = await fetch(`${baseUrl}/api/user/${admin.id}`, {
          method: "DELETE",
          headers: authHeaders(temporaryUser.token),
        });

        expect(response.status).toBe(403);

        // Le compte administrateur doit toujours exister.
        const verification = await fetch(`${baseUrl}/api/user/${admin.id}`, {
          headers: authHeaders(),
        });

        expect(verification.status).toBe(200);
      } finally {
        const cleanup = await deleteTemporaryUser(temporaryUser);
        expect(cleanup.status).toBe(200);
      }
    });

    it("refuse une suppression sans authentification", async () => {
      const response = await fetch(`${baseUrl}/api/user/${admin.id}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(401);
    });

    it("refuse un JWT invalide pour supprimer", async () => {
      const response = await fetch(`${baseUrl}/api/user/${admin.id}`, {
        method: "DELETE",
        headers: authHeaders("invalid-token"),
      });

      expect(response.status).toBe(401);
    });

    it("refuse un identifiant invalide", async () => {
      const response = await fetch(`${baseUrl}/api/user/abc`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      expect(response.status).toBe(400);
    });

    it("retourne 404 pour un compte inexistant", async () => {
      // Le service vérifie d'abord que l'identité du JWT
      // correspond à l'identifiant demandé.
      // On utilise donc un compte temporaire supprimé.
      const temporaryUser = await registerTemporaryUser();

      const deletion = await deleteTemporaryUser(temporaryUser);
      expect(deletion.status).toBe(200);

      const response = await deleteTemporaryUser(temporaryUser);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/user/promote-admin", () => {
    it("interdit la promotion en environnement test", async () => {
      const response = await fetch(`${baseUrl}/api/user/promote-admin`, {
        method: "POST",
        headers: authHeaders(),
      });

      expect(response.status).toBe(403);
    });

    it("refuse la promotion sans authentification", async () => {
      const response = await fetch(`${baseUrl}/api/user/promote-admin`, {
        method: "POST",
      });

      expect(response.status).toBe(401);
    });

    it("refuse la promotion avec un JWT invalide", async () => {
      const response = await fetch(`${baseUrl}/api/user/promote-admin`, {
        method: "POST",
        headers: authHeaders("invalid-token"),
      });

      expect(response.status).toBe(401);
    });
  });
});
