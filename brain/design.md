---
read when: You build or change a screen.
---

# design

Two screens and one sheet. Static HTML/CSS/vanilla JS. System fonts. No build step.

## The distance problem, settled first

The brief asks for a one-second glance at 20 metres. That is not possible. Legible cap
height is about distance ÷ 250 for a high-contrast glance. 20 m needs 80 mm of cap height.
A landscape iPhone is 67 mm tall in total.

So the display works over four ranges, and each range gets its own channel:

| Range | Channel | Carries |
|---|---|---|
| whole pitch | the voice | the incoming names |
| 6–10 m | the ground lifting to white | a change happened |
| 2–4 m | one name per team, 128 px | who is going in |
| under 1 m | the order strip | when am I |

Every size below is derived from that table. Do not shrink the name. If it drops under
`4rem` the product has failed.

---

## Tokens

```
--ground      #F2F2F0   page, wait state
--ground-call #FFFFFF   page, call state and the change lift
--ink         #121214   names            17.9:1 on ground
--ink-call    #0A0A0C   names, call state
--ink-2       #4E4E55   sub names, clock  7.9:1
--ink-3       #6E6E76   labels, strip     4.8:1
--dim         #BFBFC4   strip separators, gone players
--curve       cubic-bezier(0.2, 0, 0, 1)
space         4 · 8 · 12 · 16 · 24 · 32 · 48
radius        full for pills · 16 for the sheet · 0 everywhere else
elevation     one: 0 8px 24px rgba(0,0,0,.12), on the sheet only
font          ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
weights       400 · 600 · 800
```

**Light ground, not dark.** In daylight the glass mirrors the sky. A reflection of about
500–2000 nits sits on top of whatever the panel emits. On a dark ground that reflection is
most of the light leaving the screen and contrast collapses. On a light ground it lands on
an already bright area and the ratio holds. Dark mode is the wrong call outdoors, and the
brief says legibility beats battery. There is no theme toggle: a toggle is a decision, and
the product has one setup moment and no decisions.

**Burn-in.** The ground alternates between `#F2F2F0` and `#FFFFFF` every interval, the
names change every interval, and the whole `<main>` carries a 4-step drift
(`0,0` → `2px,1px` → `0,2px` → `-2px,1px`) that advances inside the change animation. No
region holds a static high-contrast edge for more than one interval.

**Type sizes.**

```
--t-hero    min(8rem, 34vh, calc(150cqi / var(--len)))   the name. see below
--t-clock-l 8rem      clock, final 9 seconds
--t-clock   2.5rem    clock, normal
--t-pill    1.5rem    setup name pills
--t-sub     1.125rem  sub names
--t-strip   1rem      order strip
--t-label   0.6875rem all labels, uppercase, letter-spacing .1em
```

`--len` is the character count of the **longest name across both squads**, floored at 5.
Both teams get the same size — neither team outranks the other. `150` is calibrated for an
average uppercase advance of 0.66 em at weight 800 with `-0.025em` tracking. Put
`container-type: inline-size` on the team block and `overflow: clip` on the name as a
backstop. Setup enforces `maxlength="8"` on names: a name that does not fit is a name
nobody can read at four metres, and everyone at six-a-side has a short name.

Names are uppercase. Uppercase removes descender space, so it buys about 15% more cap
height for the same box, and it is where the product's character sits.

---

## Display — three variations

Element count taken straight from the spec's own display list: **25**.

### A — One name each  ← BUILD THIS

Two full-width rows, one per team, stacked. One clock spine on the right. **The permanent
"now" block is deleted.** In its place the single name slot changes meaning for the first
few seconds after each change (the *call* state), then returns to showing next (the *wait*
state).

**25 → 9 elements** (7 when both teams have exactly six; 12 with every conditional lit).

Merges, and what each one costs:

| Merge | Cost |
|---|---|
| now + next → one slot, split across time by the call hold | learnability |
| team label + moment label → one header line per row | none |
| clock + the gutter between the two teams → the spine | none |
| order strip carries order, the pointer (leftmost = in goal now) and the sub positions (a dot) | discoverability |
| ground colour + change signal + call-state indicator → one property | none |

