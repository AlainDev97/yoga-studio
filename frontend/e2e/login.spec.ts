import { test, expect } from "@playwright/test";

test.describe("Login - E2E", () => {
  test("affiche le formulaire de connexion", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", {
        name: "Login to Yoga Studio",
      }),
    ).toBeVisible();

    await expect(page.locator('input[type="email"]')).toBeVisible();

    await expect(page.locator('input[type="password"]')).toBeVisible();

    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("empêche la connexion avec des champs vides", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/login$/);

    const email = page.locator('input[type="email"]');
    const password = page.locator('input[type="password"]');

    await expect(email).toHaveAttribute("required", "");
    await expect(password).toHaveAttribute("required", "");

    expect(
      await email.evaluate(
        (element: HTMLInputElement) => element.validity.valueMissing,
      ),
    ).toBe(true);
  });

  test("permet de naviguer vers Register", async ({ page }) => {
    await page.goto("/login");

    await page
      .getByRole("link", {
        name: "Register here",
      })
      .click();

    await expect(page).toHaveURL(/\/register$/);

    await expect(
      page.getByRole("heading", {
        name: "Register for Yoga Studio",
      }),
    ).toBeVisible();
  });
});
