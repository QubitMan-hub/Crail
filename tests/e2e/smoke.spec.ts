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
  const shot = await page.locator('#game canvas').screenshot();
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
  const box = (await page.locator('#game canvas').boundingBox())!;
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
  expect(ids).toEqual(['000-world', '001-goth-baddies', '002-femboys', '003-supreme-leader', '003-park', '003-cube-cult', '004-octopus']);
  await page.goto('/?day=2&off=002-femboys');
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
  await direct(page, 'octopus.staged', true);
  for (const cast of ['goths', 'femboys', 'soldiers', 'leader']) {
    await direct(page, `${cast}.staged`, true);
    await direct(page, `${cast}.clear`);
  }
};
const goth = (page: import('@playwright/test').Page, i = 0) =>
  page.evaluate((i) => {
    const n = (window as any).__crail.state.goths.npcs[i];
    return { x: n.x, z: n.z, mode: n.mode, emote: n.emote?.kind ?? null };
  }, i);

test('boots with every feature on: day 3, goths, femboys, a leader, credits name the winners', async ({ page }) => {
  await open(page);
  await expect(page.locator('#day')).toHaveText('Day 4');
  expect(await page.evaluate(() => (window as any).__crail.state.leader.npcs.length)).toBe(1);
  await expect(page.locator('#credits')).toContainText('@gyarados117');
  await expect(page.locator('#credits')).toContainText('@megamouse173');
  await expect(page.locator('#credits')).toContainText('add a small park with rides');
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
    return [`${s.cube.x},${s.cube.z}`, ...[...s.goths.npcs, ...s.femboys.npcs, ...s.leader.npcs, ...s.soldiers.npcs].map((n: any) => `${n.x},${n.z}`)];
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

// ---- Day 3: the leader builds a military ------------------------------------

test('the leader builds soldiers, and an alarm sends them to box the cube in', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'leader.spawn', 0, 3, 0, 2, { idle: 0.2 });
  await direct(page, 'leader.build');
  await page.waitForFunction(() => (window as any).__crail.state.soldiers.npcs.length === 1);
  await direct(page, 'leader.build');
  await page.waitForFunction(() => (window as any).__crail.state.soldiers.npcs.length === 2);
  // Sound the alarm with the cube well away from the column.
  const at = await page.evaluate(() => {
    const n = (window as any).__crail.state.leader.npcs[0];
    return { x: n.x, z: n.z };
  });
  await direct(page, 'cube.teleport', at.x + 4, at.z + 3);
  await direct(page, 'leader.alarm');
  await page.waitForFunction(() => {
    const s = (window as any).__crail.state;
    return s.soldiers.npcs.every((n: any) => Math.abs(n.x - s.cube.x) + Math.abs(n.z - s.cube.z) === 1);
  });
});

test('the rocket goes up and comes straight back down', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'leader.spawn', 0, 3, 0, 2, { idle: 999 });
  await direct(page, 'leader.site');
  expect(await page.evaluate(() => (window as any).__crail.state.rocket.built)).toBe(true);
  await direct(page, 'leader.launch');
  await page.waitForFunction(() => (window as any).__crail.state.leader.npcs[0].mode === 'fume');
  // The pad is solid: the cube cannot roll onto it.
  const pad = await page.evaluate(() => {
    const r = (window as any).__crail.state.rocket;
    return { x: r.x, z: r.z };
  });
  await direct(page, 'cube.teleport', pad.x, pad.z + 1);
  await holdUntil(page, 'KeyW', 's.cube.bonks >= 1');
  expect(await cubeState(page)).toMatchObject({ x: pad.x, z: pad.z + 1 });
});

// ---- Day 3 picks: the park and the cult --------------------------------------

test('rolling into a ride takes the cube for a ride and earns a charm', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, '?seed=3');
  await clearStage(page);
  // Next to the trampoline, then roll into it.
  await direct(page, 'cube.teleport', 15, 9);
  await holdUntil(page, 'KeyW', 's.park.riding !== null');
  expect(await page.evaluate(() => (window as any).__crail.state.park.riding)).toBe('trampoline');
  expect((await cubeState(page)).carried).toBe(true);
  await page.waitForFunction(() => (window as any).__crail.state.park.rides === 1);
  // Back where it started, free to move, one charm richer.
  expect(await cubeState(page)).toMatchObject({ x: 15, z: 9, carried: false, pinned: false });
  expect(await page.evaluate(() => (window as any).__crail.state.cult.charms)).toBe(1);
  await expect(page.locator('#cult')).toContainText('1');
});

