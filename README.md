# BLITZBALL X

**Arcade 3-on-3 street ball. Turbo, tricks, ankle breakers, Gamebreakers. First to 21, win by 2. No refs.**

BLITZBALL X is a finished, browser-playable arcade basketball game in the spirit of classic
street-ball arcade titles: stylised cel-shaded players on a caged blacktop, a broadcast-style
camera that punches in on dunks, a graffiti/hip-hop UI, live commentary, a style meter that
charges an unstoppable **Gamebreaker**, and a "Run The Streets" career ladder against seven
rival crews. It runs entirely client-side (three.js + Vite) — no backend, no accounts, no
downloads.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build:

```bash
npm run build      # outputs static site to dist/
npm run preview    # serve dist/ locally on http://localhost:4173
```

`dist/` is a static bundle with relative asset paths — drop it on any static host (GitHub
Pages, Netlify, S3, nginx). A GitHub Pages workflow is included (`.github/workflows/deploy-pages.yml`).

### Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | WASD / Arrows | Left stick / D-pad |
| Turbo | Shift | RT / RB |
| Shoot (hold, release at the top of the jump) | J / Space | A / Cross |
| Pass (hold Turbo for alley-oop) | K | X / Square |
| Trick (with ball) / Steal (defense) | L | B / Circle |
| Shove | I | Y / Triangle |
| Jump / Block | U (or J on defense) | A / Cross on defense |
| Switch player | Q / Tab | LB |
| Gamebreaker | E | LT + RT |
| Pause | Esc | Start |

### Rules

* First to **21**, win by 2 (hard cap at 30). Inside the arc = 1 point, outside = 2.
* 20-second shot clock. After a change of possession you must **clear** the ball outside the arc.
* Tricks, ankle breakers, dunks, blocks, steals and alley-oops earn **Style**. Chaining tricks
  quickly builds a combo multiplier; turnovers drain style.
* A full style meter arms a **Gamebreaker**: press E with the ball for an unstoppable slam that
  adds 2 to your score **and subtracts 1 from theirs**.
* Three straight buckets puts your crew **ON FIRE** (hot shooting, ball glows).

### Modes

* **Pick Up Game** — quick match vs CPU, any crew vs any crew, three difficulties.
* **Run The Streets** — career ladder: pick a crew, beat all seven rivals on their own courts,
  earn Rep, unlock Legend difficulty. Progress is saved in `localStorage`.
* **Watch** — CPU vs CPU exhibition.

## Project layout

```
index.html              entry point
src/main.js             app shell: routing, match lifecycle, fixed-step loop, audio wiring
src/styles.css          graffiti / hip-hop UI theme + HUD
src/core/               vec3, seeded RNG, event bus (dependency-free)
src/data/               constants (court, rules, physics, difficulty) and the 8 crews / rosters
src/game/               headless deterministic simulation: match.js (rules, physics, actions),
                        ai.js (CPU brains), entities.js, career.js
src/render/             three.js presentation: court, cel-shaded characters, FX, camera, post
src/ui/                 input (keyboard + gamepad), procedural audio, HUD, commentary,
                        screens/menus, localStorage save
scripts/simulate.mjs    headless CPU-vs-CPU balance runner (`npm run sim -- 24 pro`)
tests/                  node:test suite (rules, determinism, box score, input, career)
tools/                  headless-Chromium QA harnesses (screenshots, scripted playtests)
```

The simulation (`src/game`) has no DOM or three.js dependency and is driven at a fixed 60 Hz.
The renderer, HUD, commentary and audio subscribe to its event bus, so the same match code is
used by the game, the tests and the headless balance runner. Given a seed, a match is fully
deterministic.

## Quality checks

```bash
npm test                   # unit + simulation tests
npm run sim -- 24 pro      # 24 full CPU games; fails if any game does not finish
npm run qa:screens         # screenshots of every screen + pause/results flow (needs dev server)
npm run qa:play            # scripted full game through the real renderer/HUD, reports page errors
```

The QA tools use `@sparticuz/chromium` + `puppeteer-core` (software WebGL) so they run in CI
containers without a GPU.

## Browser support

Any current Chromium, Firefox or Safari with WebGL 2. The "Graphics" setting (Low / Medium /
High) trades shadows, bloom and resolution for performance on integrated GPUs and laptops.

## Credits

Original game, teams, players and art. Fonts: Bangers, Barlow Condensed, Permanent Marker
(SIL Open Font License, via `@fontsource`). All sound is synthesised at runtime with the Web
Audio API.
