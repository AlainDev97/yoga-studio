import { test, expect } from "@playwright/test";

const API_URL = "http://127.0.0.1:5173/api";

test.describe("Register - E2E avec backend réel", () => {
  test("inscrit un utilisateur et lui donne accès aux séances", async ({
    page,
    request,
  }) => {
    // Email unique pour éviter les conflits entre exécutions
    const email = `e2e-${Date.now()}@example.com`;
    const password = "Password123!";

    let createdUserId: number | undefined;
    let token: string | undefined;

    try {
      await page.goto("/register");

      await page.locator('input[name="firstName"]').fill("Playwright");
      await page.locator('input[name="lastName"]').fill("Test");
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(password);

      // Attend la vraie réponse HTTP du backend
      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("/api/auth/register") &&
            res.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Register" }).click(),
      ]);

      expect([200, 201]).toContain(response.status());

      // L'utilisateur est redirigé vers les séances
      await expect(page).toHaveURL(/\/sessions$/);

      await expect(
        page.getByRole("heading", { name: "Yoga Sessions" }),
      ).toBeVisible();

      // Vérifie les données enregistrées dans le navigateur
      const stored = await page.evaluate(() => ({
        token: localStorage.getItem("token"),
        user: localStorage.getItem("user"),
      }));

      expect(stored.token).toBeTruthy();
      expect(stored.user).toBeTruthy();

      const savedUser = JSON.parse(stored.user!);

      expect(savedUser.email).toBe(email);
      expect(savedUser.firstName).toBe("Playwright");
      expect(savedUser.admin).toBe(false);

      createdUserId = savedUser.id;
      token = stored.token!;

      // Vérifie que le compte existe réellement côté API
      const profileResponse = await request.get(
        `${API_URL}/user/${createdUserId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      expect(profileResponse.ok()).toBe(true);

      const profile = await profileResponse.json();
      expect(profile.email).toBe(email);
    } finally {
      if (createdUserId !== undefined && token) {
        const deletion = await request.delete(
          `${API_URL}/user/${createdUserId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        console.log("DELETE status:", deletion.status());
        console.log("DELETE body:", await deletion.text());

        expect(
          deletion.ok(),
          `La suppression a échoué avec HTTP ${deletion.status()}`,
        ).toBe(true);
      }
    }
  });
});