test('preaching: stand still beside someone with a charm and they join; bumping recruits nobody', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'femboys.spawn', 0, 0, 1, 3, { idle: 999 });
  // Bumping, even with a charm in hand, only gets the old reaction.
  await direct(page, 'cult.charms', 1);
  await holdUntil(page, 'KeyS', 's.cube.bonks >= 1');
  await page.waitForFunction(() => (window as any).__crail.state.femboys.npcs[0].mode === 'giggle');
  expect(await page.evaluate(() => (window as any).__crail.state.cult.members.length)).toBe(0);
  // Standing still does it. The sermon shows its progress, then he joins and the charm is spent.
  await page.waitForFunction(() => (window as any).__crail.state.cult.preaching !== null);
  await page.waitForFunction(() => (window as any).__crail.state.cult.members.length === 1);
  expect(await page.evaluate(() => (window as any).__crail.state.femboys.npcs[0].cult)).toBe(true);
  expect(await page.evaluate(() => (window as any).__crail.state.cult.charms)).toBe(0);
  await expect(page.locator('#cult')).toContainText('Cult 1');
  // A goth costs two. With one charm no sermon starts, and the game says why.
  await direct(page, 'goths.spawn', 0, 1, 0, 2, { idle: 999 });
  await direct(page, 'cult.charms', 1);
  await expect(page.locator('#hint')).toContainText('Goths cost', { timeout: 15_000 });
  expect(await page.evaluate(() => (window as any).__crail.state.goths.npcs[0].cult)).toBe(false);
  // Roll away: the recruit comes along.
  await holdUntil(page, 'KeyA', 's.cube.x <= -5');
  await page.waitForFunction(() => {
    const s = (window as any).__crail.state;
    const n = s.femboys.npcs[0];
    return Math.abs(n.x - s.cube.x) + Math.abs(n.z - s.cube.z) <= 3;
  });
});

test('preaching: moving away before the ring fills costs nothing', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 0, 1, 0, 2, { idle: 999 });
  await direct(page, 'cult.charms', 2);
  await page.waitForFunction(() => ((window as any).__crail.state.cult.preaching?.progress ?? 0) > 0.15);
  await holdUntil(page, 'KeyA', 's.cube.x <= -3');
  await page.waitForFunction(() => (window as any).__crail.state.cult.preaching === null);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const s = (window as any).__crail.state;
    return { charms: s.cult.charms, members: s.cult.members.length, goth: s.goths.npcs[0].cult };
  });
  expect(after).toEqual({ charms: 2, members: 0, goth: false });
});

test('other characters get on the rides too, and get off again', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 0, 16, -4, 3, { idle: 999 });
  await direct(page, 'femboys.spawn', 0, 15, 5, 1, { idle: 999 });
  await direct(page, 'leader.spawn', 0, 29, 4, 1, { idle: 999 });
  await direct(page, 'park.board', 'goths', 0, 'carousel');
  await direct(page, 'park.board', 'femboys', 0, 'trampoline');
  await direct(page, 'park.board', 'leader', 0, 'swing');
  expect(await page.evaluate(() => (window as any).__crail.state.park.riders)).toBe(3);
  const riding = await page.evaluate(() => {
    const s = (window as any).__crail.state;
    return [s.goths.npcs[0], s.femboys.npcs[0]].map((n: any) => ({ mode: n.mode, carried: n.carry !== null }));
  });
  expect(riding).toEqual([{ mode: 'riding', carried: true }, { mode: 'riding', carried: true }]);
  // Their cells stay theirs while they are up there: the cube cannot take the goth's spot.
  await direct(page, 'cube.teleport', 16, -3);
  await holdUntil(page, 'KeyW', 's.cube.bonks >= 1');
  expect(await cubeState(page)).toMatchObject({ x: 16, z: -3 });
  await page.waitForFunction(() => (window as any).__crail.state.park.npcRides === 3);
  const after = await page.evaluate(() => {
    const s = (window as any).__crail.state;
    return [s.goths.npcs[0], s.femboys.npcs[0]].map((n: any) => ({ x: n.x, z: n.z, carried: n.carry !== null }));
  });
  expect(after).toEqual([{ x: 16, z: -4, carried: false }, { x: 15, z: 5, carried: false }]);
});

// ---- Balance and extras ---------------------------------------------------------

