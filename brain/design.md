---
read when: You build or change a screen.
---

# design

Two screens. Static HTML/CSS/vanilla JS, system fonts, no build step. Landscape phone is the
target (844×390 to 932×430); portrait works properly, because setup is typed in portrait and
the game is watched in landscape. Every measurement is verified at 844×390 and 390×844.

## The distance problem, settled first

Legible cap height is about distance ÷ 250 and a landscape iPhone is 67 mm tall in total, so no
phone reads at 20 m. Four ranges get four channels, and every size below derives from them: the
**voice** carries the names to the whole pitch; the **ground lifting to white and the names
turning green** says a change is happening at 6–10 m; **one name per team at ~99 px** says who
is going in at 2–5 m; the **order strip** answers "when am I" under 1 m. If the keeper name
drops under `4rem` the product failed.

## Tokens

```
--ground      #F2F2F0   page, rest state
--ground-call #FFFFFF   page, changeover window
--surface     #FFFFFF   setup rows, fields, settings
--ink         #121214   names, primary          16.7:1 on ground
--ink-2       #4E4E55   secondary numerals       7.4:1
--ink-3       #6E6E76   every label              4.5:1
--dim         #BFBFC4   separators, ✕            non-text only
--hair        #DCDCDA   the two hairlines
--on          #0F6B2F   coming on / going in     5.9:1 ground, 6.6:1 white
--off         #A5261A   coming off / coming out  6.5:1 ground, 7.3:1 white
--curve       cubic-bezier(0.2, 0, 0, 1)
space         4 · 8 · 10 · 12 · 16 · 24
radius        10 rows · 12 fields and settings · 14 kick off · full for the ↑
elevation     one: 0 8px 24px rgba(0,0,0,.12), on a row while it is dragged
font          ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
weights       400 · 500 · 600 · 700 · 800
```

**Light ground, not dark.** In daylight the glass mirrors the sky; on a dark ground that
reflection is most of the light leaving the screen and contrast collapses. No theme toggle — a
toggle is a decision. **`--on` and `--off` are never alone**, because red and green are one
colour to a deuteranope: direction carries it (↑ on, ↓ off), the incoming name always holds the
loud slot with the outgoing name below it, and colour is the third copy. **Burn-in** is handled
by the ground alternating at every changeover, the names changing every shift, and a 4-step
drift on `<main>` (`0,0` → `2px,1px` → `0,2px` → `-2px,1px`) advancing inside the changeover
motion. Nothing holds a static high-contrast edge longer than one shift.

```
--t-hero    min(6.5rem, 28vh, calc((100cqi - 3.5rem) / (var(--len) * 0.66 + 0.6)))
--t-count   5.5rem      both countdowns
--t-clock   2.5rem      time to the next change
--t-name-2  1.75rem     sub name, and the outgoing name
--t-elapsed 1.125rem    time played
--t-row     1.0625rem   setup rows, fields, settings
--t-strip   0.875rem    the order strip
--t-label   0.6875rem   every label. uppercase, 600, .1em tracking, --ink-3
```

`--len` is the longest name across both squads, floored at 5; `0.66` is the average uppercase
advance at weight 800 with `-0.025em` tracking and `0.6` pays for the ↑ and its gap during the
window. Both teams take the same size — neither outranks the other. `container-type:
inline-size` on the team row, `overflow: clip` as a backstop, `maxlength="8"` at setup, since a
longer name is one nobody can read at four metres. Game-screen names are uppercase: it removes
descender space and buys ~15% more cap height. Setup keeps what was typed.

---

## Setup

One design. **24 elements → 12.**

**Merged.** Add button inside its field (cost: none — it acts on the thing it sits in). Each
setting is one self-describing control, not a label plus a control (cost: scannability). The
divider carries its own label (none). Kick off and the running-game chip share a slot (none).

**Deleted.** Both squad counts (count the rows). The page title and the settings heading (two
name lists and a Kick off button say what the screen is). Every derived number — interval, subs
per team, shifts each — since sub duration is now set directly. Help text about ordering (the
divider label and the drag are the explanation). A separate goalkeeper control (it is a tap on a
name). The old mid-game roster sheet, 6 elements, whose job moved to the edit route.

### The field, which is the whole point

The last version failed because it did not look like an input. This one cannot be mistaken.

```
.field   44px landscape / 52px portrait, full column width
         #FFFFFF, border 2px solid --ink, radius 12, padding 0 4px 0 12px, margin-top 8px
input    --t-row, 600, no border, no outline. placeholder --ink-3 at 400
.add     34px circle (40px portrait), Lucide arrow-up, 20px, stroke 2.4
         empty:  transparent, 1.5px --dim border, --ink-3 glyph
         armed:  --on fill and border, white glyph, 150ms
```