Deleted, with the consequence named:

- **The now block, 4 elements per team.** You cannot read the current keeper at hero size
  outside the call window. Recovered two ways: the call hold, and the leftmost name in the
  strip. Justified by the spec's own principle 2 — the rotation does not know who is
  actually in the goal, so a permanent "now" invites a comparison the spec says is
  meaningless, and reads as wrong every time somebody volunteers.
- **GOAL / SUB column headers.** Role is carried by size and by an inline label on the sub
  line, which disappears with it. An empty column under a live header is what makes a team
  of six look broken; there is no column.
- **Every container, border, shadow and icon.** The display has none. Consequence: none.

Added, and what each one buys:

- **Overtime marker** (conditional): the game has passed its planned duration. Without it a
  wrapping rotation reads as a bug.
- **Status marker** (conditional): wake lock lost, or the voice is unavailable. One tap
  fixes it. Without it the screen sleeps at minute forty and nobody knows why.
- **Sub dots in the strip**: the spec asks anyone to check their own next shift; a shift is
  goal *or* bench. One glyph per sub.
- **Kick-off hint** (once, during change 0 only): the long-press is invisible, so it gets
  exactly one signpost, in the one moment nothing else is happening.

### B — The board

The conventional answer done properly. Top bar with the clock. Two team panels side by
side. Each panel: team label, GOAL and SUB column headers, a NOW row, a NEXT row, an order
strip. Hairline between the panels.

**25 → 22.** No merge of any consequence. Four name slots plus two header rows share a
338 px column, so the hero falls to about `3.25rem` — cap height 6.4 mm, legible at 1.6 m.
It fails the distance table outright, and a team of six shows an empty column under a live
SUB header. It is a dashboard. It loses.

### C — Two screens in time

Hierarchy spent in time rather than space. For 12 s after each change the whole screen is
the two incoming names at `min(13rem, 46vh)` — cap height 22 mm, legible at 5.5 m, the only
variation that reaches the pitch. Then it collapses to a calm state with a clock, both
teams' next keeper at `2.5rem`, and the strips. Two layouts and a shared-element flight
between them.

**Call 6 elements / wait 11.** It loses because for 95% of the game there is no loud
element at all, so the one-second glance from five metres returns nothing for six minutes
out of every seven. But its core idea is right, and A takes it: A holds the call, and A's
wait state still has a hero, so the idea costs nothing.

**Recommendation: A.** It is the only variation where the loudest thing on the screen is
always the answer to the question the product exists to answer, and the only one where the
type is large enough for the reading distance to be real.

---

## Display — variation A, exact

Landscape, 844×390 to 932×430. All values verified at 844×390.

```
main
  display: grid
  grid-template-columns: 1fr 8rem        content | clock spine
  grid-template-rows: 1fr 1fr            team A | team B
  column-gap: 24px
  padding: max(12px, env(safe-area-inset-top))
           max(24px, env(safe-area-inset-right))
           max(12px, env(safe-area-inset-bottom))
           max(24px, env(safe-area-inset-left))
  transform: translate(var(--drift-x), var(--drift-y))
```

The safe-area padding is not optional. In landscape the Dynamic Island eats about 59 px
from one side and the home indicator 21 px from the bottom.

Team block (`container-type: inline-size`, `align-content: center`, `row-gap: 2px`):

```
header    --t-label, 600, --ink-3, uppercase   "[team] — [moment]"   placeholder copy
name      --t-hero, 800, --ink, uppercase, nowrap, line-height .94, tracking -.025em
meta      flex, gap 24px, align-items baseline, margin-top 4px
  subs      --t-sub, 600, --ink-2, uppercase, nowrap, flex 0 0 auto
            inline --t-label prefix, --ink-3, margin-right 8px. absent when no subs
  strip     --t-strip, 400, --ink-3, uppercase, tracking .02em, nowrap
            overflow hidden, flex 1 1 auto, min-width 0
            mask-image: linear-gradient(to right, #000 88%, transparent)
```

