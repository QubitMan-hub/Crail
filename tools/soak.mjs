// Long simulated play session: random rolling, forced events, and rule checks every
// simulated second (nobody overlapping, every character owns its cell, no leftover
// cells, nobody stuck, nothing at an impossible height, no errors). Prints problems found.
//
//   npx vite --port 5199 --strictPort &
//   node tools/soak.mjs <seed> <minutes>
import { chromium } from 'playwright';
const [seed, minutes] = [Number(process.argv[2] ?? 1), Number(process.argv[3] ?? 6)];
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 480, height: 480 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto(`http://localhost:5199/?manual&seed=${seed}`);
await p.waitForFunction(() => window.__crail?.game);
const report = await p.evaluate(async ({ seed, minutes }) => {
  const c = window.__crail;
  const { game, direct, state } = c;
  const ctx = game.ctx;
  let r = seed * 9301 + 49297;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  const problems = [];
  const note = (t, msg) => { if (problems.length < 40 && !problems.some((p) => p.msg === msg)) problems.push({ t: t.toFixed(1), msg }); };
  const step = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) game.step(1 / 30); };
  let held = null;
  const octoMode = { mode: '', since: 0 };
  const stillSince = new Map();
  let maxChildren = 0;
  const startChildren = ctx.scene.children.length;
  for (let t = 0; t < minutes * 60; t += 1) {
    // Drive the cube: hold a random direction for a bit, sometimes stop.
    if (t % 2 === 0) {
      if (held) window.dispatchEvent(new KeyboardEvent('keyup', { code: held }));
      held = rand() < 0.75 ? KEYS[Math.floor(rand() * 4)] : null;
      if (held) window.dispatchEvent(new KeyboardEvent('keydown', { code: held }));
    }
    // Keep things interesting.
    if (t % 25 === 5) direct('cult.charms', 6);
    if (t === 20) { // a big cult: four follow, the rest go to the temple
      for (let i = 0; i < 5; i++) direct('cult.recruit', 'goths', i);
      for (let i = 0; i < 4; i++) direct('cult.recruit', 'femboys', i);
      direct('cult.recruit', 'soldiers', 0);
    }
    if (t % 30 === 25) direct('leader.launch', 'strike');
    if (t % 40 === 20) direct('leader.launch');
    if (t % 55 === 30) direct('leader.shell');
    if (t % 70 === 10) direct('leader.conscript');
    if (t % 45 === 15) direct('octopus.steal');
    if (t === 60 || t === 200 || t === 300) { // jump around the world
      { const [x, z] = t === 60 ? [12, -4] : t === 200 ? [3, -9] : [15, 9]; direct('cube.teleport', x, z); }
      if (t === 300) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); step(0.4); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); step(1.2); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' })); step(0.2); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' })); }
    }
    step(1);

    // ---- Invariants ----
    const cube = state.cube;
    const cells = new Map();
    const claim = (key, who) => { if (cells.has(key)) note(t, `two things on ${key}: ${cells.get(key)} and ${who}`); else cells.set(key, who); };
    if (!cube.carried) {
      claim(`${cube.x},${cube.z}`, 'cube');
      const o = ctx.grid.at(cube.x, cube.z);
      if (!o || o.kind !== 'cube') note(t, `cube at ${cube.x},${cube.z} does not own its cell (owner ${o?.kind})`);
    }
    for (const m of state.everyone) {
      const n = m.n;
      if (n.carry) continue;
      claim(`${n.x},${n.z}`, n.id);
      const o = ctx.grid.at(n.x, n.z);
      if (o !== n.occ) note(t, `${n.id} (${n.mode}) at ${n.x},${n.z} does not own its cell (owner ${o?.id ?? 'none'})`);
      if (n.nx !== null) {
        const o2 = ctx.grid.at(n.nx, n.nz);
        if (o2 !== n.occ) note(t, `${n.id} stepping into ${n.nx},${n.nz} without owning it`);
      }
      const pos = m.rig.root.position;
      if (!Number.isFinite(pos.x + pos.y + pos.z)) note(t, `${n.id} has a NaN position`);
      if (pos.y < (0.1 - 0.78) * m.rig.root.scale.y - 0.03 || pos.y > 6) note(t, `${n.id} at odd height ${pos.y.toFixed(2)} in mode ${n.mode}`);
      // Stuck in a transient mode?
      const key = n.id;
      const sig = `${n.mode}|${n.x},${n.z}`;
      const prev = stillSince.get(key);
      if (!prev || prev.sig !== sig) stillSince.set(key, { sig, t });
      else if (['floored', 'hop', 'hopOff', 'plop', 'rise', 'toSit', 'swarm', 'listen', 'fume', 'salute', 'order'].includes(n.mode) && t - prev.t > 25) note(t, `${n.id} stuck in ${n.mode} for ${t - prev.t}s at ${n.x},${n.z}`);
    }
    const o = state.octopus;
    if (o) {
      if (!o.carrying) note(t, 'octopus state missing');
      const own = ctx.grid.at(o.x, o.z);
      const rim = Math.max(Math.abs(o.x - 3), Math.abs(o.z - 14)) === 1;
      if (!rim && own?.kind !== 'octopus') note(t, `octopus at ${o.x},${o.z} does not own its cell (owner ${own?.kind})`);
      if (o.mode !== octoMode.mode) Object.assign(octoMode, { mode: o.mode, since: t });
      else if (o.mode !== 'lurk' && t - octoMode.since > 45) note(t, `octopus stuck in ${o.mode} for ${t - octoMode.since}s at ${o.x},${o.z}`);
    }
    // Ghost cells: cube-owned cells other than where it is.
    let cubeCells = 0;
    for (let x = -45; x <= 45; x++) for (let z = -45; z <= 45; z++) {
      const g = ctx.grid.at(x, z);
      if (g?.kind === 'cube') { cubeCells++; if (!cube.moving && (x !== cube.x || z !== cube.z)) note(t, `ghost cube cell at ${x},${z}`); }
      if (g?.kind && ['goth', 'femboy', 'leader', 'soldier'].includes(g.kind)) {
        const owner = state.everyone.find((m) => m.n.occ === g);
        if (!owner) note(t, `cell ${x},${z} held by a character who no longer exists (${g.id})`);
        else if (!((owner.n.x === x && owner.n.z === z) || (owner.n.nx === x && owner.n.nz === z))) note(t, `cell ${x},${z} held by ${g.id} who is at ${owner.n.x},${owner.n.z}`);
      }
    }
    maxChildren = Math.max(maxChildren, ctx.scene.children.length);
    if (state.cult.charms < 0 || state.cult.charms > 6) note(t, `charms out of range: ${state.cult.charms}`);
  }
  if (held) window.dispatchEvent(new KeyboardEvent('keyup', { code: held }));
  return {
    problems,
    summary: {
      rolls: state.cube.rolls, cult: state.cult.members.length, retinue: state.cult.members.filter((n) => n.lead).length, atPews: state.cult.members.filter((n) => !n.lead && n.post && n.x === n.post.x && n.z === n.post.z).length, rides: state.park.rides,
      octopus: { stolen: state.octopus.stolen, returned: state.octopus.returned, stash: state.octopus.stash.length, shrugged: state.octopus.shrugged },
      tahgong: state.tahgong ? { returned: state.tahgong.returned, mode: state.tahgong.mode } : null,
      army: { blasts: state.army.blasts, conscripts: state.army.conscripts, tank: state.army.tank, followers: state.army.followers },
      rocket: { launches: state.rocket.launches, strikes: state.rocket.strikes },
      sceneChildren: { start: startChildren, max: maxChildren, end: ctx.scene.children.length },
      drawCalls: ctx.renderer.info.render.calls,
    },
  };
}, { seed, minutes });
console.log(JSON.stringify({ seed, errors: errors.slice(0, 10), ...report }, null, 1));
await b.close();
