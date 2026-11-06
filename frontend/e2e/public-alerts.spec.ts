import { expect, test } from "@playwright/test";

test("public alert popup treats external fields as text and repaints after basemap changes", async ({ page }) => {
  const injectedMarkup = '<img src=x onerror="window.alertXssTriggered=true">';

  await page.addInitScript(() => {
    (window as Window & { alertXssTriggered?: boolean }).alertXssTriggered = false;
  });
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false, dm: false, citizen: false, role: null, name: null }),
    })
  );
  await page.route("**/api/v1/public/incidents", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/v1/public/alerts", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          alert_id: "external-alert",
          source: injectedMarkup,
          event_type: injectedMarkup,
          severity: injectedMarkup,
          area_text: injectedMarkup,
          latitude: 23.0225,
          longitude: 72.5714,
          is_fallback: false,
          effective_at: "2026-11-06T00:00:00Z",
          expires_at: "2026-11-07T00:00:00Z",
        },
      ]),
    })
  );
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("https://*.tile.openstreetmap.fr/**", (route) => route.abort());

  await page.goto("/");

  const marker = page.locator(".custom-alert-pin");
  await expect(marker).toHaveCount(1);
  await marker.click();

  const popup = page.locator(".leaflet-popup-content");
  await expect(popup).toContainText(injectedMarkup);
  await expect(popup.locator("img, script")).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as Window & { alertXssTriggered?: boolean }).alertXssTriggered)
  ).toBe(false);

  await page.getByRole("button", { name: "Humanitarian", exact: true }).click();
  await expect(page.locator(".custom-alert-pin")).toHaveCount(1);
  await page.locator(".custom-alert-pin").click();
  await expect(popup.locator("img, script")).toHaveCount(0);
});