It is the only 2px border in the product, and the ↑ arming on the first keystroke is the field
demonstrating what it does once per name, instead of a sentence of help. It sits **immediately
below its own list** and the new name lands directly above it — the action and its consequence
share a position. The list is `flex: 0 1 auto`, so on an empty screen the field is the second
thing in the column and grows downward; once the list fills the column it scrolls and the field
is pinned to the bottom. After a commit, scroll the list to the end so the name lands in view.

Required: `maxlength="8" autocapitalize="words" autocorrect="off" autocomplete="off"
spellcheck="false" enterkeyhint="next"` — autocorrect mangles names and a mangled name gets
spoken aloud. Return or ↑ commits and keeps focus. Viewport meta, all of it:
`width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`.

### The list

Row: 36px landscape / 48px portrait, radius 10, `--surface`, `inset 0 0 0 1px --hair`,
padding `0 6px 0 12px`, 4px between rows, `--t-row` at 600. A 24px `--dim` ✕ at the right
removes the name.

- **Drag anywhere on the row** to reorder. It takes elevation 1 and `scale(1.02)`; the others
  move on a 200ms transform; the gap it left stays open.
- **Tap a name to make them the starting keeper.** The row fills `--ink` with white text and a
  `--t-label` prefix at 60% white saying what the fill means. Tapping a name below the divider
  moves them to the last pitch position first, 250ms — one rule, no dead rows. One filled row
  per team at most.
- **No row is filled by default.** The first keeper is drawn at random at kick-off and the
  countdown is where the draw is revealed. A filled row means a human overrode it.
- **The divider** sits after position `gameType`: a `--t-label` word, 8px, then a 1px `--dim`
  rule to the column edge; 6px above, 2px below. Absent when the squad is not larger than
  `gameType`.

### Settings and Kick off

Three self-describing controls — `--t-row` at 500 on `--surface`, 44px, radius 12, inset
hairline, an 18px chevron right, a native `<select>` underneath. 4–11 a side (default 6), game
time (default 2 hours), sub duration (default 10 min). Placeholder wording; the copywriter owns
it. Kick off: 52px, radius 14, `--ink` fill, white label — **the only filled ink button in the
product**. With either squad under 2 names it is a hairline button on transparent and tapping
it focuses the short field. No disabled control, no dead primary.

### Layout

**Landscape** — `padding: 12px 24px`, `grid-template-columns: 1fr 1fr 13rem`, `gap: 16px`. Two
team columns and a settings column. Each team column: label (16px, 4px below), list, field.
The settings column is the three controls, a `1fr` spacer, then Kick off — bottom-right, in
the thumb, nowhere near the lists. At 390px tall the list shows 7 rows plus the divider and
scrolls beyond that. The field never scrolls away.

**Portrait** — one column, `padding: 16px 16px 76px`, `gap: 24px`. Lists are not internally
scrollable; the page scrolls, which is what a form should do with a keyboard up. Kick off is
`position: fixed` at the bottom over a 92px `linear-gradient(transparent, --ground)`. No
shadow.

---

## Kick-off

The wait is where this product gets a personality, so it is not a splash screen — **it is the
game screen, already assembled, with the count where the clock will be**, and you spend ten
seconds reading the starting state, including the keeper the app just drew.

```
t 0       crossfade from setup to the game layout, 300ms
          count reads 10 at --t-count / 800 / --ink / tabular
          no edit icon; a --t-label line in its place says the screen can be tapped to
          go back. the only signpost in the product, in the one moment nothing else
          is happening
t 1–10s   each second swaps instantly, then scale(1.08 → 1) over 180ms
          the last five carry a tick: sine 880Hz, 30ms, gain .08
any tap   abort, straight back to setup, nothing kept
t 10s     whistle: sawtooths at 2350Hz and 2570Hz, tremolo 18Hz, 700ms,
          40ms attack, 250ms release
          ground to #FFFFFF and back over 500ms
          the count is replaced by the clock and the elapsed readout
          speechSynthesis speaks both teams' keeper and sub
```

---

## The game screen — three variations

Naive count from the brief: **26**. All three at landscape 844×390.

### A — Two rows, one sentence each ← **BUILD THIS**

Each team is one row, reading as Liam's own sentence, stacked: the team, the sub, the keeper
in the loud slot, one line of order underneath. **26 → 15.**

| Merge | Cost |
|---|---|
| team name + sub name → one quiet top line, tag left, sub right | none |
| the strip is order, who is playing, and who has gone home (struck) | discoverability |
| the final-ten-seconds clock and the changeover are one state, not two | none |
| the keeper slot holds the current keeper at rest, the incoming keeper in the window | learnability |
| ground colour is the change signal and the burn-in mitigation | none |

Deleted: every container, border, icon and shadow except two hairlines and the edit icon.

