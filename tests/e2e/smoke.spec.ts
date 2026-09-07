import { expect, test } from "@playwright/test";

test("Startseite leitet auf Heute", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/heute$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Heute");
});

test("Sicherheits-Header sind gesetzt", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["referrer-policy"]).toBeTruthy();
});
