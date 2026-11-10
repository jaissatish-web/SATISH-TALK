import { test, expect } from "@playwright/test";
for (const viewport of [
  { width: 360, height: 800 },
  { width: 800, height: 360 },
  { width: 1280, height: 900 },
]) {
  test(`offline radio responsive ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route("**/*.convex.cloud/**", (route) => route.abort());
    await page.routeWebSocket("**/*.convex.cloud/**", (ws) => ws.close());
    await page.goto("/#invite=test-invitation-not-a-real-secret");
    await expect(
      page.getByRole("heading", { name: "Instrumentation Team" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Hold to talk" }),
    ).toBeDisabled();
    await expect(page.getByLabel("Invitation code")).toHaveValue(
      "test-invitation-not-a-real-secret",
    );
    expect(new URL(page.url()).hash).toBe("");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Settings" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Radio settings" }),
    ).toBeVisible();
    await page.getByText("About us", {exact: true}).click();
    await expect(page.getByRole("heading", {name: "Satish Kumar Jaiswal"})).toBeVisible();
    const portrait = page.getByRole("img", {name: "Satish Kumar Jaiswal, creator of Satish Talk"});
    await expect(portrait).toBeVisible();
    await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole("switch", { name: "Keep Screen Awake" }).check();
    await expect(
      page.getByRole("switch", { name: "Keep Screen Awake" }),
    ).toBeChecked();
    await page.getByRole("switch", { name: "Keep Screen Awake" }).uncheck();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Members" })
      .click();
    await expect(
      page.getByText("Turn Walkie-Talkie Mode on to see your team."),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("remembered access restores after reload and leave erases it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("satish-talk:remembered-access", JSON.stringify({token: "a".repeat(43),code: "test-private-code"})));
  await page.reload();
  await expect(page.getByLabel("Invitation code")).toHaveValue("a".repeat(43));
  await expect(page.getByLabel("2. Channel access code", { exact: true })).toHaveValue("test-private-code");
  await expect(page.getByRole("button", {name: "Go online"})).toBeVisible();
  await page.getByRole("navigation").getByRole("button", {name: "Settings"}).click();
  await page.getByRole("button", {name: "Leave channel"}).click();
  await page.reload();
  await expect(page.getByLabel("Invitation code")).toHaveValue("");
  await expect(page.getByLabel("2. Channel access code", { exact: true })).toHaveValue("");
});

test("mode responds immediately while joining and can cancel", async ({ page }) => {
  await page.route("**/*.convex.cloud/**", async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.abort();
  });
  await page.goto("/");
  await expect(page.getByRole("button", {name: "Go online"})).toBeDisabled();
  await page.getByLabel("Name").fill("Test member");
  await page.getByLabel("Invitation code").fill("a".repeat(43));
  await page.getByLabel("2. Channel access code", { exact: true }).fill("test-private-code");
  await page.getByRole("button", {name: "Go online"}).click();
  await expect(page.getByRole("button", {name: "Cancel connection"})).toBeVisible();
  await expect(page.getByText("Connecting…", {exact: true}).last()).toBeVisible();
  await expect(page.getByRole("button", {name: "Hold to talk"})).toBeDisabled();
  await page.getByRole("button", {name: "Cancel connection"}).click();
  await expect(page.getByRole("button", {name: "Go online"})).toBeVisible();
  await expect(page.getByText("Radio is offline", {exact:true})).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(page.getByRole("button", {name: "Go online"})).toBeVisible();
});