The header pairs the team with the moment, so the two facts a glance needs sit on one line
above the name. Placeholder wording only — the copywriter owns the words.

The strip is the goal order, left to right, **starting at the current keeper**. Position 1
is in goal now, position 2 is next, position *n* is *n*−1 changes away. Nothing marks the
pointer, because leftmost *is* the pointer. Separator is a `·` in `--dim` with `.34em`
either side. A player currently on the bench gets a 3 px `--ink-3` dot centred `.28em`
below their name. The right mask says the loop continues, which is true.

Clock spine, `place-items: center`, spans both rows:

```
--t-clock, 600, --ink-2, font-variant-numeric: tabular-nums, tracking -.02em
```

Measured fit at 844×390, wait state, longest name 8 characters: content column 644 px,
name 96.6 px, team block 149 px, both rows 318 px inside 357 px of usable height.
Call state: 120.75 px. With a 5-character longest name the `8rem` cap binds at 128 px.

**Call and wait.** Two states of one screen, set by a class on `<body>`:

| | call | wait |
|---|---|---|
| ground | `#FFFFFF` | `#F2F2F0` |
| name colour | `--ink-call` | `--ink` |
| name size | `--t-hero` | `--t-hero × 0.8` |
| header reads | the moment is now | the moment is next |

The label is 11 px and cannot be read at four metres. Luminance and scale can be. That is
why the state is carried by the ground and the size, and the label only confirms it up
close.

The call runs from each change until `max(6s, speechEnd + 2s)`, capped at 12 s. It must
outlast the voice, or the screen shows one name while the phone says another.

**Portrait** (not the target, must not break): `grid-template-columns: 1fr`, three rows —
clock, team A, team B. `--t-hero` becomes `min(4rem, 12vh, calc(150cqi / var(--len)))`.
Everything else is unchanged.

---

## The change moment

One motion in the whole product. `t = 0` is the change. One curve throughout.

```
t 0        speechSynthesis.speak() fires. clock reads 0:00. nothing moves.
t 0–120    hold. the stillness is what makes the move read as a consequence.
t 120      ground        --ground → #FFFFFF over 160ms, and stays (call state begins)
           drift         --drift advances one step, 600ms, invisible inside the rest
           clock         instant swap to the full interval. never animate a digit.
           header        crossfade to the now wording, 150ms
           name out      translateY(0 → -56px), opacity 1 → 0 (0 at 55%), 600ms
           subs out      translateY(0 → -24px), opacity 1 → 0, 600ms
           strip         translateX(0 → calc(-1 * var(--first-w))), 600ms
                         first name opacity 1 → 0 over the first 55%
t 300      name in       translateY(40px → 0), opacity 0 → 1, 420ms
t 360      subs in       translateY(20px → 0), opacity 0 → 1, 360ms
t 720      settled. rebuild the strip DOM, reset translateX, recompute --first-w
           with transitions suppressed for one frame.
t call-end ground → --ground, name → 0.8 scale, header → the next wording,
           name and subs crossfade to the following shift. 400ms, all together.
           no travel, no ground lift. this motion must not be mistaken for a change.
```

600 ms, not the 250 ms a UI transition gets. This motion is not feedback for a touch. It is
a broadcast to people who are not looking at the screen, and slow motion is what peripheral
vision catches. `--first-w` is the width of the strip's first name plus its separator,
measured in JS and written as a custom property.

Names travel up and out; the replacement rises from below. The queue moves upward, the
strip moves left, and both advance by exactly one. Use `transform` and `opacity` only.
Never animate `font-size` or anything that triggers layout.

**Final 9 seconds.** At `T−9.0s` the clock goes from `--t-clock` / 600 / `--ink-2` / `MM:SS`
to `--t-clock-l` / 800 / `--ink` / a bare seconds integer: 150 ms fade out, then 150 ms fade
in with `scale(0.92 → 1)`. Each following second swaps instantly. No flash, no colour
change, no sound. The loud element transfers from the name to the number for nine seconds,
because for nine seconds the useful fact is the time. It starts at 9 and not 10 because 10
is two digits, two digits at `8rem` will not fit the spine, and widening the spine would
move both teams.

