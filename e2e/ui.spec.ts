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
    await expect(page.getByLabel("Private invitation token")).toHaveValue(
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
  await expect(page.getByLabel("Private invitation token")).toHaveValue("a".repeat(43));
  await expect(page.getByLabel("Channel access code")).toHaveValue("test-private-code");
  await expect(page.getByRole("switch", {name: "Walkie-Talkie Mode"})).not.toBeChecked();
  await page.getByRole("navigation").getByRole("button", {name: "Settings"}).click();
  await page.getByRole("button", {name: "Leave channel"}).click();
  await page.reload();
  await expect(page.getByLabel("Private invitation token")).toHaveValue("");
  await expect(page.getByLabel("Channel access code")).toHaveValue("");
});
