import { test, expect } from "@playwright/test";

const EMAIL = "user@test.com";
const PASSWORD = "test!1234";

test.describe("Sessions - E2E utilisateur classique", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);

    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/sessions$/);
  });

  test("affiche les séances depuis PostgreSQL", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Yoga Sessions" }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Yoga Vinyasa" }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Yoga Hatha" }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "Yin Yoga" })).toBeVisible();
  });

  test("affiche les détails d'une séance", async ({ page }) => {
    await page
      .getByRole("heading", { name: "Yoga Vinyasa" })
      .locator("..")
      .getByRole("link", { name: "View Details" })
      .click();

    await expect(page).toHaveURL(/\/sessions\/\d+$/);

    await expect(
      page.getByRole("heading", { name: "Yoga Vinyasa" }),
    ).toBeVisible();

    await expect(page.getByText(/Margot Delahaye/)).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Back to Sessions" }),
    ).toBeVisible();
  });

  test("masque les actions administrateur", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: "Create Session" }),
    ).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await page
      .getByRole("heading", { name: "Yoga Hatha" })
      .locator("..")
      .getByRole("link", { name: "View Details" })
      .click();

    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  });

  test("permet de rejoindre puis quitter une séance", async ({ page }) => {
    await page
      .getByRole("heading", { name: "Yin Yoga" })
      .locator("..")
      .getByRole("link", { name: "View Details" })
      .click();

    const joinButton = page.getByRole("button", {
      name: "Join Session",
    });

    const leaveButton = page.getByRole("button", {
      name: "Leave Session",
    });

    await expect(joinButton).toBeVisible();

    await joinButton.click();

    await expect(leaveButton).toBeVisible();

    await leaveButton.click();

    await expect(joinButton).toBeVisible();
  });
});