Added, and what each buys. **The elapsed readout** — game time was kept only so the screen can
show time played, and it doubles as the overtime state, so it costs no second element. **The
edit icon** — his own answer to prescriptive labels. **The pending-edit line**, conditional —
without it an edit reads as ignored for up to ten minutes. **The degraded line**, conditional —
wake lock or voice lost, one tap fixes it; without it the screen sleeps at minute forty and
nobody knows why. Kept against the reduction, deliberately: **the GOAL and SUB labels**. The
pure version lets size carry role; eleven pixels of grey is cheap insurance against exactly the
failure that just happened, and it costs the hero nothing measurable.

### B — The board

Clock bar on top, two panels side by side, GOAL / SUB / ON columns with the squad under them.
**26 → 23**, no merge of consequence. Four name slots and two header rows share a 380px column,
so the keeper falls to about `3rem` — cap height 5.9 mm, legible at 1.5 m. It fails the
distance table, and a team with no sub shows an empty column under a live header, which is what
makes a screen look broken. It is a dashboard, the thing he said he did not want. It loses.

### C — The pitch

A rectangle, a halfway line, a goal mouth at each end with the keeper's name inside it, the
sub's name on the touchline outside. **26 → 11** and no labels at all, because position is the
label. The changeover becomes literal — the sub's name walks in from the touchline as the
keeper's name walks out of the goal.

It loses on geometry: the goals are 844px apart, so reading both teams is a scan, not a glance;
the goal mouth is a narrow box at the frame's edge, so the name in it is small, the opposite of
what the distance table demands; and who is playing becomes a fiction, because the pitch looks
full whether it is or not. A takes the one thing it gets right — **direction is spatial**: on is
up and green, off is down and red, and the outgoing name sits physically below the incoming one.

**Recommendation: A**, the only variation where the loudest thing on screen is always the answer
to the question the product exists to answer.

---

## A, exact

```
main   grid; grid-template-columns: 1fr 8.5rem; grid-template-rows: 1fr 1fr
       column-gap: 24px
       padding: max(12px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right))
                max(12px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))
       transform: translate(var(--drift-x), var(--drift-y))
```

Safe-area padding is not optional: in landscape the Dynamic Island takes ~59px from one side and
the home indicator 21px from the bottom. Measured team row at 844×390: **636 × 183px**, keeper
at 98.6px for an 8-character name and 104px (the `6.5rem` cap) for anything shorter. The row is
`container-type: inline-size`, `align-content: center`, `padding: 8px 0`, four auto rows; the
second gets `border-top: 1px solid --hair`.

```
line 1   flex, baseline, height 22px, margin-bottom 2px
         team tag   --t-label, left
         sub group  right: --t-label + name at --t-name-2 / 700 / --ink / uppercase
                    the whole group is absent when the team has no sub
line 2   flex, align-items center, gap 12px
         GOAL       --t-label
         keeper     --t-hero, 800, line-height .94, tracking -.025em, uppercase, nowrap
line 3   height 30px, margin-top 10px
         rest: the order strip. window: the outgoing name
```

Line 3 is a fixed 30px in both states, so nothing moves between them.

**The strip** is the goal order left to right, starting with the current keeper — leftmost *is*
the pointer, so nothing marks it. Separator `·` in `--dim` with `.34em` either side; a player
gone home is `--dim` and struck through; `mask-image: linear-gradient(to right, #000 88%,
transparent)` says the loop continues, which is true. It is the only answer to "who is playing"
that is one line rather than a list.

**Spine**, spanning both rows, `border-left: 1px solid --hair`, centred, `gap: 6px`: time to
the next change at `--t-clock` / 600 / `--ink` / tabular; time played at `--t-elapsed` / 500 /
`--ink-3` / tabular; a 24px Lucide `pencil` in `--ink-3` in a 44px target pinned bottom-right.
Conditional lines sit at `--t-label` above the icon.

**Portrait.** One column: the spine becomes a top bar (clock, elapsed, edit pushed right,
`border-bottom` not `border-left`), then the two rows, `align-content: space-around`. The sub
group wraps onto its own line under the tag. `--t-hero` becomes `min(6rem, 22vh,
calc((100cqi - 3.5rem) / (var(--len) * 0.66 + 0.6)))` — 77px for short names, 51px for the
longest. Line 3 drops to 26px, names to `1.5rem`.

---

## The changeover

**The window is the last ten seconds of the shift, not the first ten of the next.** A warning
beats a report — players need to be walking before the swap — and it keeps the rest state
honest, because the screen never names a keeper who is not currently in the goal.

**The arrows describe the player, not the slot.** In GOAL, ↑ green goes into goal and ↓ red
comes out. In SUB, ↑ green comes onto the pitch and ↓ red goes off it — so the *new* sub name
is the red one. The label above each slot carries the domain.

