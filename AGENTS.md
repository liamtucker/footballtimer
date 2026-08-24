---
name: footballtimer
status: building
---

# rota

## What this is

A display for casual six-a-side. It says who is in goal and who is the sub, for
both teams, and it changes on a timer. Set up during the warm-up, then never
touched.

`spec.md` is the source of truth for behaviour. `plan.md` is the build order.
`README.md` says why it exists. Read all three before you change anything.

## Rules

1. **The rotation is a pure function of elapsed time.** `rotation.js` holds no
   clock, no state and no history. Same setup and same elapsed time always
   returns the same answer. This is what lets a dead phone restart and carry on.
2. **No build step.** Flat static files. Vanilla JS, no framework, no bundler,
   no dependencies. Opening `index.html` runs it.
3. **No backend and no accounts.** The only stored things are the setup and the
   kick-off timestamp, in `localStorage`.
4. **Nothing to operate mid-game.** Two exceptions only: add a late arrival, and
   mark a player gone home. Both are facts, not decisions. Do not add a third.
5. **A button that needs a judgement is the wrong button.** Check any new
   control against the four principles in `spec.md`.
6. **System fonts only.** No webfont loads on a pitch with no signal.
7. Run `node test.js` before every commit. It must pass.

## Decisions

- **Hosting.** GitHub Pages, from `main` at the repo root.
- **Target.** Landscape phone, iOS Safari and Android Chrome both.
- **Gone home.** In scope. The spec's open decision is settled — allow it.
- **Squad memory.** The last squad is kept and prefilled at setup. A setup
  convenience only. It never touches the rotation.

## State

**Done.** v1 is built and live at https://liamtucker.github.io/footballtimer/
Rotation engine with 60 passing assertions, setup screen, display, spoken
announcement, wake lock, restore after a dead phone, offline shell, and the two
roster taps. The repo is public, which is what GitHub Pages needs on this plan.

**Next.** The field test in `plan.md` step 7. Two games. Watch whether the sub
reads it out, whether 90 minutes is the right duration, and what anyone argues
about.

**Blocked.** Nothing.

**Open, for Liam.** The spec puts the last person to arrive in goal first. That
gets their shift over with while everyone else still has theirs coming, so it
may reward lateness. One line in `rotation.js` if it needs to invert.

## Debug hook

Only active with `?t=` in the URL. Without it `window.rota` does not exist and
nothing is written to `localStorage`.

- `?t=330` or `?t=5:30` — start the clock at that elapsed time
- `&rate=60` — run 60x real time. `&rate=0` freezes it
- `window.rota.setElapsed(ms)`, `.rate(n)`, `.rotation`, `.state`, `.tick`
