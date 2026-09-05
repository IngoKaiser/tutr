import { expect, test } from "@playwright/test";

test("Startseite lädt und zeigt tutr", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("tutr");
});

test("Sicherheits-Header sind gesetzt", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["referrer-policy"]).toBeTruthy();
});
