import { afterAll, beforeAll, describe, expect, it } from "vitest";

import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server | undefined;
let baseUrl: string;

const adminEmail = "yoga@studio.com";
const adminPassword = "test!1234";

interface AuthResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  admin: boolean;
  token: string;
}

const registerData = {
  firstName: "Playwright",
  lastName: "Integration",
  email: "integration@example.com",
  password: "Password123!",
};

async function postJson(path: string, data: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
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
    throw new Error("Les tests doivent utiliser yoga_studio_e2e");
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

describe("AuthController - intégration HTTP", () => {
  describe("POST /api/auth/login", () => {
    it("connecte un utilisateur existant", async () => {
      const response = await postJson("/api/auth/login", {
        email: adminEmail,
        password: adminPassword,
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as AuthResponse;

      expect(data).toMatchObject({
        email: adminEmail,
        admin: true,
      });

      expect(data.id).toEqual(expect.any(Number));
      expect(data.token).toEqual(expect.any(String));
      expect(data).not.toHaveProperty("password");
    });

    it("retourne un JWT utilisable sur une route protégée", async () => {
      const loginResponse = await postJson("/api/auth/login", {
        email: adminEmail,
        password: adminPassword,
      });

      expect(loginResponse.status).toBe(200);

      const data = (await loginResponse.json()) as AuthResponse;

      const profileResponse = await fetch(`${baseUrl}/api/user/${data.id}`, {
        headers: {
          Authorization: `Bearer ${data.token}`,
        },
      });

      expect(profileResponse.status).toBe(200);

      const profile = await profileResponse.json();

      expect(profile).toMatchObject({
        id: data.id,
        email: adminEmail,
      });
    });

    it("refuse un mauvais mot de passe", async () => {
      const response = await postJson("/api/auth/login", {
        email: adminEmail,
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
    });

    it("refuse un utilisateur inexistant", async () => {
      const response = await postJson("/api/auth/login", {
        email: "unknown@example.com",
        password: "Password123!",
      });

      expect(response.status).toBe(401);
    });

    it("refuse une connexion sans email", async () => {
      const response = await postJson("/api/auth/login", {
        password: adminPassword,
      });

      expect(response.status).toBe(400);
    });

    it("refuse une connexion sans mot de passe", async () => {
      const response = await postJson("/api/auth/login", {
        email: adminEmail,
      });

      expect(response.status).toBe(400);
    });

    it("refuse un email de type incorrect", async () => {
      const response = await postJson("/api/auth/login", {
        email: 123,
        password: adminPassword,
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/auth/register", () => {
    it("crée un utilisateur et permet sa connexion", async () => {
      // Email court pour respecter la limite Prisma VARCHAR(50)
      const email = `a-${randomUUID().slice(0, 8)}@example.com`;

      const response = await postJson("/api/auth/register", {
        ...registerData,
        email,
      });

      expect(response.status).toBe(201);

      const user = (await response.json()) as AuthResponse;

      expect(user).toMatchObject({
        email,
        firstName: "Playwright",
        lastName: "Integration",
        admin: false,
      });

      expect(user.id).toEqual(expect.any(Number));
      expect(user.token).toEqual(expect.any(String));
      expect(user).not.toHaveProperty("password");

      try {
        // Vérification de la connexion avec le nouveau compte
        const loginResponse = await postJson("/api/auth/login", {
          email,
          password: registerData.password,
        });

        expect(loginResponse.status).toBe(200);

        const loginData = (await loginResponse.json()) as AuthResponse;

        expect(loginData.id).toBe(user.id);
        expect(loginData.email).toBe(email);

        // Vérification d'une route protégée
        const profileResponse = await fetch(`${baseUrl}/api/user/${user.id}`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        expect(profileResponse.status).toBe(200);

        const profile = await profileResponse.json();

        expect(profile).toMatchObject({
          id: user.id,
          email,
        });

        expect(profile).not.toHaveProperty("password");
      } finally {
        // Suppression du compte créé pour le test
        const deletionResponse = await fetch(`${baseUrl}/api/user/${user.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        expect(deletionResponse.status).toBe(200);
      }
    });

    it("refuse une adresse email déjà utilisée", async () => {
      const response = await postJson("/api/auth/register", {
        ...registerData,
        email: adminEmail,
      });

      expect(response.status).toBe(400);
    });

    it("refuse une inscription sans prénom", async () => {
      const response = await postJson("/api/auth/register", {
        ...registerData,
        firstName: "",
      });

      expect(response.status).toBe(400);
    });

    it("refuse une inscription sans nom", async () => {
      const response = await postJson("/api/auth/register", {
        ...registerData,
        lastName: "",
      });

      expect(response.status).toBe(400);
    });

    it("refuse une inscription sans email", async () => {
      const response = await postJson("/api/auth/register", {
        ...registerData,
        email: "",
      });

      expect(response.status).toBe(400);
    });

    it("refuse une inscription sans mot de passe", async () => {
      const response = await postJson("/api/auth/register", {
        ...registerData,
        password: "",
      });

      expect(response.status).toBe(400);
    });

    it("refuse un mot de passe trop court", async () => {
      const response = await postJson("/api/auth/register", {
        ...registerData,
        password: "123",
      });

      expect(response.status).toBe(400);
    });

    it("refuse un format d'email invalide", async () => {
      const response = await postJson("/api/auth/register", {
        ...registerData,
        email: "not-an-email",
      });

      expect(response.status).toBe(400);
    });
  });
});
