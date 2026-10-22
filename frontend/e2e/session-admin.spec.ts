import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:5173/api";

const ADMIN_EMAIL = "yoga@studio.com";
const USER_EMAIL = "user@test.com";
const PASSWORD = "test!1234";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);

  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/sessions$/);
}

async function getToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("token"));

  expect(token).toBeTruthy();
  return token!;
}

async function deleteSession(
  request: APIRequestContext,
  id: number,
  token: string,
): Promise<void> {
  const response = await request.delete(`${API_URL}/session/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  expect(
    response.ok(),
    `Nettoyage impossible : HTTP ${response.status()}`,
  ).toBe(true);
}

test.describe("Sessions - E2E administrateur", () => {
  test("affiche les actions administrateur", async ({ page }) => {
    await login(page, ADMIN_EMAIL);

    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Create Session" }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Delete" }).first(),
    ).toBeVisible();
  });

  test("crée, modifie et supprime une séance", async ({ page, request }) => {
    await login(page, ADMIN_EMAIL);

    const token = await getToken(page);
    const name = `Yoga E2E ${Date.now()}`;

    let createdId: number | undefined;
    let deleted = false;

    try {
      // CRÉATION
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Create Session" })
        .click();

      await expect(
        page.getByRole("heading", {
          name: "Create New Session",
        }),
      ).toBeVisible();

      await page
        .getByRole("textbox", {
          name: "Session Name",
        })
        .fill(name);

      await page.locator('input[type="date"]').fill("2026-11-15");

      await page
        .getByRole("combobox", {
          name: "Teacher",
        })
        .selectOption("1");

      await page
        .getByRole("textbox", {
          name: "Description",
        })
        .fill("Séance créée par Playwright");

      const [createResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/session") &&
            response.request().method() === "POST",
        ),
        page
          .getByRole("button", {
            name: "Create Session",
          })
          .click(),
      ]);

      expect(createResponse.ok()).toBe(true);

      const created = await createResponse.json();
      createdId = created.id;

      expect(createdId).toEqual(expect.any(Number));

      await expect(page).toHaveURL(/\/sessions$/);

      await expect(page.getByRole("heading", { name })).toBeVisible();

      // MODIFICATION
      const sessionCard = page.getByRole("heading", { name }).locator("..");

      await sessionCard.getByRole("link", { name: "View Details" }).click();

      await page.getByRole("button", { name: "Edit" }).click();

      await expect(
        page.getByRole("heading", { name: "Edit Session" }),
      ).toBeVisible();

      await page
        .getByRole("textbox", {
          name: "Session Name",
        })
        .fill(`${name} Updated`);

      await page
        .getByRole("textbox", {
          name: "Description",
        })
        .fill("Description modifiée par Playwright");

      await page
        .getByRole("button", {
          name: "Update Session",
        })
        .click();

      await expect(page).toHaveURL(/\/sessions$/);

      await expect(
        page.getByRole("heading", {
          name: `${name} Updated`,
        }),
      ).toBeVisible();

      // SUPPRESSION
      await page
        .getByRole("heading", {
          name: `${name} Updated`,
        })
        .locator("..")
        .getByRole("link", { name: "View Details" })
        .click();

      page.once("dialog", (dialog) => dialog.accept());

      const [deleteResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "DELETE" &&
            response.url().includes(`/api/session/${createdId}`) &&
            !response.url().includes("/participate/"),
        ),
        page.getByRole("button", { name: "Delete" }).click(),
      ]);

      expect(deleteResponse.ok()).toBe(true);
      deleted = true;

      await expect(page).toHaveURL(/\/sessions$/);

      await expect(
        page.getByRole("heading", {
          name: `${name} Updated`,
        }),
      ).toHaveCount(0);
    } finally {
      // Nettoyage garanti si une assertion intermédiaire échoue
      if (createdId !== undefined && !deleted) {
        await deleteSession(request, createdId, token);
      }
    }
  });

  test("empêche la création avec des champs vides", async ({ page }) => {
    await login(page, ADMIN_EMAIL);

    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Create Session" })
      .click();

    await page.getByRole("button", { name: "Create Session" }).click();

    await expect(page).toHaveURL(/\/sessions\/create$/);

    const nameInput = page.getByRole("textbox", {
      name: "Session Name",
    });

    expect(
      await nameInput.evaluate(
        (element: HTMLInputElement) => element.validity.valueMissing,
      ),
    ).toBe(true);
  });

  test("empêche la modification avec un nom vide", async ({ page }) => {
    await login(page, ADMIN_EMAIL);

    // Nous consultons une séance seedée sans la modifier.
    await page.goto("/sessions/edit/1");

    await expect(
      page.getByRole("textbox", { name: "Session Name" }),
    ).toHaveValue("Yoga Vinyasa");

    const nameInput = page.getByRole("textbox", {
      name: "Session Name",
    });

    await nameInput.fill("");

    await page
      .getByRole("button", {
        name: "Update Session",
      })
      .click();

    await expect(page).toHaveURL(/\/sessions\/edit\/1$/);

    expect(
      await nameInput.evaluate(
        (element: HTMLInputElement) => element.validity.valueMissing,
      ),
    ).toBe(true);
  });

  test("redirige un utilisateur classique hors du formulaire admin", async ({
    page,
  }) => {
    await login(page, USER_EMAIL);

    await page.goto("/sessions/create");

    await expect(page).toHaveURL(/\/sessions$/);

    await expect(
      page.getByRole("link", { name: "Create Session" }),
    ).toHaveCount(0);
  });
});
