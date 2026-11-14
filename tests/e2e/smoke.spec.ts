import { expect, test } from '@playwright/test';

const cubeState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({ ...(window as any).__crail.state.cube }));

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  (page as any).__errors = errors;
  await page.goto('/?day=0');
  await page.waitForFunction(() => (window as any).__crail?.state.cube);
});

test.afterEach(async ({ page }) => {
  expect((page as any).__errors).toEqual([]);
});

test('day 0 still boots and draws the cube', async ({ page }) => {
  await expect(page.locator('#day')).toHaveText('Day 0');
  const meta = await page.evaluate(() => (window as any).__crail.features.map((f: any) => f.id));
  expect(meta).toEqual(['000-world', '000-cube']);
  expect(await page.evaluate(() => (window as any).__crail.state.goths)).toBeUndefined();
  // The centre of the screen must be cube-red, not floor.
  await page.waitForTimeout(300);
  const shot = await page.locator('canvas').screenshot();
  const [r, g, b] = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    // Slightly above centre: the cube's top/side faces.
    return Array.from(ctx.getImageData(img.width / 2, img.height / 2 - img.height * 0.03, 1, 1).data);
  }, shot.toString('base64'));
  expect(r).toBeGreaterThan(110);
  expect(r - b).toBeGreaterThan(80);
  expect(r - g).toBeGreaterThan(50);
});

test('keys roll the cube one cell at a time', async ({ page }) => {
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => (window as any).__crail.state.cube.x >= 3);
  await page.keyboard.up('KeyD');
  await page.waitForFunction(() => !(window as any).__crail.state.cube.moving);
  const s = await cubeState(page);
  expect(s.z).toBe(0);
  expect(Number.isInteger(s.x)).toBe(true);
  expect(s.rolls).toBe(s.x);
  await expect(page.locator('#hint')).toHaveClass(/gone/);
});

test('tapping the floor sends the cube there', async ({ page }) => {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.36);
  await page.waitForFunction(() => (window as any).__crail.state.cube.rolls > 0);
  await page.waitForFunction(() => !(window as any).__crail.state.cube.moving);
  const s = await cubeState(page);
  // Up-right on screen is -z in the world.
  expect(s.z).toBeLessThan(0);
  expect(s.rolls).toBe(Math.abs(s.x) + Math.abs(s.z));
});

test('time machine and rollback switches work', async ({ page }) => {
  await page.goto('/?off=000-cube');
  await page.waitForFunction(() => (window as any).__crail);
  const ids = await page.evaluate(() => (window as any).__crail.features.map((f: any) => f.id));
  expect(ids).toEqual(['000-world', '001-goth-baddies', '002-femboys']);
  await page.goto('/?off=002-femboys');
  await page.waitForFunction(() => (window as any).__crail);
  await expect(page.locator('#day')).toHaveText('Day 1');
  await page.goto('/?day=1');
  await page.waitForFunction(() => (window as any).__crail);
  expect(await page.evaluate(() => (window as any).__crail.state.femboys)).toBeUndefined();
});

// ---- Day 1: goth baddies -------------------------------------------------

const open = async (page: import('@playwright/test').Page, query = '') => {
  await page.goto('/' + query);
  await page.waitForFunction(() => (window as any).__crail?.state.goths);
};
const direct = (page: import('@playwright/test').Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as any).__crail.direct(n, ...(a as unknown[])), [name, args] as const);
/** Hold a key until a condition on the game state (as `s`) becomes true, then let go. */
const holdUntil = async (page: import('@playwright/test').Page, key: string, condition: string) => {
  await page.keyboard.down(key);
  await page.waitForFunction(`(() => { const s = window.__crail.state; return ${condition}; })()`);
  await page.keyboard.up(key);
};
const clearStage = async (page: import('@playwright/test').Page) => {
  for (const cast of ['goths', 'femboys']) {
    await direct(page, `${cast}.staged`, true);
    await direct(page, `${cast}.clear`);
  }
};
const goth = (page: import('@playwright/test').Page, i = 0) =>
  page.evaluate((i) => {
    const n = (window as any).__crail.state.goths.npcs[i];
    return { x: n.x, z: n.z, mode: n.mode, emote: n.emote?.kind ?? null };
  }, i);

