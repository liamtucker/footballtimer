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

**Done.** v2 is built. The engine is reworked — `subMinutes` is the interval,
`gameType` sets who is on the pitch, the list order is the ring, and the first
keeper is drawn at random at kick-off. 71 passing assertions. The interface is
rebuilt against `spec.md`, `brain/design.md` variation A and `brain/copy.md`:

- **Setup.** One 2px field per team with the arrow arming to green on the first
  keystroke, sitting under its own list. Drag anywhere on a row to reorder. The
  divider sits after `gameType`. A tap on any name makes them the starting
  keeper, moving the row to the nearest legal index first, so no row is dead.
- **Kick-off.** A ten-second countdown on the assembled game screen, any tap
  aborts, then a synthesised referee whistle and the spoken line.
- **The game screen.** Two rows, one sentence each, keeper in the loud slot.
  Order strip, spine, elapsed. Both orientations built and measured.
- **The changeover.** The last ten seconds of the shift. Ground lifts to white,
  the incoming name walks into the hero slot in green with an up arrow, the
  outgoing name walks down onto line three in red with a down arrow. Chime and
  voice at the start, whistle at the change.
- **Sound.** Whistle and chime synthesised with WebAudio. No files, no network.
- **The edit route.** The pencil opens the setup screen with the game running.
  Any edit lands at the next change, never mid-shift, stored as a second epoch.

**Next.** The field test. Watch whether ten seconds of countdown at every change
annoys people by minute forty, whether the elapsed readout earns its place, and
whether the chime before each team is right or one chime is enough.

**Blocked.** Nothing.

**Open, for Liam.**

- The changeover names the outgoing keeper on line three, per `design.md`.
  `copy.md` says he is never named. The design's motion is the answer to "could
  not tell what was happening", so the design won and he gets an arrow, not a
  word.
- The kick-off countdown shows the pencil and no words. `design.md` wanted a
  label saying the screen can be tapped; `copy.md` forbids telling a person how
  to use the screen. The icon does the job.
- A late arrival joins the bench at the next change, not immediately, because
  every edit lands at the next change. `spec.md` has them on at the next change;
  they are now on the change after.
- Portrait holds a ten-character name at about 42px, under the design's own
  `4rem` floor. Landscape holds it at 80px. Landscape is the watching
  orientation, so this is only a problem if anyone watches in portrait.

## Debug hook

Only active with `?t=` in the URL. Without it `window.rota` does not exist and
nothing is written to `localStorage`.

- `?t=330`, `?t=5:30` or `?t=589.4` — start the clock at that elapsed time
- `&rate=60` — run 60x real time. `&rate=0` freezes it
- `&a=Dom,Dave,Chris` and `&b=Sam,Tom,Alex` — prefill the two squads
- `&g=7` — game type. `&sub=10` and `&game=120` — the two durations
- `&ka=2` and `&kb=3` — force the starting keeper index per team
- `&count=0` — skip the kick-off countdown. `&auto=1` — kick off on load
- `window.rota.setElapsed(ms)`, `.rate(n)`, `.view()`, `.rotation`, `.state`,
  `.draft`, `.tick`
