---
read when: You build or change a screen.
---

# design

Two screens. Static HTML/CSS/vanilla JS, system fonts, no build step. Landscape is the game and
portrait the setup, but all four combinations are designed here and verified at 844×390 and
390×844.

## The type system

**Five sizes, each 1.5× the last, and the whole screen drops one rung on a narrow phone.** That
is the system. Every type value in this file is one of these ten numbers.

| step | wide ≥800px | narrow <800px | its job | reads at |
|---|---|---|---|---|
| `hero` | 60 / 3.75rem | 40 | the name in goal | 2 m |
| `count` | 40 / 2.5rem | 27 | the countdown | 1.3 m |
| `lead` | 27 / 1.6875rem | 18 | the sub, and any name leaving a slot | 0.9 m |
| `body` | 18 / 1.125rem | 18 | setup rows, fields, settings, the order strip | 0.6 m |
| `eyebrow` | 12 / 0.75rem | 12 | every label, and the team title | 0.4 m |

**The reading distance is 2 metres, not 20.** The voice carries the names to the pitch; a person
walks over to *check*, and 2 m is where you stop. Legible cap height is distance ÷ 250, so 8 mm;
a phone renders ~0.183 mm per CSS px and cap is .72 em, so 8 mm of cap is **60 px** of type.
1.5× in size is then 1.5× in distance — each step down the scale is a step closer to the screen.

Narrow drops the top three steps one rung; the bottom two are a legibility floor and hold. One
media query covers portrait and small landscape phones. In narrow, `lead` and `body` land on the
same rung — weight and colour keep them apart. **There is no clamp and no container query.** A
ten-character name (the `maxlength` in `copy.md`) measures 362 px at `hero` against 463 px of
column in landscape, and 243 px against 358 px in portrait.

**Two weights**: 700 for names, clocks and eyebrows, 500 for everything else. **Tracking** by
step: −.02em at `hero` and `count`, −.01em at `lead`, 0 at `body`, +.1em at `eyebrow`. **Line
height** .94 on names, 1.2 elsewhere.

**Everything is uppercase.** Every name, every label, every team title, on both screens, set with
`text-transform` in the stylesheet. The stored value stays exactly as it was typed and the voice
still speaks a normal name, so the app never has to care whether someone wrote `dom`, `Dom` or
`DOM`. Nothing in the engine changes and no string is rewritten.

**Case therefore separates nothing, and three registers do all of it.**

| register | size | weight | tracking | colour |
|---|---|---|---|---|
| a **player name** | `hero` or `lead` | 700 | −.02em / −.01em | `--ink` |
| a **label** | `eyebrow` | 700 | +.1em | `--ink-3` |
| a **team title** | `eyebrow` | 500 | +.28em | `--ink-3` |

A label sits **directly above** what it names, never beside it: over a name, over a setting, over
a list. A team title sits above the whole group and names the row, not a slot in it.

**The team title is the quietest thing on the screen, and that is its whole design.** It has one
job — say which row this is — and two ways to fail: it can be mistaken for a player name, or it
can compete with the keeper. The pill failed the second. So the title is not another shape with a
word in it; it is a word set the way no name is ever set. It is the same size as the `GOAL` label
beside which it sits, **lighter** than it, and stretched to +.28em, which is a texture the eye
reads as a category before it reads the letters. No container, no fill, no rule, no ink. Three
signals separate it from a name — size, weight and tracking — and one separates it from a label,
which is the only place a reader could still put it: it is 200 units lighter and nearly three
times as wide.

## The space system

**Five steps, the same shape as the type scale and the same ratio, 1.5, rounded to even pixels.**
Every margin, every padding and every gap on the game screen is one of these five. If a gap needs
a number that is not here, the layout is wrong, not the scale.

| step | px | its job |
|---|---|---|
| `--s-tie` | 4 | ties a label to the thing it names |
| `--s-pack` | 6 | packs the inside of one control |
| `--s-part` | 10 | parts one group from the next inside a region |
| `--s-edge` | 16 | holds two peers apart: a region from its neighbour's rule, a name from the name beside it |
| `--s-gutter` | 24 | the page edge, and the gutter between two columns |

**Spacing encodes relationship, so the steps have to run in the same order as the groups.** On a
team row, reading down: `GOAL` sits `--s-tie` above its name, the title sits `--s-part` above the
pair it opens, and the row sits `--s-edge` from the rule that divides it from the other team. Four
apart, ten apart, sixteen apart — a label is always nearer its own thing than the next thing.