test('boots with every feature on: day 2, five goths, four femboys, credits name the winners', async ({ page }) => {
  await open(page);
  await expect(page.locator('#day')).toHaveText('Day 2');
  expect(await page.evaluate(() => (window as any).__crail.state.femboys.npcs.length)).toBe(4);
  expect(await page.evaluate(() => (window as any).__crail.state.goths.npcs.length)).toBe(5);
  await page.locator('#day').click();
  await expect(page.locator('#credits')).toContainText('@yugi_aman_e');
  await expect(page.locator('#credits')).toContainText('AWESOME! Add Goth baddies');
  await expect(page.locator('#credits')).toContainText('@angelwingss._');
});

test('the cube cannot roll through a goth, and bumping her three times gets it rejected', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 0, 1, 0, 2, { idle: 999 });
  const modes: string[] = [];
  for (let i = 1; i <= 3; i++) {
    await holdUntil(page, 'KeyD', `s.cube.bonks >= ${i}`);
    await page.waitForTimeout(600);
    modes.push((await goth(page)).mode);
    expect(await cubeState(page)).toMatchObject({ x: 0, z: 0, rolls: 0 });
  }
  expect(modes).toEqual(['stare', 'snub', 'huff']);
  await page.waitForFunction(() => (window as any).__crail.state.goths.npcs[0].x >= 5);
});

test('a goth walking into the cube stops and stares instead of walking through', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 2, -3, 0, 0, { steps: 8 });
  await page.waitForFunction(() => (window as any).__crail.state.goths.npcs[0].mode === 'stare');
  expect(await goth(page)).toMatchObject({ x: -1, z: 0, emote: 'dots' });
});

test('the secret: a goth sits on the cube, it struggles free, she lands on the floor', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 4, -2, 0, 0, { idle: 999 });
  await direct(page, 'goths.do', 0, 'sit');
  await page.waitForFunction(() => (window as any).__crail.state.goths.npcs[0].mode === 'sit');
  expect((await cubeState(page)).pinned).toBe(true);
  for (let i = 1; i <= 3; i++) {
    await holdUntil(page, 'KeyS', `s.cube.struggles >= ${i}`);
    expect(await cubeState(page)).toMatchObject({ x: 0, z: 0 });
    await page.waitForTimeout(250);
  }
  await holdUntil(page, 'KeyS', 's.cube.rolls >= 1');
  await page.waitForFunction(() => (window as any).__crail.state.goths.npcs[0].mode === 'plop');
  const c = await cubeState(page);
  expect(c).toMatchObject({ x: 0, pinned: false });
  expect(c.z).toBeGreaterThanOrEqual(1);
  expect(await goth(page)).toMatchObject({ x: 0, z: 0 });
});

test('goths wander for a while without errors or overlaps', async ({ page }) => {
  await open(page, '?seed=11');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(2500);
  const cells = await page.evaluate(() => {
    const s = (window as any).__crail.state;
    return [`${s.cube.x},${s.cube.z}`, ...[...s.goths.npcs, ...s.femboys.npcs].map((n: any) => `${n.x},${n.z}`)];
  });
  expect(new Set(cells).size).toBe(cells.length);
});

// ---- Day 2: femboys --------------------------------------------------------

const femboy = (page: import('@playwright/test').Page, i = 0) =>
  page.evaluate((i) => (window as any).__crail.state.femboys.npcs[i].mode, i);

test('bumping a femboy three times gets the cube a bow instead of a broken heart', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'femboys.spawn', 0, 1, 0, 2, { idle: 999 });
  const modes: string[] = [];
  for (let i = 1; i <= 3; i++) {
    await holdUntil(page, 'KeyD', `s.cube.bonks >= ${i}`);
    await page.waitForTimeout(500);
    modes.push(await femboy(page));
    expect(await cubeState(page)).toMatchObject({ x: 0, z: 0, rolls: 0 });
  }
  expect(modes).toEqual(['giggle', 'pat', 'gift']);
  await page.waitForFunction(() => (window as any).__crail.state.cubeBow.on);
});

test('a femboy waves at a goth and leaves her with a bow', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'cube.teleport', 8, 8);
  await direct(page, 'goths.spawn', 0, 1, 0, 2, { idle: 999 });
  await direct(page, 'femboys.spawn', 0, -2, 0, 0, { steps: 8 });
  await direct(page, 'femboys.do', 0, 'gift');
  await page.waitForFunction(() => (window as any).__crail.state.femboys.npcs[0].mode === 'wave');
  await page.waitForFunction(() => (window as any).__crail.state.goths.npcs[0].mode === 'stare');
  expect(await page.evaluate(() => (window as any).__crail.state.goths.npcs[0].focus)).toEqual({ x: 0, z: 0 });
});
