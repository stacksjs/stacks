---
name: stacks-domain-modeling
description: Use when building or sharpening a Stacks project's domain language - challenging a fuzzy or overloaded term, naming a model or event, writing or editing CONTEXT.md, or recording an architecture decision as an ADR under docs/adr/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Domain modeling

Actively build and sharpen the project's domain model as you design. This is the
*active* discipline: challenging terms, inventing edge-case scenarios, and
writing the glossary and the decisions down the moment they crystallise. Merely
*reading* `CONTEXT.md` for vocabulary is not this skill, that is a one-line habit
any skill can do. This skill is for when you are changing the model.

In a Stacks app the domain language is not decoration. It becomes the model name,
the table name, the route URI, the event name (`article:created`), the action
file name and the stx component name, all at once. A term settled badly is a
rename across five layers later.

Credit: adapted from Matt Pocock's `domain-modeling` skill (MIT),
<https://github.com/mattpocock/skills>.

## File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-derive-migrations-from-models.md
│       └── 0002-sqlite-for-local-development.md
└── app/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has several contexts and the
map points at where each one lives. Create both lazily: only when you have
something to write. If no `CONTEXT.md` exists, create it when the first term is
resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

Formats for both files: [FORMATS.md](FORMATS.md).

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in
`CONTEXT.md`, call it out immediately. "Your glossary defines cancellation as X,
but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When a term is vague or overloaded, propose a precise canonical one. "You are
saying account. Do you mean the Customer or the User? Those are different
things, and this project already has a `User` model."

### Discuss concrete scenarios

When domain relationships are on the table, stress-test them with specific
scenarios. Invent cases that probe the edges and force precision about where one
concept ends and the next begins.

### Cross-reference with the code

The code is a second source of truth for the domain, and in a Stacks project it
is an unusually legible one. When the user states how something works, check
whether the models agree:

- `app/Models/` and `storage/framework/defaults/app/Models/` for the nouns.
- The `belongsTo` / `hasMany` / `belongsToMany` declarations for the
  relationships.
- Model events (`observe: true` emits `<model>:created`, `:updated`, `:deleted`)
  for the verbs.
- `routes/` for the URIs the outside world sees.

If you find a contradiction, surface it. "Your code cancels whole Orders, but you
just said partial cancellation is possible. Which is right?"

A term that lands in `CONTEXT.md` and disagrees with a model name is a bug in one
of the two. Say which one you think should move.

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Do not batch these up.

`CONTEXT.md` is a glossary and nothing else. Keep it free of implementation
detail: no file paths, no schemas, no config. Those go stale, and the whole value
of the file is that it does not.

### Offer ADRs sparingly

Only offer to record a decision when all three are true:

1. **Hard to reverse.** The cost of changing your mind later is meaningful.
2. **Surprising without context.** A future reader will wonder why it was done
   this way.
3. **The result of a real trade-off.** There were genuine alternatives and you
   picked one for specific reasons.

If any of the three is missing, skip it.

## Downstream

> Reach for `stacks-codebase-design` when the argument is about a module's
> shape rather than its name, and `stacks-grilling` when the term will not
> settle without an interview.
