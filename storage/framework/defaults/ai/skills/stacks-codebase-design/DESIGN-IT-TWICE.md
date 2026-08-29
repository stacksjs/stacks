# Design it twice

When you want to explore alternative interfaces for a chosen deepening
candidate, use this parallel sub-agent pattern. Based on "Design It Twice"
(Ousterhout): your first idea is unlikely to be the best.

Uses the vocabulary in [SKILL.md](SKILL.md): **module**, **interface**, **seam**,
**adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space
for the chosen candidate:

- The constraints any new interface would need to satisfy.
- The dependencies it relies on, and which category they fall into (see
  [DEEPENING.md](DEEPENING.md)).
- A rough illustrative code sketch to make the constraints concrete. Not a
  proposal.

Show this to the user, then proceed to step 2 immediately. The user reads and
thinks while the sub-agents work.

### 2. Spawn sub-agents

Spawn three or more sub-agents in parallel. Each must produce a **radically
different** interface for the deepened module.

Prompt each with a separate technical brief: file paths, coupling details, the
dependency category, what sits behind the seam. The brief is independent of the
user-facing explanation in step 1. Give each agent a different design constraint:

- Agent 1: minimise the interface. One to three entry points, maximum leverage
  per entry point.
- Agent 2: maximise flexibility. Support many use cases and extension.
- Agent 3: optimise for the most common caller. Make the default case trivial.
- Agent 4, where it applies: design around ports and adapters for the cross-seam
  dependencies.

Include both this skill's vocabulary and the project's `CONTEXT.md` vocabulary in
each brief, so the agents name things consistently with the architecture language
and the domain language at once.

Each sub-agent outputs:

1. The interface: types, entry points, params, plus invariants, ordering and
   error modes.
2. A usage example showing how callers use it.
3. What the implementation hides behind the seam.
4. Dependency strategy and adapters.
5. Trade-offs: where leverage is high, where it is thin.

### 3. Present and compare

Present the designs one at a time so the user can absorb each, then compare them
in prose. Contrast by **depth** (leverage at the interface), **locality** (where
change concentrates) and **seam placement**.

Finish with your own recommendation: which design is strongest and why. If
elements from different designs combine well, propose the hybrid. Be opinionated.
The user wants a strong read, not a menu.

## In a Stacks project

Two constraints narrow the design space before you start, so state them in every
brief:

- A capability that varies per environment belongs behind a driver in
  `config/*.ts`, not behind a hand-rolled abstraction.
- A capability that varies per model belongs in a trait, not in a base class.
