import { test, expect } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:5173/api";

const EMAIL = "user@test.com";
const PASSWORD = "test!1234";

test.describe("Profile - E2E", () => {
  test("affiche les informations du compte", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/sessions$/);

    await page.getByRole("link", { name: "Profile" }).click();

    await expect(
      page.getByRole("heading", { name: "My Profile" }),
    ).toBeVisible();

    await expect(page.getByText("John", { exact: true })).toBeVisible();
    await expect(page.getByText("Doe", { exact: true })).toBeVisible();
    await expect(page.getByText(EMAIL)).toBeVisible();
    await expect(page.getByText("User", { exact: true })).toBeVisible();
  });

  test("revient aux séances depuis le profil", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/sessions$/);

    await page.getByRole("link", { name: "Profile" }).click();

    await page
      .getByRole("button", {
        name: "Back to Sessions",
      })
      .click();

    await expect(page).toHaveURL(/\/sessions$/);
    await expect(
      page.getByRole("heading", { name: "Yoga Sessions" }),
    ).toBeVisible();
  });

  test("protège la page profil sans authentification", async ({ page }) => {
    await page.goto("/profile");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("conserve le compte si la suppression est annulée", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/sessions$/);

    await page.getByRole("link", { name: "Profile" }).click();

    await expect(
      page.getByRole("heading", { name: "My Profile" }),
    ).toBeVisible();

    page.once("dialog", (dialog) => dialog.dismiss());

    await page
      .getByRole("button", {
        name: "Delete Account",
      })
      .click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText(EMAIL)).toBeVisible();
  });

  test("supprime réellement un compte temporaire", async ({
    page,
    request,
  }) => {
    const email = `p-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const password = "Password123!";

    const registration = await request.post(`${API_URL}/auth/register`, {
      data: {
        firstName: "Playwright",
        lastName: "Profile",
        email,
        password,
      },
    });

    expect(registration.ok()).toBe(true);

    const account = await registration.json();
    let deleted = false;

    try {
      await page.goto("/login");

      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);

      await page.getByRole("button", { name: "Login" }).click();

      await expect(page).toHaveURL(/\/sessions$/);

      await page.getByRole("link", { name: "Profile" }).click();

      await expect(page.getByText(email)).toBeVisible();

      page.once("dialog", (dialog) => dialog.accept());

      const [deletion] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "DELETE" &&
            response.url().includes(`/api/user/${account.id}`),
        ),
        page
          .getByRole("button", {
            name: "Delete Account",
          })
          .click(),
      ]);

      expect(deletion.ok()).toBe(true);
      deleted = true;

      await expect(page).toHaveURL(/\/login$/);

      expect(
        await page.evaluate(() => localStorage.getItem("token")),
      ).toBeNull();

      const profileResponse = await request.get(
        `${API_URL}/user/${account.id}`,
        {
          headers: {
            Authorization: `Bearer ${account.token}`,
          },
        },
      );

      expect(profileResponse.ok()).toBe(false);
    } finally {
      if (!deleted) {
        const cleanup = await request.delete(`${API_URL}/user/${account.id}`, {
          headers: {
            Authorization: `Bearer ${account.token}`,
          },
        });

        expect(cleanup.ok()).toBe(true);
      }
    }
  });
});
