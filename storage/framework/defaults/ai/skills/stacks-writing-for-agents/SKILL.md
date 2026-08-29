---
name: stacks-writing-for-agents
description: Use when writing or editing any document an agent reads - a SKILL.md under app/Skills or storage/framework/defaults/ai/skills, the project AGENTS.md, or a reference file a skill points at. Covers context pointers, the information hierarchy, completion criteria, leading words, pruning, and the skill mechanics behind app/Skills and buddy setup:ai.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Writing for agents

Reference for every document an agent consumes in a Stacks project: a skill, the
project `AGENTS.md`, a doc reached by a pointer. The packaging differs, the
writing does not. The same levers make each one predictable, because the agent
takes the same *process* every run rather than producing the same output.

Stacks ships 100+ skills and expects projects to add their own under
`app/Skills/`, so this is the skill that keeps that set from turning to sludge.
The Stacks-specific mechanics (frontmatter, invocation, the override model,
what `buddy setup:ai` does with the result) are in
[MECHANICS.md](MECHANICS.md). Everything below is universal.

Credit: the model in this skill is adapted from Matt Pocock's `writing-for-agents`
skill (MIT), <https://github.com/mattpocock/skills>.

## Context pointers

A **context pointer** is a reference held in the agent's context that names some
out-of-context material and encodes the condition for reaching it. A skill's
`description` is one. A line in `AGENTS.md` naming a doc is the same object. The
pointer's *wording*, not its target, decides when the agent reaches the material
and how reliably. A must-have target behind a weakly worded pointer is a variance
bug: sharpen the wording first, and inline the material only if sharpening fails.

A pointer does two jobs: state what the material is, and list the **branches**
that should trigger reaching it (a branch is a distinct case the document
handles, so different runs take different paths through it). Every word of an
always-loaded pointer costs on every turn, so it earns harder pruning than the
body:

- **Front-load the leading word.** The pointer is where it does its triggering work.
- **One trigger per branch.** Synonyms that rename a single branch are one branch
  written twice. Collapse them, keep only genuinely distinct branches.
- **Cut identity the body already carries.** `stacks-queue`'s description does not
  need to explain what a queue is.

The bundled skills follow one shape, and yours should too: `Use when <situation>
- <branch>, <branch>, <branch>. Covers <package> and <config file>.` The
trailing `Covers` clause is doing pointer work, not decoration: it is how an
agent holding a package name (`@stacksjs/cache`) or a path (`config/queue.ts`)
finds the skill that owns it.

## The two loads

Every document and pointer you add spends one of two budgets:

- **Context load** is the cost of always-loaded material on the agent's window:
  an `AGENTS.md` line, a skill description, anything sitting in context every
  turn, spending tokens and attention whether or not it fires.
- **Cognitive load** is the cost on the human: which documents exist and when to
  reach for each. The human is the index. Not a cost to minimise, it is the
  price of human agency. Spend it where human judgement matters, remove it where
  it does not.

Material reached only through a pointer escapes context load at the price of the
pointer's own line. Material with no pointer at all rides entirely on cognitive
load.

## Information hierarchy

A document is built from two content types: **steps** (the ordered actions the
agent performs) and **reference** (definitions, rules, facts consulted on
demand). The two mix freely: all steps (`stacks-new-feature`), all reference
(`stacks-orm`), or both (`stacks-investigate`). The core decision is where each
piece sits on the **information hierarchy**, a ladder ranked by how immediately
the agent needs the material:

1. **In-file step** is the primary tier: what the agent does, in order.
2. **In-file reference** is consulted on demand. Often a legitimately flat
   peer-set (every rule of a review on one rung), which is a fine arrangement,
   not a smell.
3. **Disclosed reference** is pushed into a separate file, reached by a context
   pointer, loaded only when the pointer fires. Spans a sibling file in the same
   skill directory through fully external reference any document can point at.

Push too little down and the top bloats. Push too much and you hide material the
agent actually needs. That tension is the whole decision.

**Progressive disclosure** is the move down the ladder so the top stays legible.
Not primarily a token optimisation: it is how the hierarchy is protected.
Branching is the cleanest disclosure test: inline what every branch needs, push
behind a pointer what only some branches reach. `stacks-technical-diagrams`
keeps 36 reference files beside one `SKILL.md` for exactly this reason.

**Co-location** is the within-file companion. Where the ladder decides *how far
down* a piece sits, co-location decides *what sits beside it* once there. Keep a
concept's definition, rules and caveats under one heading rather than scattered,
so reading one part brings its neighbours with it. The test: the document should
read like documentation written for the agent.

**Sprawl** is the failure mode: a document simply too long, even when every line
is live and unique. Attention thins across the excess, and every extra line is
one more to keep relevant. The cure is the ladder.

## Steps and completion criteria

Every step ends on a **completion criterion**, the condition that tells the agent
the work is done. Two properties make it a lever:

- **Clarity.** Can the agent tell done from not-done? A vague bound
  ("understanding reached") invites **premature completion**: ending the step
  before it is genuinely done, attention slipping to *being done*. The visible
  steps still ahead supply the pull, the criterion's clarity is the resistance.
  Defend in order: sharpen the bound first (local and cheap), and only if it is
  irreducibly fuzzy *and* you observe the rush, hide the later steps by splitting
  the sequence. Hiding only works across a real context boundary (a hand-off or a
  subagent dispatch). An inline call leaves the later steps in context and clears
  nothing.