**The gap between the name and the strip is not on the scale, and must not be.** It is whatever
height the row has left, because the strip is pinned to the bottom. On a 390 px landscape it
comes out at about 35 px, which is more than `--s-edge` — so the strip reads as the furthest
thing from the name, which is what it is.

**Two exceptions, both type and not layout.** The arrow's `.1em` and the strip separator's
`.34em` are set in ems because they ride the size of the name beside them. A gap inside a line
that is being shrunk to fit takes the same `--fit` multiplier the type does; a gap that did not
shrink would push the last name out of its column.

## Tokens

```
--ground      #F2F2F0   page, rest state         --on     #0F6B2F  going in / coming on
--ground-call #FFFFFF   page, changeover         --off    #A5261A  coming out / going off
--surface     #FFFFFF   rows, fields, settings   --hair   #DCDCDA  the hairlines
--ink         #121214   names, the live bar      --dim    #BFBFC4  separators, ✕, a bound
--ink-3       #6E6E76   labels, the team title   --border #D4D4D6  a control that needs an edge
--curve       cubic-bezier(0.2, 0, 0, 1)
space         the five steps above. see The space system
radius        12, and full for pills, circles and round targets. that is all
elevation     one: 0 8px 24px rgba(0,0,0,.12), on a row while it is dragged
icons         Lucide, 24px at stroke 2 in a 44px target; 20px at stroke 2.2 inside a control
font          ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
```

**Light ground, not dark**: in daylight the glass mirrors the sky, and on a dark ground that
reflection is most of the light leaving the screen. No theme toggle — a toggle is a decision.
**`--on` and `--off` are never alone**: direction carries it (↑ on, ↓ off), colour is third.
**Burn-in** — the ground alternates at every changeover, the names change every shift, and a
4-step drift on `<main>` (`0,0` → `2px,1px` → `0,2px` → `-2px,1px`) advances inside the motion.

---

## The game screen — three variations

Type and hierarchy only; everything else is one design. Naive count **22**, all at 844×390.

### A — Team, role, name ← **BUILT**

Three registers descending in specificity, stacked: the team title, the role eyebrow, the name.
Two role columns per team — goal at `hero`, sub at `lead` — over one shared line pinned to the
bottom of the row. **22 → 15.**

| Merge | Cost |
|---|---|
| the title is the team name and the bib, said quietly | none |
| line 3 is the order strip at rest, the two outgoing names in the window | discoverability |
| one clock at one size all game, the change window included | none |
| the countdown and the changeover are one state, not two | none |

Deleted: the time-played readout, every container, every border, and every icon except two
hairlines, the pencil and the mute.

### B — The shared header

The eyebrows appear once as a header row, the two teams aligned under them in a table.
**22 → 13** — two fewer than A, and worse. In the second row the label sits 120 px from the name
it names, which is the one relationship that has to survive at 2 m, and an empty cell under a
live header is what makes a screen look broken when a team has no sub. It is a dashboard.

### C — The bib is the ground

The Bibs half is an ink panel with white type, the No bibs half the light ground; the team is
never text, so both pills go. **22 → 13**, and misreading a team as a player becomes impossible.
It loses on the ground: half the screen is dark, which is the glare argument the light ground
was chosen against, a static high-contrast edge runs for two hours where the drift cannot save
it, and the changeover's ground lift then works for one team only.

**Recommendation: A.** The largest of the three, and it keeps the two elements the others delete,
because those two are what stop `BIBS` reading as a player. B and C both delete the team title;
A keeps it and makes it quiet instead, which is the cheaper answer to the same problem.

---

## A, exact

**A team row is one column with space between.** The title, the two eyebrows and the two names
are one group at the top. The order strip is pinned to the bottom of the row, so the row uses its
whole height and there is no dead band under it. The void in the middle is not dead either: it is
the runway the outgoing keeper walks down at the changeover, and a longer walk is easier for
peripheral vision to catch, which is the whole reason that movement is slow.

