---
title: "Domain modeling skill"
description: "Use when building or sharpening a Stacks project's domain language - challenging a fuzzy or overloaded term, naming a model or event, writing or editing CONTEXT.md, or recording an architecture decision as an ADR under docs/adr/."
---
# Domain modeling

`stacks-domain-modeling` · Engineering craft · model-invoked

Build and sharpen the project's domain language, and record the decisions that
are hard to reverse. In a Stacks app that language is load-bearing: a term
becomes the model name, the table name, the route URI and the event name all at
once, so a word settled badly is a rename across five layers later.

## When to reach for it

- Challenging a fuzzy
- Overloaded term
- Naming a model
- Event
- Writing
- Editing CONTEXT.md
- Recording an architecture decision as an ADR under docs/adr/

## Inside the skill

The sections an agent reads once the skill loads.

- File structure
- During the session

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`FORMATS.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-domain-modeling/FORMATS.md)

## Related skills

- [Codebase design](/skills/craft/codebase-design)
- [Grilling](/skills/craft/grilling)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-domain-modeling
```

Source: [`stacks-domain-modeling/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-domain-modeling/SKILL.md).
Shadow it for one project with `app/Skills/stacks-domain-modeling/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).

## Native source verification

The skill has been checked against current source and retained tests. Read its
entrypoint and linked references for the actual contract; summaries here are
discovery pointers. [Native capabilities](/skills/platform/native) maps every
core package and records driver evidence without claiming universal parity.