**Reduced motion** (`prefers-reduced-motion: reduce`): the conveyor becomes a 200 ms
opacity crossfade in place, the strip rebuilds instantly, the drift jumps with no
transition, and the final-9 change is an instant swap. **Keep the ground lift**, extended to
200 ms up and 500 ms down. It is a colour change, not motion, and it is the only signal that
survives past six metres.

---

## Setup

Portrait first. The phone is in a hand and the keyboard takes 55–65% of a landscape
viewport. Rotating to landscape and propping the phone up is the mode change.

Naive element count: **16**. After: **7**, plus two deferred controls.

```
interval readout   --t-clock, 600, --ink. tappable. em-dash when the squads are invalid.
team A header      --t-label, --ink-3. "[team] · [count]"
team A field       token field: pills + one input
team B header
team B field
start              48px, filled --ink, white label, full width
first-keeper pill  the last pill in each list, filled --ink, white label,
                   with an inline --t-label prefix inside it
```

**The readout is the control.** Duration and shifts collapse into the number they produce.
Tap it and it expands, 250 ms, into two stepper rows — duration (30–150, step 5) and shifts
each (1–4, step 1) — which write back live. Cost: discoverability. Paid by the defaults
being right for almost every game, and by a number that visibly moves as you type, which
invites the tap. The spec has this backwards: it makes the derived value the readout and
the values nobody can reason about into the controls. Nobody can predict what "2 shifts"
feels like. Everybody understands "6:12 each".

**Arrival order is taught, not explained.** The last pill in each list is the first keeper,
so it is the one filled pill, and it carries its own label inside it. Type a name and the
fill moves to it. That is the rule demonstrated once per keystroke, and it replaces a
sentence of help text. Cost: learnability.

**Reorder without dragging.** Order in the list changes exactly one thing: who starts in
goal. Everything after that is alphabetical. So there is no drag and no handle — **tap any
pill and it moves to the end of the list**, 250 ms, and becomes the first keeper. With a
prefilled squad the whole interaction is: remove who is absent, tap whoever turned up last,
start. Cost: learnability, and you cannot edit a name — remove it and retype. Names are
eight characters.

Pills: full radius, 48 px tall, `--t-pill` at 600, hairline `#D4D4D6`, 12 px edge to label,
6 px label to ✕, 12 px ✕ to edge. The ✕ is a 20 px Lucide `x` at 1.5 px stroke, in a square
box. Gap 8 px between pills, 24 px between the two fields.

Input attributes, all required: `maxlength="8" autocapitalize="words" autocorrect="off"
autocomplete="off" spellcheck="false" enterkeyhint="next"`. Autocorrect mangles names, and
a mangled name gets spoken aloud. Return or comma commits a pill and keeps focus.

Viewport meta, all of it: `width=device-width, initial-scale=1, viewport-fit=cover,
interactive-widget=resizes-content`. The last one keeps the sticky Start reachable above
the keyboard.

**Validity.** Blocking: a team with fewer than 2 players — the rotation is meaningless.
Non-blocking: a team with fewer than 6 — a warning line above Start, overridable. Below the
blocking threshold Start is a hairline button, not a filled one, and tapping it focuses the
short field. No dead control, and no disabled primary.

**Landscape setup**: the two fields sit side by side, readout top centre, Start bottom right
at 200 px wide. Nothing else changes.

There is no page title. Two lists of names and a number say what the screen is for without
one.

---

## The roster sheet

The two mid-game actions. **Zero elements on the display.**

Trigger: press and hold anywhere for 700 ms with under 12 px of movement. Cost:
discoverability, paid by the one kick-off hint.

A sheet rises from the bottom over 300 ms, covering the lower 75%, on a
`rgba(0,0,0,.4)` scrim, `--ground`, 16 px top corners, elevation 1 — the only shadow in the
product. Inside: the same pill fields as setup, both teams, and the same input.

- Tap a present name → gone. The pill becomes hairline, `--dim`, struck through.
- Tap a gone name → back. That is the undo, so there is no confirmation dialog.
- Type a name and press Return → a late arrival. The spec's rule (covers the next shift,
  inserted behind the pointer) is engine behaviour and needs no interface.

