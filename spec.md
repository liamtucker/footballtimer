# spec

## The problem

Six-a-side, twice a week, no dedicated keeper. Someone has to go in goal and be
the sub, and nobody volunteers. Asking the question — *"who hasn't been in
goal?"* — is met with silence, so the same person asks every week and the
least vocal players serve the longest.

A numbering system was tried and failed. It failed because the numbers lived in
six people's heads: people forgot them, substitutes changed the count, and once
the order drifted, settling it went back to whoever argued hardest.

## What it is

A screen you set up during the warm-up and then don't touch. It shows who is in
goal and who is the sub, for both teams, and a countdown to the next change. At
the change it says the names out loud.

The sub reads it out anyway — they are the one person standing still with
nothing to do, and they have no social cost in calling a name because they are
the one coming back on.

## Principles

These are the reasons the thing is shaped the way it is. A feature that breaks
one of them is the wrong feature.

1. **State lives in one place.** The display. Never in anyone's memory, never on
   paper, never split between the app and a person.
2. **The rotation is a clock, not a queue.** It advances on elapsed time and
   nothing else. It does not know or care who is actually standing in the goal.
   This is what makes every anomaly survivable — there is no plan to rebuild,
   because there was never a plan.
3. **The voice is the product. The screen is the check.** The phone is plugged
   into a speaker and sits in a bag. Nobody looks at it. A person walks over to
   the screen only when there is a problem, or to change something.
4. **Nothing to decide mid-game.** You can open the setup screen at any time and
   look. Looking changes nothing and the clock never pauses. Only an explicit
   edit touches the rota, and it lands at the next change, never mid-shift.
5. **Anomalies are absorbed by people, not features.** Volunteers, injuries and
   favours are handled by players looking at each other. None of them change
   what the display says.

## Setup

Entered during the warm-up. Two screens exist and this is the first.

Three settings:

- **Game type.** Players on the pitch per team, 4 to 11. Default 6.
- **Game time.** Default 2 hours. **Reference only.** Nothing happens when it
  elapses — the rotation carries on for as long as the app is open. It exists so
  the screen can say how long has been played.
- **Sub duration.** Default 10 minutes. This *is* the interval. It is set
  directly, because it is the only number in the system a person can reason
  about. Nobody can predict what "two shifts each" feels like on a pitch.

Then two teams, `Bibs` and `No bibs`, each an ordered list of names. A name is
typed into an input and moves up into the list. A row is dragged to reorder it.

**The list order is the rota.** A dividing line sits after the game-type number:
above it starts on the pitch, below it are the subs. There is no alphabetical
sort — the order is whatever the person dragged it into.

Do not enter anyone who isn't there. An absent name coming up in goal forces a
skip, and skipping is the thing that gets negotiated.

## What it works out

Let `N` = squad size, `G` = game type, `C` = subs.

- **Interval** = sub duration. One clock, both teams change at the same moment.
- **Subs per team** = `N − G`, floor 0. Not a setting. A squad smaller than the
  game type simply plays short, which is not an error.

Every player gets the same length of shift. Nothing guarantees an equal *number*
of shifts inside the game time, because the game time no longer drives anything.
The clock just runs.

## The order

Two pointers, both advancing by exactly one at every change:

```
keeper(k) = ring[(kStart + k) mod N]
subs(k)   = ring[(G + k + j) mod N],  for j = 0 .. C - 1
```

The sub block starts at `G` because at change 0 the subs must be exactly the
people below the dividing line. That is what the person set up.

**The first keeper is drawn at random** from the players starting on the pitch,
once, at kick-off, and stored. Random because it is fair and because it needs no
argument. A tap on a name overrides it.

### The rule that shapes the draw

Two things must never happen:

- a player comes out of goal and is a sub at the next change
- a sub goes straight into goal at the next change

Both pointers advance together, so the gap `o = (subIndex − keeperIndex) mod N`
is constant for the whole game. The subs occupy `o … o + C − 1`. That run must
miss `0` (the keeper would also be a sub), `N − 1` (the keeper sits down next
change) and `1` (a sub goes into goal). A run of `C` consecutive slots misses all
three exactly when:

```
2 <= o <= N - 1 - C
```

At change 0, `o = G − kStart`, so the legal starting keepers are `1 … G − 2`.
The first name above the line and the last name above the line cannot start in
goal. Everything else can, and everyone rotates through everything regardless.

## Anomalies

**Someone volunteers to go in goal.** They go in. Nothing is entered, nothing
changes, the clock carries on. The player whose shift it was has had a piece of
luck. The volunteer still does their own shift when it comes round.

Volunteering is therefore unrewarded, so expect it to be rare. That's fine — the
system does not need volunteers.

**Someone wants goal for a long stretch.** Same thing. They stand there, the
clock keeps moving, the named players get free passes. When they've had enough,
whoever the clock is pointing at goes in.

**Injury, or going home.** Their name is removed on the setup screen. Whoever
is in goal at that moment stays in goal — a removal never pulls someone out
mid-shift. The bench gives up its far end so the gap between the keeper and the
subs stays legal.

**Turning up after kick-off.** Their name is typed in on the setup screen and
they join the **front of the bench**, so they come on at the next change. Nobody
on the pitch moves. The squad and the bench both grow by one, which leaves the
legal window unchanged.

Neither of these is a decision. Both are reports of a fact, and both land at the
next change rather than immediately.

## Display

Never needs touching once the game starts. `brain/design.md` owns the layout.

At rest it answers one question, from a few metres, with no label to decode:
who is in goal and who is the sub, for each team. Nothing names the players who
are simply playing — being on the pitch is the default state.

At each change: a ten-second changeover window with its own countdown, showing
who comes off and who goes on, with colour and arrows. A whistle marks the
moment. The voice says the names.

Kick-off runs a ten-second countdown and a whistle before change 0.

## Settled

**Going back to setup mid-game.** Allowed, and it is the only way in to editing.
Opening it changes nothing on its own — the rotation keeps running underneath and
the clock never pauses. An edit lands at the next change, so nobody is pulled out
of goal mid-shift. The way in is an icon, not a labelled instruction.

## Not in v1

- Anything that records what has happened. The rotation is derivable from
  elapsed time alone; if the phone dies you can restart it and carry on.
- Accounts, teams that persist between weeks, history, stats.
- Any button that requires a judgement rather than a fact.
