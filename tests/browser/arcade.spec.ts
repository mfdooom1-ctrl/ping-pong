import { test, expect, type Page } from "@playwright/test";
const state = (p: Page) =>
  p.evaluate(() => (window as any).__SPIN_CITY__?.getState());
async function quick(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "START GAME" }).click();
  await page.getByRole("button", { name: "LET'S PLAY" }).click();
  await expect(page.locator("#hud")).toBeVisible();
}
test("title, real serve, point, pause and restart", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await quick(page);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#score-you")).toHaveText("0");
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).state).toBe("playing");
  await expect
    .poll(
      async () => {
        const s = await state(page);
        return s.score[0] + s.score[1];
      },
      { timeout: 18000 },
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "PAUSED", exact: true }),
  ).toBeVisible();
  const a = await state(page);
  await page.waitForTimeout(250);
  const b = await state(page);
  expect(b.ball).toEqual(a.ball);
  expect(b.clock).toBe(a.clock);
  await page.getByRole("button", { name: "BACK TO THE TABLE" }).click();
  await expect(
    page.getByRole("heading", { name: "PAUSED", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "RESTART MATCH" }).click();
  await expect(page.locator("#score-you")).toHaveText("0");
  await expect(page.locator("#score-ai")).toHaveText("0");
  expect((await state(page)).state).toBe("ready");
  expect(errors).toEqual([]);
});
test("all shot choices and eight service styles are reachable", async ({
  page,
}) => {
  await quick(page);
  await page.locator("#shot-label").click();
  await expect(page.locator(".shot-grid button")).toHaveCount(17);
  await page
    .getByRole("button", { name: "FOREHAND LOOP", exact: false })
    .click();
  await expect(page.locator("#shot-label")).toContainText("FOREHAND LOOP");
  const styles = new Set<string>();
  for (let i = 0; i < 8; i++) {
    styles.add(await page.locator("#serve-style").innerText());
    await page.locator("#serve-style").click();
  }
  expect(styles.size).toBe(8);
});
test("keyboard returns sustain a rally and audio runs after a gesture", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("./");
  await page.getByRole("button", { name: "TRAINING", exact: true }).click();
  await page.getByRole("button", { name: "LET'S PRACTICE" }).click();
  await page.locator("#shot-label").click();
  await page.getByRole("button", { name: "BLOCK", exact: false }).click();
  await page.keyboard.press("Space");
  // Schedule input in the browser's animation frames: a WebDriver round trip can
  // exceed a paddle's timing window on a software-rendered CI worker. This sends
  // ordinary keyboard events through Controls; it never moves the ball or scores.
  await page.evaluate(() => {
    let stopped = false,
      swung = "";
    (window as any).__stopRallyTest = () => {
      stopped = true;
    };
    const press = () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "Space",
          bubbles: true,
          cancelable: true,
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keyup", { code: "Space", bubbles: true }),
      );
    };
    const tick = () => {
      if (stopped) return;
      const s = (window as any).__SPIN_CITY__.getState();
      if (s.state === "ready" && s.server === 0) {
        swung = "";
        press();
      }
      if (s.state === "playing" && s.ball.v.y > 0 && s.bounces > 0) {
        const eta = (s.players[0].y - 0.12 - s.ball.p.y) / s.ball.v.y;
        const key = s.score.join(":") + "/" + s.rally;
        if (eta < 0.12 && eta > -0.02 && key !== swung) {
          swung = key;
          press();
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await expect
    .poll(async () => (await state(page)).stats.returns, {
      timeout: 45000,
      intervals: [150],
    })
    .toBeGreaterThanOrEqual(2);
  await page.evaluate(() => (window as any).__stopRallyTest());
  const audio = await page.evaluate(() =>
    (window as any).__SPIN_CITY__.getAudioState(),
  );
  expect(audio.state).toBe("running");
  expect(audio.sequencerStep).toBeGreaterThan(8);
  expect((await state(page)).bestRally).toBeGreaterThanOrEqual(4);
});
test("story, tournament, training, challenges and roster launch actual courts", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: /^STORY/ }).click();
  await expect(page.locator(".story-copy")).toBeVisible();
  await page.getByRole("button", { name: "ENTER THE CLUB" }).click();
  expect((await state(page)).config.mode).toBe("story");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "SAVE & MAIN MENU" }).click();
  await page.getByRole("button", { name: "TRAINING", exact: true }).click();
  await page.getByRole("button", { name: /TOPSPIN LAB/ }).click();
  await page.getByRole("button", { name: "LET'S PRACTICE" }).click();
  expect((await state(page)).config.mode).toBe("training");
  await expect(page.locator("#shot-label")).toContainText("TOPSPIN");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "SAVE & MAIN MENU" }).click();
  await page.getByRole("button", { name: "START GAME" }).click();
  await page.getByRole("button", { name: "TOURNAMENT" }).click();
  await expect(page.locator(".bracket-round")).toHaveCount(3);
  await page.getByRole("button", { name: "PLAY QUARTER-FINAL" }).click();
  expect((await state(page)).config.mode).toBe("tournament");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "SAVE & MAIN MENU" }).click();
  await page.getByRole("button", { name: "START GAME" }).click();
  await page.getByRole("button", { name: "CHALLENGES" }).click();
  await page.getByRole("button", { name: /KEEP IT ALIVE/ }).click();
  expect((await state(page)).config.mode).toBe("challenge");
});
test("progress/options and live match survive a reload", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "OPTIONS", exact: true }).click();
  await page.locator('[data-option="leftHanded"]').check();
  await page.locator('[data-option="sensitivity"]').fill("1.5");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await quick(page);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).state).toBe("playing");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const saved = await state(page);
  await page.reload();
  await page.getByRole("button", { name: "CONTINUE SAVED MATCH" }).click();
  const loaded = await state(page);
  expect(loaded.ball).toEqual(saved.ball);
  expect(loaded.paused).toBe(true);
  expect(loaded.config.options.leftHanded).toBe(true);
  expect(loaded.config.options.sensitivity).toBe(1.5);
});
test("all production resources cache and the full game launches offline", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await expect(page.getByRole("button", { name: "START GAME" })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await new Promise<void>((resolve) => {
      if (navigator.serviceWorker.controller) resolve();
      else
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
    });
  });
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(
      keys.find((k) => k.startsWith("spin-city-"))!,
    );
    return (await cache.keys()).map((r) => r.url);
  });
  expect(cached.some((u) => u.endsWith("characters.png"))).toBe(true);
  expect(cached.some((u) => u.endsWith("portrait-kim.png"))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "START GAME" })).toBeVisible();
  await page.getByRole("button", { name: "START GAME" }).click();
  await page.getByRole("button", { name: "LET'S PLAY" }).click();
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(page)).state).toBe("playing");
  await context.setOffline(false);
});
test.describe("iPhone-size touch viewport (Chromium emulation)", () => {
  test.use({
    viewport: { width: 874, height: 402 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  test("simultaneous stick and swing use distinct pointer IDs", async ({
    page,
    context,
  }) => {
    await quick(page);
    const box = (await page.locator("#game-input").boundingBox())!;
    const session = await context.newCDPSession(page);
    const left = {
      x: box.x + box.width * 0.15,
      y: box.y + box.height * 0.7,
      id: 1,
    };
    const right = {
      x: box.x + box.width * 0.85,
      y: box.y + box.height * 0.65,
      id: 2,
    };
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [left, right],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...left, x: left.x + 37 }, right],
    });
    await expect
      .poll(async () => (await state(page)).input.x)
      .toBeGreaterThan(0.4);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [right],
    });
    await expect.poll(async () => (await state(page)).state).toBe("toss");
    expect((await state(page)).input.x).toBeGreaterThan(0.4);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(async () => (await state(page)).input.x).toBe(0);
    const bounds = await page.locator(".pause-button").boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(43);
    expect(bounds!.height).toBeGreaterThanOrEqual(43);
    await page.screenshot({ path: "test-results/iphone-landscape.png" });
  });
  test("portrait shows a rotation guide without forcing orientation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 402, height: 874 });
    await page.goto("./");
    await expect(page.locator("#rotate")).toBeVisible();
    await expect(page.locator("#rotate")).toContainText("TURN UP THE CITY");
  });
});

