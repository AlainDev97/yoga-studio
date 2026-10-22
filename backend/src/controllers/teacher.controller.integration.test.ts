import { beforeAll, afterAll, describe, expect, it } from "vitest";

import dotenv from "dotenv";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

let server: Server;
let baseUrl: string;
let token: string;

beforeAll(async () => {
  // Charger explicitement la configuration E2E
  const result = dotenv.config({
    path: ".env.e2e",
    override: true,
  });

  if (result.error) {
    throw new Error("Impossible de charger backend/.env.e2e");
  }

  // Empêcher toute utilisation de la base de développement
  const databaseUrl = process.env.DATABASE_URL ?? "";

  const databaseName = new URL(databaseUrl).pathname.slice(1);

  if (databaseName !== "yoga_studio_e2e") {
    throw new Error("Tests d'intégration interdits hors de yoga_studio_e2e");
  }

  process.env.NODE_ENV = "test";

  // Import après configuration des variables d'environnement
  const { default: app } = await import("../app");

  // Port 0 : le système choisit un port disponible
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, "127.0.0.1");
    server.once("error", reject);
    server.once("listening", resolve);
  });

  const address = server.address() as AddressInfo;

  baseUrl = `http://127.0.0.1:${address.port}`;

  // Authentification réelle avec le compte du seed E2E
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "yoga@studio.com",
      password: "test!1234",
    }),
  });

  if (!response.ok) {
    throw new Error(`Connexion E2E impossible : HTTP ${response.status}`);
  }

  const data = (await response.json()) as { token: string };

  token = data.token;
}, 30000);

afterAll(async () => {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

describe("TeacherController - intégration HTTP", () => {
  it("retourne tous les professeurs avec un JWT valide", async () => {
    const response = await fetch(`${baseUrl}/api/teacher`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);

    const teachers = (await response.json()) as Array<{
      id: number;
      firstName: string;
      lastName: string;
    }>;

    expect(Array.isArray(teachers)).toBe(true);
    expect(teachers.length).toBeGreaterThanOrEqual(3);

    expect(teachers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          firstName: "Margot",
          lastName: "Delahaye",
        }),
      ]),
    );
  });

  it("retourne un professeur avec son identifiant", async () => {
    const response = await fetch(`${baseUrl}/api/teacher/1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);

    const teacher = await response.json();

    expect(teacher).toMatchObject({
      id: 1,
      firstName: "Margot",
      lastName: "Delahaye",
    });
  });

  it("retourne 401 sans token JWT", async () => {
    const response = await fetch(`${baseUrl}/api/teacher`);

    expect(response.status).toBe(401);
  });

  it("refuse un JWT invalide", async () => {
    const response = await fetch(`${baseUrl}/api/teacher`, {
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });

    expect(response.status).toBe(401);
  });

  it("retourne 400 pour un identifiant non numérique", async () => {
    const response = await fetch(`${baseUrl}/api/teacher/abc`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(400);
  });

  it("retourne 400 pour un identifiant négatif", async () => {
    const response = await fetch(`${baseUrl}/api/teacher/-1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(400);
  });

  it("retourne 400 pour un identifiant nul", async () => {
    const response = await fetch(`${baseUrl}/api/teacher/0`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(400);
  });

  it("retourne 404 lorsqu'un professeur n'existe pas", async () => {
    const response = await fetch(`${baseUrl}/api/teacher/999999`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(404);
  });
});