```
t 0      = T−10s. sine 660Hz then 880Hz, 120ms each, 200ms apart, 20ms attack
         speechSynthesis speaks the change
         ground → #FFFFFF, 200ms. drift advances one step, 600ms
         clock swaps instantly to 10 at --t-count / 800 / --ink
t 0–140  hold. the stillness is what makes the move read as a consequence
t 140    keeper out:  --ink → --off, translateY(0 → +38px), scale to --t-name-2, 500ms,
                      landing on line 3 in place of the strip with a leading ↓
         keeper in:   enters the hero slot, translateY(28px → 0), opacity 0 → 1, 460ms,
                      colour --on, leading ↑ at .42em, vertical-align .16em
         strip:       opacity 1 → 0 over 180ms, then display none
t 200    sub slot the same at --t-name-2: the new sub turns --off with a ↓, the old sub
         joins it in --on with a ↑, 400ms
t 640    settled. colours, arrows and the count hold for the rest of the window
t 1–9s   the count swaps instantly each second. no scale, no sound — the ticks belong to
         kick-off, and a beep a second for ten seconds on a touchline is noise
t 10s    = T. one peep: sine 1200Hz, 90ms
         ground → --ground, 300ms; green name → --ink and the ↑ fades, 250ms
         the outgoing name fades out, the strip rebuilds and fades in, 250ms
         no travel on the way back. this must never be mistaken for a change
```

600ms, not the 250ms a UI transition gets: this is not feedback for a touch, it is a broadcast
to people who are not looking, and slow movement is what peripheral vision catches. `transform`
and `opacity` only — never animate `font-size`. **Reduced motion**: no travel, every step
becomes a 200ms opacity crossfade in place, the strip rebuilds instantly, the drift jumps, and
the ground lift and the colours stay — they are not motion, and they are the only signal that
survives past six metres.

---

## The edit route

Build this last. It touches nothing above it.

The pencil returns to the setup screen, unchanged, **with the game still running**. The proof is
in the corner the game started from: where Kick off was there is now a 52px chip, 2px `--ink`
inset, a `--t-label` line and the live countdown at `1.5rem` tabular, ticking. The chip is also
the way back — one slot, two meanings, always the true one.

**The clock never resets, and an edit never lands mid-shift.** Any change — a name added or
removed, a reorder, a new sub duration, a new game type — takes effect at the **next change**,
so nobody is pulled out of goal early and no shift is cut short. Store one rebase record beside
the setup and the kick-off timestamp: the elapsed time of the next change boundary and the
keeper index in force there. The rotation stays a pure function of `(setup, rebase, elapsed)`,
so a dead phone still restarts and carries on.

- **Nothing changed** → nothing happens. No dialog, no save, no confirmation. Tap the chip.
- **Something changed** → back on the game screen, one `--t-label` line under the clock says
  the change lands at the next swap. It clears itself at the change.
- **A change fires while setup is open** → the screen is not yanked away from someone typing.
  The voice carries it, which is the primary channel anyway, and the countdown resets.

Gone home and turned up late live here too — both are a row added or removed, and neither needs
a surface of its own.

---

## States

Specified in place above: empty and one-name setup (the field), a squad smaller than `gameType`
(the divider), the keeper override (the list), no sub and uneven teams (line 1), at rest and the
changeover window (the motion table), past game time (the elapsed readout). What is left:

- *Setting changing* — the native wheel; the divider moves live when `gameType` changes.
- *A full squad in landscape* — 7 rows and the divider are visible, the rest scrolls, and the
  field never scrolls away.
- *Restored* — read the setup, the kick-off timestamp and the rebase, compute from `Date.now()`,
  straight to the game screen at rest. No dialog, and no voice for changes missed while the
  phone was dead. Past `gameTime + 60min`, discard and open setup with the squad prefilled.
- *Degraded* — wake lock or voice lost: one `--t-label` line under the clock, and any tap
  re-takes the lock and re-tests the voice. Unlock the voice on the Kick off tap, where a
  gesture already exists.
- *Alive* — the ticking clock is the only proof the app is running, so it is never hidden.

---

## What I think is wrong

1. **Ten seconds of countdown at every change will annoy people by minute forty.** The voice
   plus a five-second window is probably enough. Ship ten, watch one game, cut it.
2. **Game time earns almost nothing.** One small readout and one `+` prefix. If nobody looks at
   it, delete the setting and count up from zero.
3. **The random first keeper removes the only punctuality incentive** the old spec had. Fine —
   it was backwards anyway — but nothing in the product now rewards turning up on time.
4. **"No sub to goal, no goal to sub" can deadlock** on a squad of exactly `gameType + 1`, where
   some shifts have no legal move left. The engine needs a stated tiebreak, and the design
   cannot hide it: whatever it picks, the screen says it out loud.
5. **Two lists means two chances to type the same person twice.** Nothing here catches it, and a
   duplicate gets spoken aloud on the wrong team.