test('wide mobile viewport fills the screen and accepts gestures at its right edge', async ({ page }) => {
  await page.setViewportSize({ width: 874, height: 402 });
  await quick(page);
  const app = (await page.locator('#app').boundingBox())!;
  const canvas = (await page.locator('canvas').boundingBox())!;
  expect(app.width).toBe(874); expect(app.height).toBe(402);
  expect(canvas.width).toBe(874); expect(canvas.height).toBe(402);
  const input = (await page.locator('#game-input').boundingBox())!;
  expect(input.x).toBeLessThanOrEqual(1);
  expect(input.x + input.width).toBeGreaterThanOrEqual(873);
  await page.mouse.click(861, 240);
  await expect.poll(async () => (await state(page)).state).toBe('toss');
  const dimensions = await page.evaluate(() => ({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}));
  expect(dimensions).toEqual({w:874,h:402});
  await page.screenshot({ path:'test-results/assisted-wide.png' });
});

for (const [arena, name] of [[0,'vegas'],[1,'new-york'],[3,'miami'],[4,'tokyo'],[6,'belgrade']] as const) {
  test(`colorful ${name} court renders on a wide mobile viewport`, async ({page}) => {
    await page.setViewportSize({width:874,height:402});
    await page.addInitScript(() => {
      localStorage.setItem('spin-city-v1', JSON.stringify({version:1,arenas:Array.from({length:12},(_,i)=>i)}));
    });
    await page.goto('./');
    await page.getByRole('button',{name:'START GAME'}).click();
    await page.locator(`[data-action="arena"][data-value="${arena}"]`).click();
    await page.getByRole('button',{name:"LET'S PLAY"}).click();
    await expect(page.locator('#hud')).toBeVisible();
    expect((await state(page)).config.arena).toBe(arena);
    await page.screenshot({path:`test-results/court-${name}.png`});
  });
}
