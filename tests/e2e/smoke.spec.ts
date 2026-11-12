import { expect, test } from '@playwright/test';

const cubeState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({ ...(window as any).__crail.state.cube }));

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  (page as any).__errors = errors;
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__crail?.state.cube);
});

test.afterEach(async ({ page }) => {
  expect((page as any).__errors).toEqual([]);
});

test('boots with every feature on and draws the cube', async ({ page }) => {
  await expect(page.locator('#day')).toHaveText('Day 0');
  const meta = await page.evaluate(() => (window as any).__crail.features.map((f: any) => f.id));
  expect(meta).toEqual(['000-world', '000-cube']);
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
  expect(ids).toEqual(['000-world']);
});
