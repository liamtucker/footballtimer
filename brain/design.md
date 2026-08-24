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
| `eyebrow` | 12 / 0.75rem | 12 | every label, and the team tag | 0.4 m |

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

**Three registers, and they cannot be confused.** A **player name** is uppercase, 700, `hero` or
`lead` — on setup only it is left as typed, because there it is data being edited. A **label** is
uppercase, tracked, `eyebrow`, `--ink-3`, and sits **directly above** what it names, never
beside it: over a name, over a setting, over a list. A **team** is sentence case, `eyebrow`, in a
pill — the only sentence case on the game screen and the only text in a container, `Bibs` filled
ink and `No bibs` a hairline outline, so **the pill is the bib**. Three signals, so a team can
never be read as a player.

## Tokens

```
--ground      #F2F2F0   page, rest state         --on     #0F6B2F  going in / coming on
--ground-call #FFFFFF   page, changeover         --off    #A5261A  coming out / going off
--surface     #FFFFFF   rows, fields, settings   --hair   #DCDCDA  the hairlines
--ink         #121214   names, the live bar      --dim    #BFBFC4  separators, ✕, a bound
--ink-3       #6E6E76   every label              --border #D4D4D6  the No bibs pill
--curve       cubic-bezier(0.2, 0, 0, 1)
space         4 · 6 · 8 · 12 · 16 · 20 · 24
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

### A — Team, role, name ← **BUILD THIS**

Three registers descending in specificity, stacked: the team pill, the role eyebrow, the name.
Two role columns per team — goal at `hero`, sub at `lead` — over one shared line. **22 → 15.**

| Merge | Cost |
|---|---|
| the pill is the team name and the bib | none |
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
because those two are what stop `Bibs` reading as a player.

---

## A, exact

```
main     grid; grid-template-columns: minmax(0,1fr) 8rem; column-gap: 20px
         padding: max(12px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right))
                  max(12px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))
         transform: translate(var(--drift-x), var(--drift-y))
teams    grid-template-rows: 1fr 1fr; the second row border-top 1px --hair
team     centred flex column, padding 6px 0
pill     eyebrow, full radius, padding 6px 11px, margin-bottom 10px
slots    grid; minmax(0,1fr) auto; column-gap 20px; align-items: end
         left  — eyebrow, margin-bottom 3px, then the keeper at hero
         right — eyebrow, margin-bottom 3px, then the sub at lead. absent with no sub
line 3   grid, same two columns, height 32px, margin-top 8px
spine    border-left 1px --hair, padding-left 16px, flex column, right aligned
         clock at count, tabular, centred by auto margins
         a conditional eyebrow, then mute and pencil as 44px targets, bottom right
```

Safe-area padding is not optional: the Dynamic Island takes ~59px from one landscape side and
the home indicator 21px from the bottom. **The strip** spans line 3 at rest: the goal order from
the current keeper left to right, so nothing marks the pointer. `body`, 500, `--ink-3`,
uppercase, `·` in `--dim` with `.34em` either side, a player gone home struck through in
`--dim`, and `mask-image: linear-gradient(to right, #000 86%, transparent)` because the loop
continues.

**Portrait.** One column, rows `1fr auto 1fr`, side padding `max(16px, env(...))`. The spine
becomes the band between the two teams — `border-top` and `border-bottom`, `padding: 10px 0`,
`margin: 20px 0`, clock left, icons right — because both teams change on the same clock, so the
clock is the seam. The role columns stack: `slots` to one column, `row-gap: 22px`, because
portrait has height to spend and no width. Line 3 drops to 26px, `margin-top: 20px`. No type
value is overridden; the rung-down rule has done it.

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
t 140    keeper out: --ink → --off, translateY(0 → +38px), scaling to lead, 500ms, landing
                     on line 3 with a leading ↓
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
field    48px landscape / 56px portrait, full column width, #FFFFFF, 2px solid --ink,
         radius 12, padding 0 5px 0 12px, margin-top 8px
input    body / 700, no border, no outline. placeholder --ink-3 at 500
add      34px circle (40px portrait), arrow-up at 20px
         empty: 1.5px --dim ring, --ink-3 glyph. armed: --on fill, white glyph, 150ms
row      40px landscape / 52px portrait, radius 12, --surface, inset 0 0 0 1px --hair,
         padding 0 6px 0 14px, 4px between rows, body / 500
         remove: 28px target, 16px ✕ in --dim, hard right
divider  eyebrow, 8px, a 1px --dim rule to the column edge. 6px above, 2px below
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

**Landscape** — `padding: 12px` with `max(24px, env(...))` at the sides, `grid-template-columns:
minmax(0,1fr) minmax(0,1fr) 13rem`, `gap: 16px`. A team column is the pill, the list
(`flex: 0 1 auto`, `overflow: auto`, six rows visible) and the field pinned under it. The
settings column is the three cards, a `1fr` spacer, then Kick off — bottom right, in the thumb,
nowhere near the lists.

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
