import { expect, test } from "@playwright/test";

test("PingPulse smoke flow: dashboard, SSRF probe block, /demo, and public status page", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PingPulse" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Acme Core API" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Test SSRF Metadata" }).click();
  await expect(page.getByText(/SSRF guard/i).first()).toBeVisible();

  await page.getByRole("link", { name: /Status Page Pública/i }).click();
  await expect(page).toHaveURL(/\/status\/public/);
  await expect(
    page.getByText(
      /Todos los sistemas operativos|Degradación parcial|Interrupción/i,
    ),
  ).toBeVisible();
});
