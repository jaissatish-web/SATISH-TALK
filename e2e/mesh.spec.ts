import { test, expect } from "@playwright/test";
for (const count of [2, 5, 10])
  test(`synthetic WebRTC mesh ${count} peers`, async ({ page }) => {
    test.setTimeout(60000);
    page.on("pageerror", (e) => console.log("mesh-pageerror", e.message));
    page.on("console", (m) => {
      if (m.type() === "warning" || m.type() === "error")
        console.log("mesh-console", m.text());
    });
    await page.goto("/e2e/mesh.html");
    await page.getByRole("button").click();
    const started = Date.now();
    await page.evaluate(`window.meshTest.start(${count})`);
    try {
      await expect
        .poll(
          () =>
            page.evaluate(
              `window.meshTest.states.reduce((n,s)=>n+Object.values(s).filter(v=>v==='connected').length,0)`,
            ),
          { timeout: 30000 },
        )
        .toBe(count * (count - 1));
    } catch (error) {
      console.log(
        "mesh-diagnostics",
        JSON.stringify(await page.evaluate("window.meshTest.diagnostics()")),
      );
      throw error;
    }
    const connectionSetupMs = Date.now() - started;
    const keyed = Date.now();
    await page.evaluate("window.meshTest.talk()");
    await expect
      .poll(
        () =>
          page.evaluate(
            `window.meshTest.stats().then(rows=>rows.slice(1).filter(r=>r.energy>0.001&&r.packets>0).length)`,
          ),
        { timeout: 15000 },
      )
      .toBe(count - 1);
    const syntheticMediaObservedMs = Date.now() - keyed;
    const stats = await page.evaluate("window.meshTest.stats()");
    await page.evaluate(
      `window.meshTest.stats().then(rows=>{window.reverseBaseline=rows;window.meshTest.talk(${count - 1})})`,
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            `window.meshTest.stats().then(rows=>rows.slice(0,${count - 1}).filter((r,i)=>r.energy>window.reverseBaseline[i].energy+0.001).length)`,
          ),
        { timeout: 15000 },
      )
      .toBe(count - 1);
    console.log(
      JSON.stringify({
        syntheticPeers: count,
        connectionSetupMs,
        syntheticMediaObservedMs,
        stats,
      }),
    );
    await page.evaluate("window.meshTest.stop();window.meshTest.cleanup()");
    await expect(page.locator("audio")).toHaveCount(0);
  });