```
main     grid; grid-template-columns: minmax(0,1fr) 9.5rem; column-gap --s-gutter
         padding: max(--s-edge, env(top)) max(--s-gutter, env(right))
                  max(--s-edge, env(bottom)) max(--s-gutter, env(left))
         grid-template-rows: 1fr 1fr
         transform: translate(var(--drift-x), var(--drift-y))
team     flex column, justify-content: space-between, overflow: clip
         row 0 — padding-bottom --s-part
         row 1 — border-top 1px --hair, padding-top --s-edge
top      grid; minmax(0,2.25fr) minmax(0,1fr); column-gap --s-gutter
         title  — eyebrow / 500 / +.28em / --ink-3, spans both, margin-bottom --s-part
         row 2  — the two eyebrows, margin-bottom --s-tie
         row 3  — the keeper at hero, the sub at lead, align-self: end
bottom   the same two columns. height and line-height are lead x 1.2, which is
         the tallest thing that ever sits there. at rest the strip spans it; in
         the window each column holds the name leaving that slot
spine    border-left 1px --hair, padding-left --s-edge, flex column, right aligned
         clock at count, tabular, centred by auto margins
         a conditional eyebrow, then home, mute and pencil as 44px targets
```

**One hairline in the whole section, and it is the seam between the two teams.** Nothing else is
drawn — no rule beside a title, no border on a row. It has to exist, because space cannot do this
particular job: the strip is further from its own name than the two teams are from each other, so
without a line the strip would read as belonging to the team below it. The rule leans toward the
row it closes — `--s-part` above it, `--s-edge` below — so it reads as a full stop and not as a
divider floating between two equals.

Safe-area padding is not optional: the Dynamic Island takes ~59px from one landscape side and
the home indicator 21px from the bottom. **The strip** spans the bottom line at rest: the goal
order from the current keeper left to right, so nothing marks the pointer. `body`, 500,
`--ink-3`, uppercase, `·` in `--dim` with `.34em` either side, a player gone home struck through
in `--dim`, and `mask-image: linear-gradient(to right, #000 86%, transparent)` because the loop
continues.

**Portrait.** One column, side padding `max(--s-edge, env(...))`. The spine becomes the band
between the two teams — `border-top` and `border-bottom`, `padding: --s-part 0`, clock left,
icons right — because both teams change on the same clock, so the clock is the seam, and it
replaces the landscape rule so the team rows carry none. The role columns hold.

**Portrait rows are content height, not `1fr`.** A third of 844 px is 349, and a team needs 126,
so stretching the row would put 200 px between a name and its own strip and the pin would stop
meaning anything. Instead the rows are `auto`, the pin inside a row becomes one `--s-gutter`, and
`align-content: space-evenly` spreads the surplus between the three blocks and the two edges. The
air lands around the groups instead of inside them, which is the same rule the landscape spacing
runs on. No type value is overridden; the rung-down rule has done it.

**The mute.** `volume-2` in `--ink-3`, on by default. Muted is not a quieter icon but a louder
one: `volume-x` inside a filled 28px `--off` circle, plus the spine's conditional eyebrow.
Filled among two outline icons reads at a glance without depending on colour, and it is the same
size and weight as the pencil beside it, so it is not a second primary. **It appears wherever
the voice is live** — the game screen and the live bar — and nowhere on setup before kick-off.

---

## The changeover

**The window is the last ten seconds of the shift, not the first ten of the next.** A warning
beats a report, and the screen never names a keeper who is not currently in the goal. **One rule
for both slots: the name line holds whoever occupies that slot after the change, line 3 holds
whoever is leaving it.** The arrow describes the player, not the slot, so the incoming keeper is
green ↑ and the incoming sub is red ↓ — he is coming off the pitch. The eyebrow never changes.

```
t 0      = T−10s. chime, then speechSynthesis speaks the change
         ground → #FFFFFF, 200ms. drift advances one step, 600ms
t 0–140  hold. the stillness is what makes the move read as a consequence
t 140    keeper out: --ink → --off, translateY down to the bottom line, scaling to lead,
                     500ms, landing with a leading ↓. the travel is measured, not fixed —
                     it is the height the row has left, so it grew when the strip was
                     pinned to the bottom
         keeper in:  enters the hero slot, translateY(28px → 0), opacity 0 → 1, 460ms, --on,
                     leading ↑ at .42em, vertical-align .16em
         strip:      opacity 1 → 0 over 180ms, then display none
t 200    sub slot the same at lead: the new sub turns --off with a ↓, the old sub joins it
         on line 3 in --on with a ↑, 400ms
t 640    settled. colours, arrows and the count hold for the rest of the window
t 1–9s   the clock ticks down as it always does. no size change, no sound
t 10s    = T. whistle. ground → --ground 300ms; green → --ink and the ↑ fades, 250ms;
         the outgoing names fade, the strip rebuilds and fades in, 250ms. no travel back
```

600ms, not the 250ms a UI transition gets: this is a broadcast to people who are not looking,
and slow movement is what peripheral vision catches. `transform` and `opacity` only — never
`font-size`. **Reduced motion**: every step becomes a 200ms opacity crossfade in place, the
drift jumps, the ground lift and the colours stay.