No title, no Save, no close button. Changes apply on the tap. Dismiss by tapping the scrim,
swiping down, or 10 s of no interaction. If a change fires while the sheet is open it closes
itself over 300 ms so the change is seen, and the voice speaks either way.

**6 elements**: scrim, sheet, two headers, two fields.

---

## States

Every one of these is a design, not a note.

**Setup**

- *First run.* Both fields empty, placeholders visible, readout is an em-dash, Start is a
  hairline button.
- *Prefilled.* Pills present, the last one in each list filled, readout live. Nothing
  announces that the squad was remembered — the names being there says it.
- *Too small.* A team under 2: readout em-dash, Start hairline, tapping it focuses that
  field.
- *Under six.* Warning line above Start, `--t-label`, `--ink-2`. Start stays filled.
- *Settings open.* Two stepper rows below the readout, 250 ms expand, collapse on tap
  outside.

**Display**

- *Kick-off.* Change 0 runs the full change moment and the call hold, and speaks the first
  names. No special case in the code and the start gets a moment. The kick-off hint takes
  the strip's line for that hold only, then never appears again.
- *Normal minute.* Wait state. Ground `#F2F2F0`, name at 0.8, clock ticking. The ticking
  clock is the only proof the app is alive, which is why the clock is never hidden.
- *Final 9 seconds.* As above. Names do not move.
- *The change.* As above.
- *Exactly six.* No sub line at all. The team block is shorter and re-centres. Nothing is
  empty, because nothing was ever reserved.
- *Uneven teams.* One row has a sub line, the other does not. Both rows are `1fr` and both
  names are centred in their own row, so the two names stay level. The size is shared, so
  neither team looks larger than the other.
- *Overtime.* Past the duration, the rotation wraps and nothing structural changes. A
  `--t-label` marker in `--ink-3` appears under the clock with the minutes past. Without it
  a wrapping rotation reads as a fault.
- *Restored.* Read the setup and the kick-off timestamp, compute from `Date.now()`, go
  straight to the display. No dialog. Suppress the voice for changes that were missed while
  the phone was dead. If `elapsed > duration + 60 min`, discard the game and open setup with
  the squad prefilled.
- *Degraded.* Wake Lock is lost on backgrounding and often cannot be re-taken without a
  gesture. The voice needs a user gesture to unlock on iOS and can be silenced by the ringer
  switch. Both surface as one `--t-label` marker under the clock, and any single tap clears
  it by re-taking the lock and re-testing the voice. Unlock the voice on the Start tap in
  setup, where a gesture already exists.
- *Portrait.* As above. Not the target, does not break.

---

## What I think is wrong in the spec

1. **The 20-metre reading distance is not achievable on a phone** and no design gets there.
   The four-channel table at the top is the honest answer. Say it out loud before the field
   test, or the field test will report the wrong failure.
2. **A permanent "now" display contradicts principle 2.** The rotation deliberately does not
   track who is standing in the goal. Every time somebody volunteers, a permanent "now"
   block is visibly wrong, and the one thing this product cannot afford to be is visibly
   wrong. Show it only in the seconds after the voice says it, when it is true by
   construction.
3. **There is no length cap on names.** An eleven-character name drops the hero to 49 px and
   takes the whole product below its reading distance. Eight characters, enforced in setup.
4. **Duration and shifts are the wrong controls.** Nobody can predict what "2 shifts each"
   feels like on a pitch. The interval is the only number in the system a person can reason
   about, and the spec puts it in the readout and the unintelligible values in the inputs.
5. **The voice is not reliable enough to be the primary channel.** It needs a gesture to
   unlock on iOS and the ringer switch can kill it. The screen must carry the change on its
   own, which is what the ground lift is for.
6. **The punctuality incentive is backwards.** The last to arrive goes in goal first, so
   they get their goal shift over with while everyone else still has theirs coming. That
   rewards lateness. Not a design call — but it is the kind of thing the least vocal player
   will notice, and this product exists for them.
