---
title: "Unslop skill"
description: "Audit and repair prose with minimal changes, factual preservation, and voice matching."
---
# Unslop

`stacks-unslop` · Engineering craft · model-invoked

Contextual prose review adapted from
[theclaymethod/unslop](https://github.com/theclaymethod/unslop). It identifies
concrete defects, makes the smallest justified edits, and preserves unaffected
sentences exactly. A clean draft is returned unchanged. Review requests
produce findings without rewriting the source.

## Modes

| Mode | What it does |
|---|---|
| `cleanup` | Report contextual findings and optional reviewable replacements. |
| `rewrite` | Diagnose, repair confirmed findings, and validate preservation. |
| `teach` | Build a qualitative voice card from supplied writing samples. |
| `mimic` | Draft or rewrite using a supplied voice card or samples. |

A bare invocation defaults to rewrite. "Flag only" changes nothing.
"Does this sound like me?" compares the voice without editing. Optional crisp,
warm, expert, and story presets affect delivery without adding facts.

## Preservation and review

Numbers, dates, names, quotations, attribution, code, URLs, units, conditions,
scope, and uncertainty survive the pass. Code and bindings in stx files remain
intact. Voice samples do not override Stacks' punctuation convention.

The Stacks adaptation uses agent review and needs no scripts or extra
dependencies. It excludes upstream's Python scanners, numeric voice profiles,
transcript harvesting, and model evaluation harness. Assessments are
qualitative; they do not claim automated grades, scanner parity, or proof
of authorship. Any future executable helper uses TypeScript and Bun.

## Supporting files

- [Core contract](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-unslop/references/core-contract.md), findings, minimal edits, preservation, and validation.
- [Pattern catalog](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-unslop/references/patterns.md), phrase, structure, and discourse candidates with contextual protections.
- [Voice workflows](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-unslop/references/voice.md), teach, mimic, voice checks, and optional calibration.
- [Presets](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-unslop/references/presets.md), requested voice styles.
- [Source notice](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-unslop/NOTICE.md), upstream revision, MIT declaration, and adaptation scope.

## Related skills

- [Humanizer](/skills/craft/humanizer) for broader editorial restructuring.
- [Writing for agents](/skills/craft/writing-for-agents) for skill instructions.
- [Flow](/skills/craft/flow) for finding the right workflow.

## Using it

This skill is **model-invoked** and can also be called by name:

```text
/stacks-unslop cleanup docs/announcement.md
/stacks-unslop rewrite [text]
/stacks-unslop teach [writing samples]
/stacks-unslop mimic [brief and voice card]
```

It ships in the framework defaults and the `@stacksjs/defaults` package. New
apps receive it with their managed scaffold; `buddy setup:ai claude` exposes it
to Claude Code and other agents can follow the `AGENTS.md` pointers.

Source: [`stacks-unslop/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-unslop/SKILL.md).
Override it per project with `app/Skills/stacks-unslop/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
