# CRAIL

A browser game that started as **one cube in an empty world**. Every two days a new
Reel goes up on [@qubitman_ftw](https://www.instagram.com/qubitman_ftw/), and the
community decides what gets added next.

- **Play:** https://qubitman-hub.github.io/Crail/ (once GitHub Pages is switched on)
- **How voting works:** [RULES.md](RULES.md)
- **Every vote, on the record:** [ledger/](ledger/)

## Controls

WASD or arrow keys roll the cube. Click or tap the floor to send it there.

## Run it

```bash
npm install
npm run dev        # play locally
npm test           # unit tests
npm run e2e        # boots the real game in a browser and plays it
npm run build      # production build in dist/
```

## How the game is put together

| Path | What lives there |
| --- | --- |
| `src/core/` | The small, stable engine: loop, isometric camera, input, event bus, feature registry. |
| `src/features/NNN-name/` | One folder per feature. `NNN` is the day it was added. |
| `src/features/index.ts` | The list of every feature. |
| `tests/` | Unit tests and browser smoke tests. Both run on every push. |
| `tools/` | Reel capture and the Instagram vote collector. |
| `ledger/` | One JSON file per vote: the ranking, the winner and the reasoning. |

### Adding a community feature

1. Create `src/features/007-something/index.ts` exporting a `Feature`: its `meta`
   (day, title, and the credit: who asked for it and their exact words) and a
   `setup(ctx)` function.
2. Add it to the list in `src/features/index.ts`.
3. Talk to other features only through `ctx.events` and `ctx.state`, never by
   importing their files. That is what keeps old features from breaking.
4. Add a test, open a pull request, and merge once CI is green.

### Time machine and rollback

- `?day=3` plays the game exactly as it was on day 3. Useful for "then vs now" footage.
- `?off=007-something` switches one feature off without touching code.
- Every episode is also a git tag (`day-007`), so a full revert is always one command away.

## Tools

```bash
npm run build
npm run capture                              # 1080x1920 gameplay clip in captures/
npm run capture -- --day 0 --name day-000    # footage of an older day
IG_TOKEN=... npm run votes -- --list         # your recent posts
IG_TOKEN=... npm run votes -- --day 1 --reel <reel link>
```

The vote collector uses Instagram's official API, read-only. The token lives in the
repository secret `IG_TOKEN` and is never committed. It lasts 60 days; renew it with
`npm run votes -- --refresh` and paste the new value into the secret.

## Stack, and the road to Steam

TypeScript, [three.js](https://threejs.org/) and Vite. The build is plain static
files with relative paths, so the same `dist/` folder runs on GitHub Pages today and
inside a desktop shell (Electron or Tauri, with Steamworks bindings) later. Sound is
synthesised in code, so there are no audio licences to clear.