test('recruiting has a price: a goth costs two charms, and the same ride will not pay twice in a row', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 0, 1, 0, 2, { idle: 999 });
  await direct(page, 'cult.charms', 1);
  // One charm is not enough: no sermon starts, the charm is kept, and the game says why.
  await expect(page.locator('#hint')).toContainText('Goths cost');
  expect(await page.evaluate(() => (window as any).__crail.state.cult.preaching)).toBeNull();
  expect(await page.evaluate(() => (window as any).__crail.state.cult.members.length)).toBe(0);
  expect(await page.evaluate(() => (window as any).__crail.state.cult.charms)).toBe(1);

  await direct(page, 'cult.charms', 0);
  await direct(page, 'cube.teleport', 15, 9);
  for (const rides of [1, 2]) {
    await holdUntil(page, 'KeyW', 's.park.riding !== null');
    await page.waitForFunction((n) => (window as any).__crail.state.park.rides === n, rides);
  }
  // Two rides on the trampoline, one charm.
  expect(await page.evaluate(() => (window as any).__crail.state.cult.charms)).toBe(1);
});

test('the leader cannot be recruited, however many charms the cube has', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'leader.spawn', 0, 1, 0, 2, { idle: 999 });
  await direct(page, 'leader.soldier');
  await direct(page, 'cult.charms', 6);
  // Standing beside him with a full purse gets nowhere, and the game says so.
  await expect(page.locator('#hint')).toContainText('answers to no one');
  // Bumping him gets what it always got: he points, and the alarm goes up.
  await holdUntil(page, 'KeyD', 's.cube.bonks >= 1');
  await page.waitForFunction(() => (window as any).__crail.state.leader.npcs[0].mode === 'order');
  const after = await page.evaluate(() => {
    const s = (window as any).__crail.state;
    return { charms: s.cult.charms, members: s.cult.members.length, leader: s.leader.npcs[0].cult, soldier: s.soldiers.npcs[0].cult };
  });
  expect(after).toMatchObject({ members: 0, leader: false });
});

test('one statue only, with a flag and guards who leave their posts when the cube meddles', async ({ page }) => {
  test.setTimeout(150_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'leader.spawn', 0, 3, 0, 2, { idle: 999 });
  await direct(page, 'leader.statue');
  const first = await page.evaluate(() => ({ ...(window as any).__crail.state.army.monument }));
  await direct(page, 'leader.statue');
  const second = await page.evaluate(() => ({ ...(window as any).__crail.state.army.monument }));
  expect([second.x, second.z]).toEqual([first.x, first.z]);
  await direct(page, 'leader.flag');
  await direct(page, 'leader.guard');
  await direct(page, 'leader.guard');
  expect(await page.evaluate(() => (window as any).__crail.state.army.guards)).toBe(2);
  // Both walk to a post beside the statue and stay there.
  const posted = () =>
    page.waitForFunction(() => {
      const s = (window as any).__crail.state;
      return s.soldiers.npcs.every((n: any) => n.post && n.x === n.post.x && n.z === n.post.z);
    });
  await posted();
  // With the leader, the flag and both guards round it, the statue is hemmed in.
  // Bump the flag instead: it drops to half mast and the guards come for the cube.
  const at = await page.evaluate(() => ({ ...(window as any).__crail.state.army.flag }));
  await direct(page, 'cube.teleport', at.x, at.z - 1);
  await holdUntil(page, 'KeyS', 's.cube.bonks >= 1');
  expect(await page.evaluate(() => (window as any).__crail.state.soldiers.npcs.every((n: any) => n.alert > 0))).toBe(true);
  expect(await page.evaluate(() => (window as any).__crail.state.army.flag.lowered)).toBeGreaterThan(0.5);
  await expect(page.locator('#hint')).toContainText('Half mast');
  await page.waitForFunction(() => (window as any).__crail.state.soldiers.npcs.every((n: any) => n.alert <= 0));
  await direct(page, 'cube.teleport', at.x + 6, at.z + 6);
  await posted();
});

test('the temple ordains members into ranks', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '?seed=3');
  await clearStage(page);
  for (const [i, x] of [-1, 0, 1, 2].entries()) await direct(page, 'femboys.spawn', i, x, 3, 1, { idle: 999 });
  // Recruit all four directly, then visit the temple.
  await direct(page, 'cult.charms', 4);
  await page.evaluate(() => {
    const s = (window as any).__crail.state;
    for (const m of [...s.everyone]) s.cult.tryRecruit(m);
  });
  expect(await page.evaluate(() => (window as any).__crail.state.cult.members.length)).toBe(4);
  await direct(page, 'cube.teleport', -11, -2);
  await holdUntil(page, 'KeyW', 's.cube.bonks >= 1');
  const ranks = await page.evaluate(() => [...(window as any).__crail.state.cult.ranks.values()]);
  expect(ranks).toEqual(['high', 'priest', 'priest', 'acolyte']);
  await expect(page.locator('#hint')).toContainText('1 high priest, 2 priests, 1 acolyte');
});

