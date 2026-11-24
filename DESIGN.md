# CRAIL design

<!-- impeccable:design-schema 1 -->

The game is a **playground**. The ground is safety rubber, the interface is the signage
on climbing frames, and colours behave like the rules of a toy box. Chosen after an
impeccable critique found the old look (cream, pastels, a four-point sparkle, tracked
tiny capitals) read as a generic AI-made demo.

## Colour rules

| Token | Value | Rule |
|---|---|---|
| `--ink` | `#1f2430` | text, edges, icons |
| `--ink-soft` | `#3a4254` | secondary text (never grey on colour) |
| `--paper` | `#fffaf0` | sign plates |
| `--ground` | `#d6e6dc` | the page and the rubber ground (flecked in 3D) |
| `--red` | `#e8402a` | the cube, and danger. Nothing else. |
| `--yellow` | `#ffc933` | charms, and today's news (the Day chip, the arrival card) |
| `--blue` | `#2f6fe0` | things you press (help, an active map button) |
| `--blue-deep` | `#2257b8` | handles in credits, links |

Toy greens in the world: lawn `#8cc96b`, leaves `#5faa45` / `#4e9440`, pine `#3f8a4e`.

## Type

- **Display:** Lilita One (self-hosted, `@fontsource/lilita-one`): the wordmark, headings, numbers on the scoreboard, the fight poster, the Day chip.
- **Text:** Rubik Variable (self-hosted, `@fontsource-variable/rubik`), 550–650 weight for UI, 15px body.
- No wide letter spacing (floor 0.01em). No tiny tracked uppercase labels.

## Components

- **Plate** (`.plate`): paper fill, 2.5px ink edge, 13px radius, soft offset shadow (`--lift`); presses down 2px. Minimum 44×44.
- **Bolted sign** (`.bolted`): a plate with four ink bolts in the corners. Panels only: scoreboard, credits, help, arrival, no-WebGL.
- **Icons** (`src/ui/icons.ts`): drawn SVG, 24-unit grid, 2.4 strokes in ink. The charm token is yellow with a stamped cube. Never emoji or Unicode stand-ins; `✦` in copy is rendered as the token by `withCharms`.
- **Stamp**: a small yellow ink-edged tag with Lilita lettering (`Day 7` on credits).
- **Messages**: one paper strip at the bottom, ink text, announced politely to screen readers.

## Motion

Exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`); panels drop in from 10px, the arrival card rises; reduced motion turns it all off.

## The fight

Ink letterbox bars slide in first; then a skewed, ink-stroked fight poster in Lilita One names the fighters above the action. The scoreboard steps aside; messages become subtitles on the bottom bar.
