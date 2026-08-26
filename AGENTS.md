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
4. **Nothing to operate mid-game.** The game screen carries one control and it
   is `END`. The engine still exposes `addLateArrival` and `removePlayer`; no
   screen calls them. Do not put a second control there.
5. **A button that needs a judgement is the wrong button.** Check any new
   control against the four principles in `spec.md`.
6. **The type is Barlow, and it ships with the app.** Barlow Condensed Bold and
   Barlow SemiBold, four woff2 subsets in `fonts/`, precached by the service
   worker. The rule this replaces was system fonts only, and the reason for it
   stands: nothing may be fetched from a network on a pitch. Never link a font
   from a CDN.
7. Run `node test.js` before every commit. It must pass.

## Decisions

- **Hosting.** GitHub Pages, from `main` at the repo root.
- **Target.** Portrait phone at 390x844, iOS Safari and Android Chrome both.
  The design is portrait. Landscape is not drawn and is not supported.
- **Who starts is drawn.** The first keeper and the first bench are drawn at
  kick-off and written into the setup. Entry order decides nothing, so there is
  no divider, no drag and no tap that sets a keeper.
- **Squad memory.** The last squad is kept and prefilled at setup. A setup
  convenience only. It never touches the rotation. Nothing on the screen
  sweeps it away — a name leaves the list one row at a time.

## State

**Done.** v8. The interface is rebuilt from Figma node `78:655` — three frames,
every value read out of the file. The engine passes 122 assertions. Service
worker cache `rota-v12`.

**The design is black, white and one grey.** `#171717`, `#ffffff`, `#444444`.
Hairlines are `#171717` at 10% between blocks and at 20% between settings
cells. No radius anywhere and no shadow anywhere. Black surfaces are flush to
an edge — the team chip to the right, the Kick off bar to the bottom, the modal
to the left and the right. Type is Barlow Condensed Bold at 21, 28, 32, 50 and 150, over a Barlow
SemiBold eyebrow at 12/14.4 whose track changes by role: 0.48px in the squad
column, 0.72px on `NEXT ROTATION:`, 0.96px on a section label, 1.2px on a chip
and a settings label.

**The display type is trimmed to its cap height, and that is why the file
agrees.** Figma uses `text-box-trim: trim-both` with `text-box-edge: cap
alphabetic`, so every vertical measurement in the design is cap-to-baseline.
Barlow and Barlow Condensed are both 1000 units to the em with cap height 700,
ascent 1000 and descent 200. With `line-height: 1` the cap top sits 0.2em down
and the baseline 0.9em down, so `margin-block: -.2em -.1em` leaves a margin box
of exactly 0.7em — which is why 50px occupies 35px, 32px occupies 22.4px and
150px occupies 105px, the three numbers the file reports. It is margins and not
`text-box` because `text-box` lands in Safari 18.4 and would leave every
earlier iPhone a third of a line out.

**The gauge is the shift, drawn backwards.** The timer block is 340px of
`#444`, with a `#171717` bar pinned to its left edge and `scaleX`d to the share
of the shift still to run. The black draws back to the left as the shift
empties. In the design frame it is 284 of 390 against 6:09 of 8:30 — 369/510 is
0.724 and 0.724 of 390 is 282, so the mechanism is `remaining / interval` and
the designer's 284 is two pixels of eyeball.

**The countdown is the gauge finishing.** Twenty seconds before kick-off and
ten before every rotation the gauge goes to nothing and the block is the grey
underneath it, whole. White on `#444` is 7.6:1. At a rotation this is not a new
state arriving — it is the thing the block has been saying for ten minutes,
arriving at zero. Before kick-off the label reads `KICK OFF IN:` and the
lineups are already on the screen, so the draw is visible before the horn.

**A name carries two flags and the modal is where they are set.** Tapping a
name opens a black band centred in the viewport and flush to the left and right
edges — full bleed, no radius, no shadow, 20px of padding, 112.8px tall:

```
KEVIN                                    ×
[ FIXED GOALIE ]  [ LATE ]
```

There is still no switch and no tick. The word is the control. What changed is
that the state is now the shape the word sits in and not how loud the word is.
The same band asks the one question this app asks — `END THE GAME?`, with `END`
filled and `KEEP PLAYING` outlined — so there is one modal surface and not two.

**A bar at the bottom can lean on a tap outside. A band in the middle cannot.**
A tap outside is where the eye already is and nothing on the screen says it
does anything, so the band carries an explicit close: the same 23px cross the
squad list removes a name with, on the title's own line, trimmed to the
eyebrow's 14.4px so the 20px padding stays true. The scrim and Escape still
dismiss; the cross is in addition and not instead.

**On and off are a difference in kind, not a difference in strength.** The old
toggle was full ink on and 45% off — one word twice at two volumes, which you
can only read by comparing it with the other one. Now:

| | fill | rule | word | ratio |
|---|---|---|---|---|
| on | white | white | `#171717` | 17.93:1 |
| off | none | white 2px | white | 17.93:1 |
| pressed | `#444444` | `#444444` | white | 9.74:1 |

Neither state is faint and neither needs the other on the screen to be read.
The geometry is identical in both — 2px of rule either way — so nothing moves
when one is pressed, and 12px from every outer edge to the cap puts the control
at 46.4px, over the 44px thumb. Pressed is the third shape and it is instant:
selected and pressed are two different facts, so they cannot be the same
picture, and a press that fades is a press that did not land.