test('the leader can put up a statue and build a tank, and sometimes the rocket works', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'leader.spawn', 0, 3, 0, 2, { idle: 999 });
  await direct(page, 'leader.statue');
  await direct(page, 'leader.tank');
  await direct(page, 'leader.site');
  const army = await page.evaluate(() => {
    const s = (window as any).__crail.state;
    return { statue: s.army.monument.built, soldiers: s.soldiers.npcs.length, pad: s.rocket.built };
  });
  expect(army).toEqual({ statue: true, soldiers: 1, pad: true });
  await page.waitForFunction(() => (window as any).__crail.state.army.tank === true);
  // The statue is solid.
  const at = await page.evaluate(() => (window as any).__crail.state.army.monument);
  await direct(page, 'cube.teleport', at.x, at.z + 1);
  await holdUntil(page, 'KeyW', 's.cube.bonks >= 1');
  expect(await cubeState(page)).toMatchObject({ x: at.x, z: at.z + 1 });
  // Force a successful launch: he celebrates instead of fuming.
  await direct(page, 'leader.launch', 'success');
  await page.waitForFunction(() => (window as any).__crail.state.rocket.successes === 1);
  await page.waitForFunction(() => (window as any).__crail.state.leader.npcs[0].mode === 'twirl');
});

// ---- The map --------------------------------------------------------------------

test('M opens a map of places and people, and closes it again', async ({ page }) => {
  await open(page, '?seed=3');
  await expect(page.locator('#map')).toBeHidden();
  await page.keyboard.press('KeyM');
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#map canvas')).toBeVisible();
  const places = await page.evaluate(() => (window as any).__crail.state.landmarks.filter((m: any) => !m.hidden));
  expect(places.map((m: any) => m.name)).toEqual(expect.arrayContaining(['Park', 'Temple']));
  // The map names places, not commenters, and does not mark the rides.
  expect(places.every((m: any) => !('credit' in m) && !('marks' in m))).toBe(true);
  // Something was actually drawn: the cube's red square is in the middle of the canvas.
  const [r, g, b] = await page.evaluate(() => {
    const c = document.querySelector('#map canvas') as HTMLCanvasElement;
    return Array.from(c.getContext('2d')!.getImageData(c.width / 2, c.height / 2, 1, 1).data);
  });
  expect(r).toBeGreaterThan(200);
  expect(r - b).toBeGreaterThan(120);
  expect(g).toBeLessThan(140);
  // The button works too, for phones, and the cube does not move when the map is tapped.
  await page.keyboard.press('KeyM');
  await expect(page.locator('#map')).toBeHidden();
  await page.locator('#map-btn').click();
  await expect(page.locator('#map')).toBeVisible();
  await page.locator('#map').click();
  await expect(page.locator('#map')).toBeHidden();
  expect(await cubeState(page)).toMatchObject({ x: 0, z: 0, rolls: 0 });
});

// ---- Second pass on day 3 -------------------------------------------------------

test('a direction key gets the cube off a ride early, but half a ride earns no charm', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'cube.teleport', 15, 9);
  await holdUntil(page, 'KeyW', 's.park.riding !== null');
  await page.waitForTimeout(900);
  await holdUntil(page, 'KeyD', 's.park.riding === null');
  expect(await cubeState(page)).toMatchObject({ carried: false, pinned: false });
  expect(await page.evaluate(() => (window as any).__crail.state.cult.charms)).toBe(0);
  await expect(page.locator('#hint')).toContainText('got off early');
});

