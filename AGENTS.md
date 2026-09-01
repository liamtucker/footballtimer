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
4. **Nothing to operate mid-game, and nothing that changes the game.** The
   game screen carries two controls and neither of them touches the rota: the
   sound test, and `END`. The engine still exposes `addLateArrival` and
   `removePlayer`; no screen calls them. Do not put a third control there.
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

**Done.** v9. The game screen is rebuilt from Figma node `87:385`; the team
select and the modal are still node `78:655`, measured against the file at
390x844 and landing within 0.8px everywhere. The engine passes 122 assertions
and was not touched. Service worker cache `rota-v13`.

**The palette is black, white, one grey and one block of colour.** `#171717`,
`#ffffff`, `#444444`. Hairlines are `#171717` at 10% between blocks and 20%
between settings cells. No radius and no shadow anywhere, and black surfaces are
flush to an edge. Type is Barlow Condensed Bold at 18, 21, 28, 32, 50 and 150,
over a Barlow SemiBold eyebrow at 12/14.4 whose track changes by role: 0.72px on
`NEXT ROTATION:`, 0.96px on a section label, 1.2px on a chip and a settings
label.

**The timer block is the only colour, and it is two pairs.** A saturated bar
over a pale ground of the same hue: `#ddfd66` on `#edfeaf` while the shift runs,
`#ff5a5a` on `#ffe0dd` in the last ten seconds. Everything on the block is
`#171717` in both — 17.4:1 on the pale green, 14.9:1 on the pale red, 6.9:1 on
the red itself — so nothing about the type changes when the colour does.

**The bar has two scales, and the second one is the point.** For most of a
shift it is `remaining / interval`, drawn backwards: a bar pinned to the left
edge and `scaleX`d, so the colour draws back to the left as the shift empties.
In the last ten seconds it is `remaining / 10s`, so it sweeps the full width and
runs out exactly as the horn lands. Ten seconds is two percent of a shift; left
on the shift's own scale the bar would not move at all in the window that
matters most. The big number flashes over it at 1Hz — the one thing on this
screen allowed to move on its own.

**The horn moved to the change, and the countdown took its job.** It used to
fire ten seconds early and be the warning itself, with the names over the top
describing a pitch that did not exist yet. Now: ten beeps, one a second, the
horn on the crossing, then the names describing the pitch as it stands — the
same order as kick-off, and one `linesForNow` instead of two builders. A horn
only sounds on a change the countdown was armed for, so a phone that slept
through four of them wakes on the right one in silence.

**The rota is read along the line the eye is already on.** The whole squad used
to run down a column on the right, with a glove on whoever was next. It answered
*when is my turn* and made you count to answer *who is after this one* — the
question somebody on a pitch actually asks. So the order is laid out
horizontally: the name in play at full size in a 171px column, then everyone
after it at 18px and 20% ink, running right until the edge of the phone stops
them. Nothing scrolls — `.side` clips at its padding box, the full 390, so a
name is cut by the screen edge and not by the 24px gutter.

**Baseline alignment is what `flex-end` already is.** The display type is
trimmed cap-to-baseline, so the bottom of every `.dsp` margin box *is* its last
baseline. 50px, 32px and 18px sit on one line with no magic number, and stay on
it when `fitLine` shrinks a long name.

**The queue is `rotation()` called forward.** The state at change *k* is
`rotation(setup, k * intervalMs)`; landing on a boundary floors to that change.
No new engine code and no arithmetic in `app.js`. It stops one short of a full
cycle, because a queue that repeats says nothing.

**The sound test plays both channels.** On iOS the horn is Web Audio, which the
ring switch mutes, and the voice is `speechSynthesis`, which it does not. They
fail independently, so the button plays the horn and then says *Sound is
working*. One sounding and the other not is the answer, not a broken test.

**The display type is trimmed to its cap height, and that is why the file
agrees.** Figma uses `text-box-trim: trim-both` with `text-box-edge: cap
alphabetic`, so every vertical measurement in the design is cap-to-baseline.
Barlow and Barlow Condensed are both 1000 units to the em with cap height 700,
ascent 1000 and descent 200. With `line-height: 1` the cap top sits 0.2em down
and the baseline 0.9em down, so `margin-block: -.2em -.1em` leaves a margin box
of exactly 0.7em — which is why 50px occupies 35px and 150px occupies 105px, the
numbers the file reports. It is margins and not `text-box`, which lands in
Safari 18.4 and would leave every earlier iPhone a third of a line out. A stack
of names sets each one as its own element on a `.3em` gap, which puts the caps
where a single line box would.

**A name that does not fit is set smaller, not cut off.** Nothing in the design
reaches the edge of its column; a real squad does, and clipping LORENZO turns
the one thing the screen exists to say into LORENZ. **And one sub is set at the
keeper's size** — two names at 32 is a list, one name is a second answer.

**A name carries two flags and the modal is where they are set.** One black
band, centred and full bleed, 112.8px tall — and it asks the one question this
app asks, `END THE GAME?`, so there is one modal surface and not two. There is
no switch and no tick: the word is the control, and the state is the shape the
word sits in. Inverted against the ground means on — a white fill on the band, a
block of ink in the squad list — and pressed is a third shape in `#444444`,
instant, because selected and pressed are two different facts. The geometry is
identical in all three, so nothing moves when a finger lands. A band in the
middle of the screen cannot lean on a tap outside, so it carries an explicit
23px cross; the scrim and Escape still dismiss.

**What the rebuilds deleted.** The subs divider, the drag to reorder, the tap
that set the starting keeper, and the edit route behind all three — the random
draw makes entry order meaningless, so none of them had anything left to decide.
Also gone: the mute (Liam removed it before this), the two mid-game roster
controls, the squad column with its glove-and-arrow marks, and the word `END`,
which is now two 44px icons side by side, flush right at 8px and 15px off the
bottom. A word beside one of two icons says that only that one is a control. The
sound test came back as the other icon, because the volume failing silently is
the one way this app breaks on a pitch.

**What was carried across untouched.** The clock as `Date.now() - kickoff` with
the `visibilitychange` resync; `Bibs. Goal, Umar. Sub, Kevin.` with a chime
before each team; the `navigator.audioSession = 'playback'` fix that made the
horn audible on a silent iPhone; the wake lock; `localStorage` persistence and
silent restore; the offline service worker; the `?t=` debug hook.

**Next.** The field test, and it is the same one as before with one more
question in it: whether the horn is the right length on a real speaker, whether
the countdown at every change annoys people by minute forty, and whether ten
beeps before it is nine too many.

**Blocked.** Nothing.

**Open, for Liam.**

- **The design's own numbers do not agree with each other.** The team select
  shows squads of 8 and 7 with `ROTATE EVERY: 8:30`; 8:30 is the answer for 7
  and the answer for 8 is 7:30. The build does the arithmetic and shows 7:30.
- **The team select's second column is labelled `SUBS` at zero opacity.** It
  holds the width and says nothing, which is correct now that nobody picks the
  bench — but it is a label waiting to be deleted or given a job.
- **The second team's chip has no shirt icon in node `87:385`.** The first
  team's does, and both did in `78:655`. The build keeps the outline shirt: it
  is the only thing that tells the two chips apart at a glance, and a deleted
  icon looks more like a slip than a decision.
- **No agent can hear any of this.** The horn is proved by an
  `OfflineAudioContext` render and nothing else, and the voice has never fired
  `start` in an automation browser.
- **`brain/design.md` and `spec.md` describe an interface two rebuilds old.**
  Both are still right about the rotation and about why the sounds are what they
  are, and wrong about every screen.

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
