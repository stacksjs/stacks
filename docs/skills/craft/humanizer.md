---
title: "Humanizer skill"
description: "Rewrite AI-sounding prose while preserving claims and the writer's voice."
---
# Humanizer

`stacks-humanizer` · Engineering craft · model-invoked

A broad editorial pass for documentation, articles, emails, PR descriptions,
and product copy. It keeps the source's claims and voice while allowing
paragraphs to be reordered, merged, or split. Its reference contains all 26
patterns from [blader/humanizer](https://github.com/blader/humanizer), including
staged openers, forced contrasts, repeated closers, inflated claims, and chat
residue. Patterns guide contextual editing; they do not establish authorship.

## When to reach for it

- A draft sounds generic or generated and needs a natural editorial rewrite.
- Repeated paragraph shapes bury the point despite individually clear sentences.
- A document, PR description, or product page needs a final prose pass.

## Workflow

Read the context and voice sample, mark contextual defects, draft a rewrite,
compare every claim with the source, and finish the prose. Preserve factual
details, uncertainty, attribution, code, frontmatter, link targets, and data.
In stx files, edit the requested copy while preserving bindings and scripts.
Generated copy follows Stacks' punctuation rules even when a voice sample differs.

Pasted text gets a draft, short critique, and final rewrite unless the user
requests final text only. File edits write the final prose and summarize the
changes. Embedded tasks receive only the finished text.

## Supporting files

- [Pattern reference](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-humanizer/references/patterns.md), all 26 patterns and examples.
- [Source notice](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-humanizer/NOTICE.md), revision and adaptation details.
- [MIT license](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-humanizer/LICENSE), preserved from upstream.

## Related skills

- [Unslop](/skills/craft/unslop) for audits, minimal changes, and voice cards.
- [Writing for agents](/skills/craft/writing-for-agents) for skill instructions.
- [Flow](/skills/craft/flow) for finding the right workflow.

## Using it

This skill is **model-invoked** and can also be called by name:

```text
/stacks-humanizer docs/launch-post.md
```

It ships in the framework defaults and the `@stacksjs/defaults` package, so new
apps receive it with their managed scaffold. Run `buddy setup:ai claude` to
expose it to Claude Code; other agents can follow the pointers in `AGENTS.md`.
It requires no remote download or extra runtime dependency.

Source: [`stacks-humanizer/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-humanizer/SKILL.md).
Override it per project with `app/Skills/stacks-humanizer/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
