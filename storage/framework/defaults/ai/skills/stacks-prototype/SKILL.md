---
name: stacks-prototype
description: Use when a design question needs a runnable answer rather than an argument - does this state model hold up, what should this page look like, is this API shape right. Builds throwaway code that answers one question, either a single shareable HTML demo or several stx view variants.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Prototype

A prototype is **throwaway code that answers a question**. The question decides
the shape.

Credit: adapted from Matt Pocock's `prototype` skill (MIT),
<https://github.com/mattpocock/skills>.

## Pick a branch

Identify which question is being answered, from the user's prompt, the
surrounding code, or by asking if the user is around:

- **"Does this logic or state model feel right?"** goes to [LOGIC.md](LOGIC.md).
  A single shareable HTML file, free-play buttons plus tabbed guided
  walkthroughs, that pushes the state machine through cases that are hard to
  reason about on paper and that a non-developer can drive.
- **"What should this look like?"** goes to [UI.md](UI.md). Several radically
  different stx variants of one view, switchable in the browser.

The two branches produce very different artifacts, so getting this wrong wastes
the whole prototype. If the question is genuinely ambiguous and the user is not
reachable, default by where the code lives (a model, action or job means logic, a
view or component means UI) and state the assumption at the top of the prototype.

## Rules that apply to both

1. **Throwaway from day one, and marked as such.** Put the prototype next to
   what it is prototyping for, so context is obvious, and name it so a casual
   reader can see it is not production.
2. **Trivial to run.** A UI prototype starts from `buddy dev`. A logic demo is a
   single HTML file the user double-clicks. No thinking required to start it.
3. **No persistence by default.** State lives in memory. Persistence is the thing
   the prototype is *checking*, not something it should depend on. If the
   question genuinely involves the database, point it at the testing SQLite file
   or a clearly named scratch one.
4. **Skip the polish.** No tests, no error handling beyond what makes it
   runnable, no abstractions. The point is to learn something fast.
5. **Surface the state.** After every action, or on every variant switch, render
   the full relevant state so the user can see what changed.
6. **Capture it when done.** Fold the validated decision into the real code, then
   keep the prototype itself as a **primary source**: commit it to a
   `prototype/<name>` branch, out of `main`, and leave a pointer to that branch
   on the issue. Capture the answer too, the verdict and the question it settled.
   `main` keeps only the validated decision.

## What a prototype is not

Not a spike you promote. The code was written under prototype constraints, so
rewrite it properly when you fold it in. Not a design deliverable either: for
production UI quality, `stacks-design-taste` and the aesthetic skills own that
bar, and this skill only answers "which direction".

## Downstream

> Answer in hand? Take it into `/stacks-plan-review` or `/stacks-new-feature`.
> If the winning variant is the one you will build, `/stacks-design-taste` sets
> the bar for the real implementation.