**Kick-off** is the same screen already assembled, with the clock counting down from ten, so the
wait is spent reading the starting state including the keeper just drawn. Each second swaps
instantly then `scale(1.08 → 1)` over 180ms; the last five carry a tick (sine 880Hz, 30ms, gain
.08). The mute is present, the pencil is not, and any tap aborts back to setup.

---

## Setup

One design. **24 elements → 12.** Merged: the add button inside its field (cost: none — it acts
on the thing it sits in); the divider carries its own label (none); Kick off and the live state
share a slot and a fill (none). Deleted: both squad counts, the page title, the settings
heading, every derived number, all help text, the separate goalkeeper control.

```
field    44px landscape / 56px portrait, full column width, #FFFFFF, 2px solid --ink,
         radius 12, padding 0 5px 0 12px, margin-top --s-pack
input    body / 700, no border, no outline. placeholder --ink-3 at 500
add      34px circle (40px portrait), arrow-up at 20px
         empty: 1.5px --dim ring, --ink-3 glyph. armed: --on fill, white glyph, 150ms
row      36px landscape / 52px portrait, radius 12, --surface, inset 0 0 0 1px --hair,
         padding 0 --s-pack 0 --s-edge, --s-tie between rows, body / 500
         the last child in a list drops its margin — dead space in a scroll box
         remove: 28px target, 16px ✕ in --dim, hard right
divider  eyebrow, --s-pack, a 1px --dim rule to the column edge. --s-tie above
picker   72px card, radius 12, --surface, inset 0 0 0 1px --hair, padding-top 6px
         eyebrow at padding-left 14px, then 44×44 minus | value at body/700 tabular,
         centred | 44×44 plus. glyphs 20px --ink; --dim and inert at a bound
kick off 56px, radius 12, --ink fill, white body / 700
```

**The field** is the only 2px border in the product, and the arrow arming on the first keystroke
is the field demonstrating itself once per name instead of a sentence of help. It sits
**immediately below its own list** and the new name lands directly above it. Required:
`maxlength="10" autocapitalize="words" autocorrect="off" autocomplete="off" spellcheck="false"
enterkeyhint="next"` — autocorrect mangles names and a mangled name gets spoken aloud. Viewport
meta, all of it: `width=device-width, initial-scale=1, viewport-fit=cover,
interactive-widget=resizes-content`.

**The list.** Drag anywhere on the row to reorder: it takes the shadow and `scale(1.02)`, the
others move on a 200ms transform, the gap it left stays open. Tap a name to make them the
starting keeper: the row fills `--ink` with white text and an eyebrow at 60% white, right
aligned so every name keeps the same left edge; a name below the divider moves to the last pitch
position first, 250ms. One filled row per team, none by default — the keeper is drawn at random
and the countdown reveals it. The divider sits after position `gameType`, absent when the squad
is not larger than it.

**The pickers.** One component, three instances, no native `<select>`. Press and hold repeats
after 400ms at 8 a second. Ranges: game type 4–11 by 1; game time 30 min–3 h by 15; sub duration
3–20 min by 1. Two 44px targets and a number is the most a cold thumb can be asked for, it needs
no overlay and no dismiss, and it is identical in both orientations. **Kick off** is the only
filled ink surface in the product except the live bar. Under two names it is a hairline button
on transparent, and tapping it focuses the short field. No disabled control, no dead primary.

**Landscape** — `padding: --s-part` with `max(--s-gutter, env(...))` at the sides,
`grid-template-columns: minmax(0,1fr) minmax(0,1fr) 13rem`, `gap: --s-edge`. A team column is
the heading, the list (`flex: 0 1 auto`, `overflow: auto`) and the field pinned under it. The
settings column is the three cards, a `1fr` spacer, then Kick off — bottom right, in the thumb,
nowhere near the lists.

**The divider and the first sub have to be on screen at 844×390.** The only reason the `SUBS`
line exists is to say who is a sub, and a line with nothing readable under it says nothing. Six
on the pitch, the divider and a seventh name is 298 px of list, and 390 px of phone leaves 298
after the heading, the field and the page padding — so it fits exactly, with no scroll, at a
game type of six. It fits by four decisions and not by luck: a 36 px row in landscape only, a
44 px field, `--s-pack` where `8px` and `12px` used to be, and no trailing margin on the last
row in the box. An eighth name scrolls, which is correct — the first sub is what has to be
visible, not every sub.