- **Demand.** How much the criterion requires. "Every changed model accounted
  for" forces thorough work where "produce a change list" does not. Demand drives
  **legwork**, the digging the agent does within the work, latent in the wording
  rather than written as its own step. It is not step-bound: "every rule applied"
  binds a body of flat reference just as "every step done" binds a sequence,
  which is how an all-reference document still carries an exhaustiveness bar.

The strongest criteria are both checkable and exhaustive. `stacks-investigate`
Phase 1 is the model to copy: one command, already run once, output shown.

## When to split

Splitting one document into two spends one of the two loads, so split only when
the cut earns it:

- **By sequence.** Split a run of steps where the post-completion steps tempt the
  agent to rush the one in front of it. Keeping them out of view drives more
  legwork on the current task. Beware the reverse: merging sequences exposes each
  step's later steps to what follows, inviting premature completion.
- **By invocation.** Skill-specific, see [MECHANICS.md](MECHANICS.md).

## Leading words

A **leading word** is a compact concept already living in the model's
pretraining that the agent thinks with while running the document (*lesson*,
*fog of war*, *tracer bullet*, *seam*). Repeated as a token, never as a
sentence, it accumulates a distributed definition and anchors a whole region of
behaviour in the fewest tokens by recruiting priors the model already holds.
Coining your own works if you define it clearly, but a made-up word recruits no
priors: you pay in definition tokens what a pretrained word gives free. Reach
for an existing word first.

It anchors twice. In the body, *execution*: the agent reaches for the same
behaviour every time the word appears. In a pointer, *invocation*: when the same
word lives in your prompts, your docs and your codebase, the agent links that
shared language to the material and reaches it more reliably. This is why the
Stacks skills insist on `trait`, `driver`, `action`, `seam` and `tracer bullet`
rather than paraphrasing them.

Hunt for opportunities to refactor with leading words. A triad spelled out at
three sites, a pointer spending a sentence to gesture at one idea. Each is a
passage begging to collapse into a single token:

- "fast, deterministic, low-overhead" becomes *tight* (a *tight* loop).
- "a loop you believe in" becomes *red*, turning a fuzzy gate into a binary
  observable state (the loop goes *red* on the bug, or it does not).

**Negation** is the failure mode beside this lever. Steering by prohibition drags
the forbidden behaviour into context and makes it *more* available, not less.
*Do not think of an elephant*, and the elephant is all there is. Prompt the
**positive**: state the target behaviour ("use signals and composables in stx
templates") so the banned one is never spoken. A prohibition earns its place only
as a hard guardrail you cannot phrase positively, and even then, pair it with the
positive target so attention lands on what to do.

## Pruning

- Keep each meaning in a **single source of truth**: one authoritative place, so
  changing the behaviour is a one-place edit. **Duplication** costs maintenance
  and tokens, and inflates a meaning's prominence on the ladder past its real
  rank. It is the accidental inverse of a leading word, which repeats a token on
  purpose, never the meaning.
- The **environment** is a source of truth too, and in a Stacks project it is a
  rich one: `buddy list`, `buddy <command> --help`, `config/*.ts`, the
  `storage/framework/*-auto-imports.json` manifests, the generated
  `storage/framework/types/*.d.ts`. A document that restates it is a **cache**: a
  copy of a lookup, earning its load only when the lookup is expensive. Cache
  what the agent cannot find by looking (the unwritten convention, the reason
  behind a choice, the gotcha no config confesses) and leave the one-command
  lookups to the environment, where they cannot go stale. Every bundled skill's
  `## Gotchas` section is this rule applied.
- Check every line for **relevance**: does it still bear on what the document
  does? A line loses relevance by never bearing on the task, or by going stale as
  the code it describes changes. Without a pruning discipline the default fate is
  **sediment**: stale layers that settle because adding feels safe and removing
  feels risky.
- Hunt **no-ops** sentence by sentence: an instruction the model already obeys by
  default pays load to say nothing. The test (does it change behaviour versus the
  default?) is model-relative, not reader-relative. Two people disagreeing about
  a no-op disagree about the default, and settle it by running the document, not
  by debate. When a sentence fails, delete the whole sentence rather than trim
  words from it. The test also grades leading words: a word too weak to beat the
  default (*be thorough*, when the agent is already thorough-ish) is a no-op, and
  the fix is a stronger word (*relentless*), not a different technique.

## Before you finish

- Every line changes behaviour versus the default.
- Every meaning lives in exactly one place.
- The description names distinct branches, front-loads the trigger, and carries
  the `Covers` clause.
- Nothing in the body restates what `buddy <command> --help` or a config file
  already says.
- No em-dash anywhere in the file (the project-wide rule in `AGENTS.md`).
- `bunx --bun pickier .` is clean if you touched code alongside it.

## Downstream

> Reach for `stacks-retro` after a session to find which documents actually
> failed, and `stacks-flow` when the problem is that nobody remembers a skill
> exists.