**One rule on both surfaces: inverted against the ground means on.** In the
modal the ground is black, so on is a white fill. In the squad list the page is
white, so on is a block of ink — 23px, with the glyph knocked out of it at
16px. The glove for a fixed goalie, the same one the game screen puts beside
whoever is next in; the clock for late. Both flags are marked the same way
because they are the same fact about the rotation and only then differ in which
one. The name itself is never dimmed now. The mark it replaced was a glove at
50% and, for late, the name at 30% — which composites to `#b9b9b9` and is
1.96:1. A name you cannot read is not a state.

**The 50% on the game screen's squad column moved from the row to the name.**
The roster is the quiet half of that column and the marks are the loud half. A
12px glove at 50% on `#fcfcfc` is 3.36:1; at full ink it is 17.47:1, and the
list around it stays exactly as quiet as the frame draws it.

**One sub is set at the keeper's size.** Two names at 32 is a list and a list
wants the smaller size. One name is not a list, it is a second answer, so it
takes the keeper's 50 and the label goes singular.

**A name that does not fit is set smaller, not cut off.** The longest keeper in
the design is KEVIN and nothing in the file reaches the edge of its column. A
real squad does — LORENZO at 50px is 157px against a 151px column — and
clipping it turns the one thing the screen exists to say into LORENZ. Every
name in the design is untouched because every name in the design already fits.

**What the rebuild deleted.** The subs divider, the drag to reorder, the tap
that set the starting keeper, and the edit route behind all three. The random
draw makes entry order meaningless, so none of them had anything left to
decide. Also gone: the mute (Liam removed it before this), the visible sound
test, and the two mid-game roster controls. The iOS unlock still happens on the
first touch anywhere and on the Kick off gesture.

**What was carried across untouched.** The clock as `Date.now() - kickoff` with
the `visibilitychange` resync; the announcement firing on the change crossing
and not on a tick; `Bibs. Goal, Umar. Sub, Kevin.` with a chime before each team
and the horn before the words; the `navigator.audioSession = 'playback'` fix
that made the horn audible on a silent iPhone; the wake lock; `localStorage`
persistence and silent restore; the offline service worker; the `?t=` debug
hook, which still writes nothing.

**Measured against the file at 390x844.** Every element lands within 0.8px of
its Figma frame, and every residual is Figma rounding 14.4 to 15 and 22.4 to 22
rather than a difference in the build. Three defects were found in the pass and
fixed: an `<input>` ignores `line-height: 1` for its own height and fell back
to the font's 1.2em box, putting 6.5px into the Enter name row that is not in
the file; a `border-left` on a settings cell took its width out of that cell's
flex share and put the dividers at 129.33 and 259.66 instead of 130 and 260;
and CSS adds a letter-space after the last character where Figma does not,
which stood the `BIBS` chip 1.2px off the right edge.

**Next.** The field test, and it is the same one as before: whether the horn is
the right length on a real speaker, and whether the countdown at every change
annoys people by minute forty.

**Blocked.** Nothing.

**Open, for Liam.**

- **The design's own numbers do not agree with each other.** The filled team
  select shows squads of 8 and 7 with `ROTATE EVERY: 8:30`; 8:30 is the answer
  for a squad of 7 and the answer for 8 is 7:30. The build does the arithmetic
  and shows 7:30. The game frame has the same split — 6:09 left of a shift the
  gauge draws as 8:30 but the setup calls 7:30.
- **The second column of the team select is labelled `SUBS` in the file and set
  to zero opacity.** It holds the column's width and says nothing, which is
  correct now that nobody picks the bench — but it is a label waiting to be
  deleted or given a job.
- **The game frame marks two players with ⇆ in the second team's squad column
  and marks none with the glove.** The first team has both. The build follows
  the rule rather than the drawing: the glove on `nextKeeperIndex`, the arrows
  on `nextSubIndexes`.
- **No agent can hear any of this.** The horn is proved by an
  `OfflineAudioContext` render and nothing else, and the voice has never fired
  `start` in an automation browser. Audibility on the phone still rests on the
  audio session fix.
- **`brain/design.md` and `spec.md` describe the old interface.** Both are now
  wrong about the screens and still right about the rotation and the sounds.

## Debug hook

Only active with `?t=` in the URL. Without it `window.rota` does not exist and
nothing is written to `localStorage`.

- `?t=330`, `?t=5:30` or `?t=589.4` — start the clock at that elapsed time
- `&rate=60` — run 60x real time. `&rate=0` freezes it
- `&a=Dom,Dave,Chris` and `&b=Sam,Tom,Alex` — prefill the two squads
- `&g=7` — game type. `&game=120` — the game time
- `&rot=2` — rotations each
- `&seed=3` — a deterministic draw, so the same URL gives the same pitch twice.
  There is no way to force a starting keeper any more; the draw is the only way
  in and a seed is the only way to repeat it.
- `&count=0` — skip the kick-off countdown. `&auto=1` — kick off on load
- `window.rota.setElapsed(ms)`, `.rate(n)`, `.view()`, `.sheet(team, index)`,
  `.heard`, `.engine`, `.rotation`, `.state`, `.draft`, `.tick`. `.sheet` is
  still called `sheet`; it opens the modal.