test('a recruit keeps their own colours under the robe', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 0, 2, 2, 1, { idle: 999 });
  await direct(page, 'femboys.spawn', 0, -2, 2, 1, { idle: 999 });
  await direct(page, 'cult.recruit', 'goths', 0);
  await direct(page, 'cult.recruit', 'femboys', 0);
  const kept = await page.evaluate(() =>
    (window as any).__crail.state.everyone.map((m: any) => ({
      kind: m.rig.identity.kind,
      cult: m.n.cult,
      robe: m.rig.root.userData.robe,
      same: m.rig.root.userData.robe.trim === m.rig.identity.trim && m.rig.root.userData.robe.hair === m.rig.identity.hair,
      loose: m.rig.sway.filter((p: any) => !m.rig.hang.includes(p)).every((p: any) => p.visible),
    })),
  );
  expect(kept.map((k: any) => [k.kind, k.cult, k.same, k.loose])).toEqual([
    ['goth', true, true, true],
    ['femboy', true, true, true],
  ]);
  // And the two robes are not the same robe.
  expect(kept[0].robe).not.toEqual(kept[1].robe);
});

test('a blast flattens whoever is near it, throws the cube and costs a charm', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 0, 1, 1, 1, { idle: 999 });
  await direct(page, 'femboys.spawn', 0, -5, 5, 1, { idle: 999 });
  await direct(page, 'cult.charms', 2);
  await direct(page, 'leader.blast', 0, 1, 2);
  expect(await page.evaluate(() => (window as any).__crail.state.goths.npcs[0].mode)).toBe('floored');
  expect(await page.evaluate(() => (window as any).__crail.state.femboys.npcs[0].mode)).not.toBe('floored');
  expect(await page.evaluate(() => (window as any).__crail.state.cult.charms)).toBe(1);
  // The cube lands somewhere else, on a free cell, and can move again.
  await page.waitForFunction(() => {
    const c = (window as any).__crail.state.cube;
    return !c.moving && !c.pinned && (c.x !== 0 || c.z !== 0);
  });
  // She gets up again.
  await page.waitForFunction(() => (window as any).__crail.state.goths.npcs[0].mode !== 'floored');
});

test('with a cult of three, the rocket is aimed: a warning, then it lands where the cube was', async ({ page }) => {
  test.setTimeout(150_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'leader.spawn', 0, 6, 0, 2, { idle: 999 });
  await direct(page, 'leader.site');
  await direct(page, 'cult.charms', 3);
  await direct(page, 'leader.launch', 'strike');
  // Stay put: it hits, and he is delighted.
  await page.waitForFunction(() => (window as any).__crail.state.rocket.strikes === 1, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__crail.state.cult.charms)).toBe(2);
  expect(await page.evaluate(() => (window as any).__crail.state.rocket.hits)).toBe(1);
  // Next time, roll out of the ring: it misses and he fumes.
  await page.waitForFunction(() => (window as any).__crail.state.rocket.phase === 'idle' && !(window as any).__crail.state.cube.moving, null, { timeout: 30_000 });
  const before = await cubeState(page);
  await direct(page, 'leader.launch', 'strike');
  await page.waitForFunction(() => /aimed at you/.test(document.querySelector('#hint')!.textContent ?? ''), null, { timeout: 30_000 });
  await direct(page, 'cube.teleport', before.x - 6, before.z + 6);
  await page.waitForFunction(() => (window as any).__crail.state.rocket.strikes === 2, null, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as any).__crail.state.cult.charms)).toBe(2);
  expect(await page.evaluate(() => (window as any).__crail.state.rocket.hits)).toBe(1);
});

test('he conscripts a passer-by, and preaching wins them back', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'leader.spawn', 0, 5, 0, 2, { idle: 999 });
  await direct(page, 'femboys.spawn', 0, 5, 2, 1, { idle: 999 });
  await direct(page, 'leader.conscript');
  const drafted = () => page.evaluate(() => {
    const m = (window as any).__crail.state.everyone.find((e: any) => e.n.persona.kind === 'femboy');
    return { drafted: m.n.drafted, helmet: !!m.rig.head.getObjectByName('helmet'), cult: m.n.cult };
  });
  expect(await drafted()).toEqual({ drafted: true, helmet: true, cult: false });
  await page.waitForFunction(() => (window as any).__crail.state.army.conscripts === 1);
  await direct(page, 'cult.recruit', 'femboys', 0);
  expect(await drafted()).toEqual({ drafted: false, helmet: false, cult: true });
});

// ---- Day 4: the octopus ---------------------------------------------------------

