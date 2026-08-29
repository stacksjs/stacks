# Skill mechanics in Stacks

The skill-specific branch of [SKILL.md](SKILL.md): what changes when the
document is a `SKILL.md`. Everything else about writing it is the universal
reference next door.

## Where a skill lives

`@stacksjs/skills` resolves a skill name against two sources, in order:

1. `app/Skills/<name>/SKILL.md` - the project's own skills
2. `storage/framework/defaults/ai/skills/<name>/SKILL.md` - the bundled ones

First hit wins, which is the same app-overrides-defaults model as
`app/Actions/` and `app/Models/`. To shadow a bundled skill, create a directory
with **the same name** under `app/Skills/`. To add a new one, pick a name no
bundled skill uses.

`buddy setup:ai <agent>` materializes the merged set into whatever directory the
agent reads (`.claude/skills` for Claude Code), symlinking by default so an
upgrade keeps them in sync, or copying with `--copy` when you want to edit them
per project. The generated directories are gitignored. Only `AGENTS.md` is
committed, because which agent you use is a personal choice.

Nothing writes into `storage/framework/defaults/ai/skills`. A project skill goes
in `app/Skills/`. Edit the bundled directory only when you are working on the
framework itself.

## Frontmatter

```yaml
---
name: stacks-cache
description: Use when implementing caching in Stacks - memory cache, Redis cache, cache-aside (getOrSet), TTL management, or cache stats. Covers @stacksjs/cache and config/cache.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---
```

`validateSkill()` in `@stacksjs/skills` enforces four rules, and
`storage/framework/core/skills/tests/skills.test.ts` runs it over every bundled
skill, so a broken one fails the suite:

- `name` is required, 1 to 64 characters, lowercase letters, numbers and hyphens
  only.
- `name` must equal the directory name.
- `description` is required and at most 1024 characters.

Two more rules the validator does not catch but the parsers do:

- **Keep `: ` out of the description.** The frontmatter parser splits each line
  on its first colon and takes the rest verbatim, and a bare `: ` inside an
  unquoted YAML scalar is invalid YAML besides. Use a hyphen or a comma.
- **Keep the em-dash out of everything.** The project-wide rule in `AGENTS.md`
  applies to skills as much as to UI copy. Older bundled skills still carry them
  in their descriptions, which is drift, not licence.

Optional fields `SkillMetadata` understands, beyond the five above:
`disable-model-invocation`, `user-invocable`, `argument-hint`, `context: fork`,
`agent`, `model`, `effort`, and a free-form `metadata` map.

## Supporting files

`getSkill()` reports three well-known subdirectories beside `SKILL.md`:

- `scripts/` - runnable helpers the skill invokes (`stacks-browse` and
  `stacks-wizard` both ship one)
- `references/` - disclosed reference the body points at
- `assets/` - templates, images, fixtures

A sibling `.md` file with no directory works too, and is the lightest form of
progressive disclosure: `stacks-technical-diagrams` keeps 36 of them.

## Invocation

Two choices, trading the two loads:

- A **model-invoked** skill keeps its `description`, so the agent can fire it on
  its own and other skills can reach it. The description is the skill's top-level
  context pointer, forced to stay loaded at all times: permanent context load in
  exchange for discoverability. A model-invoked skill whose content is all
  reference is also the one home for shared reference, because another skill can
  invoke it. Mechanics: omit `disable-model-invocation` and write a model-facing
  description carrying the trigger branches. This is the default for the bundled
  set, and the right choice for every subsystem reference.
- A **user-invoked** skill strips the description from the agent's reach: only
  the human typing its name can invoke it, and no other skill can. Zero context
  load, but it spends cognitive load, because you are the index that must
  remember it exists. Mechanics: set `disable-model-invocation: true`, and the
  `description` becomes human-facing, a one-line summary with the trigger list
  stripped. `stacks-flow` and `stacks-handoff` are the two bundled examples.

Pick model-invocation only when the agent must reach the skill on its own, or
another skill must. If it only ever fires by hand, make it user-invoked and pay
no context load.

Shared reference that two user-invoked skills both need can live in neither:
with no descriptions, neither can fire the other. Push it to a plain file
outside the skill system, or to a model-invoked reference skill both can reach.

## Splitting by invocation

The invocation cut, as opposed to the sequence cut in [SKILL.md](SKILL.md):
split off a model-invoked skill when you have a distinct leading word that
should trigger it on its own (a trigger word you actually type), or when another
skill must reach it. `stacks-grilling` exists as its own skill for exactly that
reason: `stacks-office-hours`, `stacks-plan-review` and `stacks-redesign` all
call it. You pay context load for the new always-loaded description, so that
independent reach has to be worth it.

## Router skills

When user-invoked skills multiply past what you can remember, that piled-up
cognitive load is cured by a **router skill**: one user-invoked skill that names
the others and when to reach for each, so the human has one skill to remember
instead of many. `stacks-flow` is it. A router can only hint, never fire:
user-invoked skills have no description, so nothing but the human can reach them.

## Registering a project skill

Nothing to register. `listSkills()` reads the directories, so a new
`app/Skills/<name>/SKILL.md` is live the moment it exists. Re-run
`buddy setup:ai <agent>` to link it into your agent's directory, and add a row to
the feature-to-skill table in `AGENTS.md` so a human can find it too.
