---
name: stacks-grilling
description: Use when a plan, design or decision needs stress-testing before any code is written, when the user asks to be grilled or to have their thinking challenged, or when another skill needs the round-and-frontier interview primitive. Produces a shared understanding, never code.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Grilling

Interview the user relentlessly until you reach a shared understanding. Map the
work as a **design tree**: every decision branches into the decisions that hang
off it.

This is the interview primitive. `stacks-office-hours` runs it to shape a
product idea, `stacks-plan-review` runs it to settle an architecture, and
`stacks-redesign` runs it to pin down an aesthetic direction. Reach for it
directly when you want the interview with no wrapper around it.

Credit: adapted from Matt Pocock's `grilling` skill (MIT),
<https://github.com/mattpocock/skills>.

## Rounds and the frontier

Work the tree in **rounds**. The **frontier** is every decision whose
prerequisites are already settled: the questions you can ask *now* without
guessing at answers you have not heard yet.

Ask the whole frontier in one round. Number each question and give your
recommended answer. Then wait for the user's answers before the next round.

```
❓ **Q1** - **<question title>**: <question body, possibly several paragraphs,
including the options you see>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body>

➡️ <your recommended answer>
```

Each round of answers reshapes the tree. Settled decisions push the frontier
outward and unblock questions that depended on them. Recompute the frontier and
ask the next round. A question whose answer depends on another question still
open in this round belongs to a *later* round, not this one.

## Facts are your job, decisions are the user's

Finding *facts* is never the user's job. When a frontier question needs a fact
from the environment, go get it. In a Stacks project that means reading rather
than asking:

- `config/*.ts` for what is already configured, and which driver is selected.
- `app/Models/` and `storage/framework/defaults/app/Models/` for what the domain
  already models.
- `routes/` for the surface that already exists.
- `buddy list` and `buddy <command> --help` for what the CLI already does.
- `CONTEXT.md` for the terms already settled.
- The relevant `stacks-*` skill for how a subsystem actually behaves.

Do not block on the lookup. A running exploration is an unsettled prerequisite,
so only the questions downstream of it wait. Ask the rest of the frontier now.

The *decisions* are the user's. Put each to them and wait.

## Done

The session is done when the frontier is empty: every branch of the design tree
visited, nothing left silently assumed. Do not act on it until the user confirms
you have reached a shared understanding.

## Do not build

No code during a grilling session. If the user reaches for an implementation
mid-interview, note the decision it implies, add it to the tree, and carry on.
Where a question genuinely cannot be settled in conversation because it needs a
runnable answer, reach for `stacks-prototype` and bring the result back.

## Downstream

> Frontier empty? `/stacks-plan-review` turns the understanding into an
> implementation plan, or `/stacks-new-feature` slices it into tracer bullets.
