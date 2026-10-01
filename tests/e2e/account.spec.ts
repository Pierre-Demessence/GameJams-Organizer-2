import { test, expect, type Page } from "@playwright/test";

// Uses the seeded account (prisma/seed.ts: alice@example.com / password123).
async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("alice@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
}

test.describe("signed-in account menu", () => {
  test("links to the profile and settings", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Your profile" }).click();
    await expect(page).toHaveURL(/\/users\/alice$/);
    await expect(page.getByRole("heading", { level: 1, name: "Alice" })).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  });

  test("switches the theme and remembers it", async ({ page }) => {
    await signIn(page);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });

  test("fits the mobile header at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    const logo = page.getByRole("link", { name: "GameJam Organizer" });
    const box = await logo.boundingBox();
    // One line of text: the logo link stays the 44px touch-target height.
    expect(box?.height).toBeLessThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
