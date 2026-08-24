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
3. **Nothing to operate mid-game.** Set up before kick-off, then it is a
   display. The single exception is registering a person who wasn't there at
   kick-off, which the app cannot know any other way.
4. **Anomalies are absorbed by people, not features.** Volunteers, injuries and
   favours are handled by players looking at each other. None of them change
   what the display says.

## Setup

Entered during the warm-up, before kick-off.

- **Duration.** Default 90 minutes. Deliberately the *short* end of the likely
  range. If the game runs long the rotation simply goes round again, which costs
  nothing. If it is set long and the game ends early, the last names never go in
  — and that is exactly the grievance this exists to remove.
- **Shifts each.** Default 2.
- **Names**, in two teams, typed **in arrival order** — first to turn up typed
  first. Arrival order is what decides where the rotation starts.

Do not enter anyone who isn't there. An absent name coming up on the display
forces the sub to skip it, and skipping is the thing that gets negotiated.

## What it works out

Let `N` = the larger of the two squad sizes, `S` = shifts each, `D` = duration.

- **Interval** = `D / (N × S)`, floored to the nearest 15 seconds. One interval,
  one clock, both teams change at the same moment. The larger squad gets exactly
  `S` shifts each; the smaller squad gets slightly more, because a smaller squad
  shares the same goal-time between fewer people. That is arithmetic, not
  unfairness.
- **Subs per team** = `squad − 6`, floor 0. Not a setting. A team of six has no
  sub, a team of seven has one, a team of eight has two. One team having a sub
  and the other not is fine and needs no handling.

## The order

Each team's list is sorted **alphabetically by first name**. Alphabetical
because it is derivable — anyone can work out who follows them without being
told and without remembering anything.

**The first keeper is the last person to arrive.** The rotation then runs
alphabetically from there, wrapping. This matters for two reasons: it re-rolls
the starting point every week so it isn't always whoever is first in the
alphabet, and it is the only punctuality incentive in the system that nobody has
to enforce out loud.

At change `k`, for a team of `N` with `C` subs:

```
keeper = (start + k) mod N
subs   = (keeper + floor(N / 2) + j) mod N,  for j = 0 .. C - 1
```

The sub slot sits on the opposite side of the loop from the keeper slot, so a
player's bench shift lands several changes away from their goal shift. Nobody
comes out of goal and immediately sits down and gets cold.

## Anomalies

**Someone volunteers to go in goal.** They go in. Nothing is entered, nothing
changes, the clock carries on. The player whose shift it was has had a piece of
luck. The volunteer still does their own shift when it comes round.

Volunteering is therefore unrewarded, so expect it to be rare. That's fine — the
system does not need volunteers.

**Someone wants goal for a long stretch.** Same thing. They stand there, the
clock keeps moving, the named players get free passes. When they've had enough,
whoever the clock is pointing at goes in.

**Injury, or going home.** People sort it out between themselves. See the open
decision below.

**Turning up after kick-off.** The one case the app cannot infer, and the one
case that needs a tap. Their name is typed in, and:

- they cover the **very next shift** — handled exactly like a volunteer, so the
  clock does not move and the player who was up gets a free pass;
- they are then inserted into the list **immediately behind the pointer**, which
  guarantees them a full lap before they come round again.

This is why the volunteer rule earns its keep: late arrivals need no separate
mechanism, only the same one.

## Display

Never needs touching once the game starts.

- Countdown to the next change, large enough to read from the pitch
- Per team: **now** — goal, and sub(s); **next** — goal, and sub(s)
- The live order for each team, so anyone can see their own next shift and
  satisfy themselves it is fair
- Spoken announcement at each change
- High contrast, big type, landscape, readable in daylight

## Open decision

**Should there be a "gone home" action?**

The rule as written says no mid-game interaction except adding a late arrival.
But if someone leaves or is injured, their name keeps coming up in goal, the sub
has to skip it, and skipping is negotiable — which is the hole this whole thing
exists to close.

Recommendation: allow it. Adding and removing a player are the same kind of
action — registering who is present, not operating a rota — and the principle
that matters is *no decisions mid-game*, which neither of them breaks. Two taps
in ninety minutes, both of them factual.

Built as recommended unless overruled.

## Not in v1

- Anything that records what has happened. The rotation is derivable from
  elapsed time alone; if the phone dies you can restart it and carry on.
- Accounts, teams that persist between weeks, history, stats.
- Any button that requires a judgement rather than a fact.
