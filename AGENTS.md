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

**Done.** The whole thing. `rotation.js` and its 60 assertions, the setup
screen, the display, the announcement, the wake lock and restore, the roster
sheet, the service worker, the icons and the manifest. Design variation A,
built to `brain/design.md`; every string from `brain/copy.md`.

**Debug hook.** `?t=` enables it and nothing else does. `?t=0` starts the game
clock at zero; `?t=330` at 330 seconds; `?t=5:30` the same as `m:ss`; add
`&rate=60` to run the clock 60x, or `&rate=0` to freeze it. With `?t=` present
nothing is written to `localStorage`. It exposes `window.rota` with
`setElapsed(ms)`, `getElapsed()`, `rate(n)`, `rotation`, `state` and `tick`.

**Deviations, all reported.** `display.change`, `display.order.label`,
`display.subs.none`, `action.add`, `action.remove`, `add.confirm`,
`add.result`, `remove.result` and `remove.undo` are unused: in each case the
designer deleted the element the string would have sat in. Three strings the
copywriter never wrote were needed and are invented — the kick-off hint, the
degraded marker and the separator between two sub names.

**Next.** The field test. Two games. `plan.md` step 7 says what to watch.

**Blocked.** Nothing.
