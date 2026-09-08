import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home page loads", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });

  test("jams listing shows a seeded public jam", async ({ page }) => {
    await page.goto("/jams");
    await expect(page.getByText("Ongoing Jam").first()).toBeVisible();
  });

  test("public jam detail page renders", async ({ page }) => {
    await page.goto("/jams/ongoing-jam");
    await expect(
      page.getByRole("heading", { name: "Ongoing Jam", level: 1 })
    ).toBeVisible();
  });

  test("sign-in page renders a login form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("draft jam is not publicly accessible", async ({ page }) => {
    // next dev returns 200 for notFound() pages, so assert on rendered content:
    // the 404 page shows, and the draft jam's name never appears.
    await page.goto("/jams/draft-jam");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("Draft Jam (WIP)")).toHaveCount(0);
  });
});
