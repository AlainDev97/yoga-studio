import { test, expect, type APIRequestContext } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.e2e" });

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:5173/api";

type TestAccount = {
  id: number;
  email: string;
  password: string;
  token: string;
};

async function createTestAccount(
  request: APIRequestContext,
): Promise<TestAccount> {
  const email = `e2e-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const password = "Password123!";

  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      firstName: "Playwright",
      lastName: "Login",
      email,
      password,
    },
  });

  const responseBody = await response.text();

  expect(
    response.ok(),
    `Création du compte E2E échouée :
   HTTP ${response.status()}
   Réponse : ${responseBody}`,
  ).toBe(true);

  const data = JSON.parse(responseBody);

  return {
    id: data.id,
    email,
    password,
    token: data.token,
  };
}

async function deleteTestAccount(
  request: APIRequestContext,
  account: TestAccount,
): Promise<void> {
  const response = await request.delete(`${API_URL}/user/${account.id}`, {
    headers: {
      Authorization: `Bearer ${account.token}`,
    },
  });

  expect(response.ok()).toBe(true);
}

test.describe("Login - E2E backend réel", () => {
  test("connecte un utilisateur avec ses identifiants", async ({
    page,
    request,
  }) => {
    const account = await createTestAccount(request);

    try {
      await page.goto("/login");

      await page.locator('input[type="email"]').fill(account.email);
      await page.locator('input[type="password"]').fill(account.password);

      await page.getByRole("button", { name: "Login" }).click();

      await expect(page).toHaveURL(/\/sessions$/);

      await expect(
        page.getByRole("heading", { name: "Yoga Sessions" }),
      ).toBeVisible();

      const token = await page.evaluate(() => localStorage.getItem("token"));

      expect(token).toBeTruthy();
    } finally {
      await deleteTestAccount(request, account);
    }
  });

  test("refuse un mot de passe incorrect", async ({ page, request }) => {
    const account = await createTestAccount(request);

    try {
      await page.goto("/login");

      await page.locator('input[type="email"]').fill(account.email);
      await page.locator('input[type="password"]').fill("WrongPassword123");

      await page.getByRole("button", { name: "Login" }).click();

      await expect(page).toHaveURL(/\/login$/);

      await expect(page.getByText("Invalid credentials")).toBeVisible();

      expect(
        await page.evaluate(() => localStorage.getItem("token")),
      ).toBeNull();
    } finally {
      await deleteTestAccount(request, account);
    }
  });

  test("refuse la connexion avec un email inconnu", async ({ page }) => {
    await page.goto("/login");

    await page
      .locator('input[type="email"]')
      .fill(`unknown-${crypto.randomUUID()}@example.com`);

    await page.locator('input[type="password"]').fill("Password123!");

    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/login$/);

    await expect(page.getByText("Invalid credentials")).toBeVisible();
  });

  test("déconnecte l'utilisateur depuis la Navbar", async ({
    page,
    request,
  }) => {
    const account = await createTestAccount(request);

    try {
      await page.goto("/login");

      await page.locator('input[type="email"]').fill(account.email);
      await page.locator('input[type="password"]').fill(account.password);

      await page.getByRole("button", { name: "Login" }).click();

      await expect(page).toHaveURL(/\/sessions$/);

      await page.getByRole("button", { name: "Logout" }).click();

      await expect(page).toHaveURL(/\/login$/);

      const stored = await page.evaluate(() => ({
        token: localStorage.getItem("token"),
        user: localStorage.getItem("user"),
      }));

      expect(stored.token).toBeNull();
      expect(stored.user).toBeNull();
    } finally {
      await deleteTestAccount(request, account);
    }
  });

  test("redirige vers Login si une page privée est consultée sans connexion", async ({
    page,
  }) => {
    await page.goto("/sessions");

    await expect(page).toHaveURL(/\/login$/);

    await expect(
      page.getByRole("heading", { name: "Login to Yoga Studio" }),
    ).toBeVisible();
  });
});