test('the octopus robs people, keeps it on its rock, and the cube can give it all back', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 0, 2, 8, 1, { idle: 999 });
  await direct(page, 'octopus.staged', false);
  await direct(page, 'octopus.steal', 'goth');
  await page.waitForFunction(() => (window as any).__crail.state.octopus.carrying.length >= 1);
  expect(await page.evaluate(() => (window as any).__crail.state.octopus.carrying[0])).toContain('goth');
  // It takes its haul home and puts it on the rock.
  await page.waitForFunction(() => (window as any).__crail.state.octopus.stash.length >= 1, null, { timeout: 60_000 });
  await direct(page, 'octopus.staged', true);
  await page.waitForFunction(() => (window as any).__crail.state.octopus.mode === 'lurk', null, { timeout: 30_000 });
  // Bumping it at home gets a hint; bumping the rock gets everything back.
  await direct(page, 'cube.teleport', 3, 16);
  await holdUntil(page, 'KeyW', 's.cube.bonks >= 1 || s.cube.z === 15');
  await direct(page, 'cube.teleport', 5, 15);
  const before = await page.evaluate(() => (window as any).__crail.state.cube.bonks);
  await holdUntil(page, 'KeyW', `s.cube.bonks > ${before}`);
  // The rock is empty at once; the things fly home, and the octopus is furious.
  expect(await page.evaluate(() => (window as any).__crail.state.octopus.stash.length)).toBe(0);
  await expect(page.locator('#hint')).toContainText('gave back');
  await page.waitForFunction(() => (window as any).__crail.state.octopus.returned >= 1);
});

test('startle the octopus and it drops what it is carrying, and the owner gets it back', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'goths.spawn', 0, -3, 8, 1, { idle: 999 });
  await direct(page, 'goths.bow', 0);
  const hasBow = () => page.evaluate(() => !!(window as any).__crail.state.everyone[0].rig.head.getObjectByName('bow'));
  expect(await hasBow()).toBe(true);
  await direct(page, 'octopus.staged', false);
  await direct(page, 'octopus.steal', 'goth');
  await page.waitForFunction(() => (window as any).__crail.state.octopus.carrying.length >= 1);
  // It took the bow itself, not a copy.
  expect(await page.evaluate(() => (window as any).__crail.state.octopus.carrying[0])).toContain('bow');
  expect(await hasBow()).toBe(false);
  // Something goes off next to it (a bump from the cube does the same).
  await page.evaluate(() => {
    const c = (window as any).__crail;
    c.direct('leader.blast', c.state.octopus.x, c.state.octopus.z, 1);
  });
  const o = await page.evaluate(() => {
    const s = (window as any).__crail.state.octopus;
    return { carrying: s.carrying.length, mode: s.mode };
  });
  expect(o).toEqual({ carrying: 0, mode: 'flee' });
  // The bow flies back to her and goes back on her head.
  await page.waitForFunction(() => (window as any).__crail.state.octopus.returned === 1);
  expect(await hasBow()).toBe(true);
  // And it goes home to sulk.
  await page.waitForFunction(() => (window as any).__crail.state.octopus.mode === 'lurk', null, { timeout: 60_000 });
});

test('what the octopus takes is gone from the person, and comes back with them', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'leader.spawn', 0, 2, 8, 1, { idle: 999 });
  await direct(page, 'leader.soldier');
  const cap = () => page.evaluate(() => {
    const m = (window as any).__crail.state.everyone.find((e: any) => e.n.persona.kind === 'soldier');
    return { cap: m.rig.loot.item.visible, crop: m.rig.loot.bare.visible };
  });
  expect(await cap()).toEqual({ cap: true, crop: false });
  await direct(page, 'octopus.staged', false);
  await direct(page, 'octopus.steal', '', 'cap');
  await page.waitForFunction(() => (window as any).__crail.state.octopus.carrying.length >= 1);
  expect(await page.evaluate(() => (window as any).__crail.state.octopus.carrying[0])).toContain('cap');
  expect(await cap()).toEqual({ cap: false, crop: true });
  await page.evaluate(() => {
    const c = (window as any).__crail;
    c.direct('leader.blast', c.state.octopus.x, c.state.octopus.z, 1);
  });
  await page.waitForFunction(() => (window as any).__crail.state.octopus.returned === 1);
  expect(await cap()).toEqual({ cap: true, crop: false });
});

test('the octopus never takes the cube’s last charm', async ({ page }) => {
  await open(page, '?seed=3');
  await clearStage(page);
  await direct(page, 'cult.charms', 1);
  await direct(page, 'octopus.staged', false);
  await direct(page, 'octopus.steal', 'cube');
  await page.waitForTimeout(1500);
  const o = await page.evaluate(() => {
    const s = (window as any).__crail.state;
    return { mode: s.octopus.mode, charms: s.cult.charms };
  });
  expect(o).toEqual({ mode: 'lurk', charms: 1 });
});