**Mid-game the list scrolls.** The live bar takes 68 px off the top, which is more than a row
and a divider, so the divider falls below the fold on a 390 px landscape and the list has to be
scrolled to reach it. Nothing shorter than the bar is available: it carries the countdown at
`count`, which is 40 px of type.

**Portrait** — one column, `display: flex`, `gap: 28px`, `padding: 16px 16px 96px`; the page
scrolls, the lists do not. **The settings come first**, because the game type sets where the
divider falls and you pick it before typing a name. Kick off is `position: fixed` at the bottom
over a 96px `linear-gradient(transparent, --ground 60%)`. No shadow.

---

## The live-game state

**The ink moves.** Before kick-off the only ink surface is a 56px button in the bottom-right
corner: small, in the thumb, an action waiting for you. During the game that button is gone and
the ink is a full-bleed bar across the top — 56px plus the top safe area in landscape, 64px in
portrait — carrying the live countdown at `count` / 700 / white / tabular on the left, the mute
and a 44px `x` on the right, and a conditional eyebrow at 60% white on one line beside the clock
when an edit is pending. Setup takes `padding-top: 68px` / `80px` under it. Size, position,
colour and content all invert, so the two states cannot be mistaken at a glance, and the `x` is
the way back.

**Inside the lists, the filled row becomes a readout.** Mid-game it marks whoever is in goal
right now and moves at every change. It is not tappable: the rotation is a clock, and the keeper
is not a setting once the game has started.

**The clock never resets and an edit never lands mid-shift.** Any change takes effect at the
**next change**. Store one rebase record beside the setup and the kick-off timestamp: the
elapsed time of the next boundary and the keeper index in force there, so the rotation stays a
pure function of `(setup, rebase, elapsed)`.

- **Nothing changed** → nothing happens. No dialog, no save, no confirmation.
- **Something changed** → the spine's conditional eyebrow says it lands at the next swap, and
  clears itself there.
- **A change fires while setup is open** → nobody is yanked away from typing. The ground lifts to
  white, the bar's countdown resets, the voice carries the rest.

Gone home and turned up late live here too — both are a row added or removed.

---

## States

Empty setup, a short squad, the keeper override, no sub, at rest, the change window, muted and a
pending edit are all specified in place above. What is left:

- *Full squad, landscape* — six rows and the divider show, the rest scrolls, the field never does.
- *Restored* — read the setup, the kick-off timestamp and the rebase, compute from `Date.now()`,
  straight to the game screen at rest. No dialog, and no voice for changes missed while the
  phone was dead. Past four hours, discard and open setup with the squad prefilled.
- *Degraded* — wake lock or voice lost: the spine's conditional eyebrow, and any tap re-takes the
  lock and re-tests the voice. Unlock the voice on the Kick off tap.
- *Alive* — the ticking clock is the only proof the app is running, so it is never hidden.

## What I think is wrong

1. **The game time setting should not exist.** It drives nothing in the engine, and with the
   time-played readout gone it displays nothing either. A control with no consequence is exactly
   the button `spec.md` says is the wrong button. It is drawn here because it was asked for;
   delete it and the settings column loses one card and nothing else changes. The four-hour
   restore window is already a constant, not a derivation.
2. **`copy.md` says a connective is lowercase and small.** That was written for the inline
   sentence the eyebrows have replaced, and an eyebrow is a label, not a connective. The eyebrow
   renders uppercase and tracked; the copywriter still owns the words.
3. **Ten seconds of countdown at every change will annoy people by minute forty.** Ship ten,
   watch one game, cut it to five.
4. **"No sub to goal, no goal to sub" can deadlock** on a squad of exactly `gameType + 1`. The
   engine needs a stated tiebreak, and whatever it picks the screen says it out loud.
5. **Two lists, two chances to type the same person twice** — and a duplicate gets spoken aloud
   on the wrong team.
6. **The space scale is the law on the game screen and not yet anywhere else.** Ten values on
   setup, the live bar and the confirm card are still literals: `5px` and `12px` inside the
   field, `8px` on the settings column, the foot and the confirm row, `14px` on a picker label
   and inside the live bar, `20px` on the confirm card, `28px` between portrait sections, and
   `68px` / `80px` / `96px`, which are all derived from the live bar's own height. Bringing them
   across changes the setup design, which is why this pass did not.
7. **This file is 392 lines against a 200-line cap.** Variations B and C describe alternatives to
   a design that has now been built and revised twice, and nobody will go back to them. They are
   the first thing to cut when someone is allowed to.
