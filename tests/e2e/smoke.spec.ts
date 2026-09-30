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

  test("markdown descriptions are styled by the typography plugin", async ({
    page,
  }) => {
    await page.goto("/jams/ongoing-jam");
    // The seeded fullDesc renders an h1 (demoted to h2) plus a paragraph inside .prose.
    // Without @tailwindcss/typography, preflight collapses heading font-size to the
    // paragraph size, so a larger heading proves the prose styles are active.
    const heading = page.locator(".prose h2").first();
    const paragraph = page.locator(".prose p").first();
    await expect(heading).toBeVisible();
    await expect(paragraph).toBeVisible();
    const headingSize = await heading.evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize)
    );
    const paragraphSize = await paragraph.evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize)
    );
    expect(headingSize).toBeGreaterThan(paragraphSize);
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

  test("the page is dark when no theme is stored", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(11, 12, 14)");
  });

  test("a stored light theme is applied", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(250, 250, 250)");
  });

  test("homepage shows the hero and the live panel", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Game jams/ })).toBeVisible();
    await expect(page.getByText("Live now")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ongoing Jam" }).first()).toBeVisible();
  });

  test("jam list filters by status through the URL", async ({ page }) => {
    await page.goto("/jams?status=live");
    await expect(page.getByRole("link", { name: /Live/ }).first()).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Ongoing Jam" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Upcoming Jam" })).toHaveCount(0);
  });

  test("hostile list parameters fall back to the default list", async ({ page }) => {
    const response = await page.goto(`/jams?status=nope&show=99999&q=${"a".repeat(300)}`);
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "Jams" })).toBeVisible();
  });

  test("jam page has overview and submissions tabs", async ({ page }) => {
    await page.goto("/jams/ongoing-jam");
    const tabs = page.getByRole("navigation", { name: "Jam sections" });
    await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: /Submissions/ }).click();
    await expect(page).toHaveURL(/\/jams\/ongoing-jam\/submissions$/);
    await expect(tabs.getByRole("link", { name: /Submissions/ })).toHaveAttribute("aria-current", "page");
  });
});
