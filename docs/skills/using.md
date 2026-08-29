---
title: Using skills
description: "Wire the bundled skills into Claude Code, Codex, Cursor, Copilot or Gemini with buddy setup:ai, and override any of them per project."
---
# Using skills

## Wire them up

```bash
buddy setup:ai              # pick an agent interactively
buddy setup:ai claude       # or name it
```

The framework keeps its agent material in `storage/framework/defaults/ai`.
Nothing there is read at runtime. `setup:ai` materializes it into the files and
directories your agent actually looks for:

| Agent | Reads |
|---|---|
| Claude Code | `AGENTS.md`, `CLAUDE.md`, `.claude/skills`, `.claude/launch.json` |
| OpenAI Codex CLI | `AGENTS.md` |
| Cursor | `AGENTS.md`, `.cursor/rules` |
| GitHub Copilot | `AGENTS.md`, `.github/copilot-instructions.md` |
| Gemini CLI | `AGENTS.md`, `GEMINI.md` |

### Symlink or copy

Skills are symlinked by default, so upgrading the framework upgrades the skills
with it. Pass `--copy` when you would rather own the files and edit them per
project:

```bash
buddy setup:ai claude --copy
```

Existing files are never clobbered. A hand-edited `CLAUDE.md` or a customized
skill directory is left alone unless you pass `--force`. Symlinks are the
exception: those are refreshed on every run, so a rename or an upgrade
re-points them.

### What gets committed

Only `AGENTS.md`. It is shared guidance every agent reads, so it belongs in
review. `.claude/`, `.codex/`, `.cursor/`, `.gemini/` and
`.github/copilot-instructions.md` are gitignored and regenerated on demand,
because which agent a developer uses is their own choice.

## How a skill fires

Most skills are **model-invoked**. They carry a `description` written for the
agent, and the agent reads it every turn and reaches for the skill when the task
matches. You do not have to name them. That description is the whole trigger, so
its wording decides how reliably the skill fires, which is why
[Writing for agents](/skills/craft/writing-for-agents) spends most of its length
on pointers.

A few are **user-invoked**: they set `disable-model-invocation: true`, carry no
model-facing description, cost nothing in context, and only fire when you type
them. [Flow](/skills/craft/flow) and [Handoff](/skills/craft/handoff) are the
two bundled examples.

Either kind can be called by name:

```
/stacks-orm
/stacks-review
/stacks-flow
```

## Override one for your project

`@stacksjs/skills` resolves a skill name against two sources, in order:

1. `app/Skills/<name>/SKILL.md`
2. `storage/framework/defaults/ai/skills/<name>/SKILL.md`

First hit wins, the same app-overrides-defaults model as `app/Actions/` and
`app/Models/`. So to change what an agent reads about, say, authentication in
your project, create `app/Skills/stacks-auth/SKILL.md` and it shadows the bundled
one everywhere, including in the directory `setup:ai` links.

```bash
mkdir -p app/Skills/stacks-auth
cp storage/framework/defaults/ai/skills/stacks-auth/SKILL.md app/Skills/stacks-auth/
# edit it, then
buddy setup:ai claude
```

Nothing writes into the bundled directory. Edit that one only when you are
working on the framework itself.

## Read them programmatically

```typescript
import { getSkill, listSkills, resolveSkillPath, validateSkill } from '@stacksjs/skills'

listSkills()                       // every skill name, sorted, project ones shadowing bundled
getSkill('stacks-orm')             // metadata, instructions, path, scripts, references, assets
resolveSkillPath('stacks-orm')     // the directory that won, or null
validateSkill('stacks-orm')        // { valid, errors } against the frontmatter rules
```

`listSkills()` reads directories, so a new `app/Skills/<name>/SKILL.md` is live
the moment it exists. There is nothing to register.

## Next

- [Flows](/skills/flows): the routes the craft skills form, from idea to shipped.
- [Writing your own](/skills/writing): frontmatter, invocation, and the rules
  that make a skill fire when it should.
