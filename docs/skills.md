---
title: Skills
description: "The 115 agent skills Stacks ships, what each one is for, and how to wire them into your AI coding agent."
---
# Skills

Stacks ships **115 agent skills**. Each one is a `SKILL.md` that documents part
of the framework, or part of the craft of working in it, authoritatively enough
that an agent reads it instead of guessing at an API.

They are not a chat feature. They are files in your repository, under
`storage/framework/defaults/ai/skills`, and `buddy setup:ai` links them into
whatever directory your agent reads. Claude Code, OpenAI Codex CLI, Cursor,
GitHub Copilot and Gemini CLI all work.

```bash
buddy setup:ai claude
```

See [Using skills](/skills/using) for the rest of that story, and
[Writing your own](/skills/writing) when you want to add one.

## Two kinds

**Subsystem reference** is most of the set: one skill per part of the framework,
model-invoked, so your agent reaches for it on its own when the task matches. You
rarely name one. When someone asks the agent to add a model, it reads
[ORM](/skills/data/orm) and [Models](/skills/data/models) before writing
`defineModel()`, and the model it writes uses the traits rather than
reimplementing them.

**Engineering craft** is the smaller set that shapes *how* the work happens
rather than which subsystem it touches: how to plan a change, where to put a
seam, how to debug without guessing, how to review a diff on two axes, when to
hand a session off. [Flow](/skills/craft/flow) is the router over them, and
[Flows](/skills/flows) walks the routes they form.

## Sections

| Section | What is in it |
|---|---|
| [Engineering craft](/skills/craft) | How the work happens: planning, building, debugging, reviewing, handing off. 18 skills. |
| [Data layer](/skills/data) | Models, the ORM, queries, migrations, seeding and search. 7 skills. |
| [Backend and API](/skills/backend) | Routes, actions, auth, jobs, events, caching and storage. 23 skills. |
| [Messaging](/skills/messaging) | Email, SMS, push, chat, notifications and calendars. 7 skills. |
| [Frontend](/skills/frontend) | stx templates, Crosswind, composables, desktop and mobile. 7 skills. |
| [Design](/skills/design) | Premium UI work, aesthetic presets, image-first pipelines and diagrams. 12 skills. |
| [Domain packages](/skills/domain) | Commerce, payments, CMS, dashboard and i18n. 5 skills. |
| [Toolchain](/skills/toolchain) | The buddy CLI, building, serving, deploying, testing and linting. 20 skills. |
| [Platform](/skills/platform) | Config, env, dependencies, auto-imports, paths and types. 9 skills. |
| [Utilities](/skills/utilities) | Strings, arrays, collections, objects, dates and slugs. 7 skills. |

## Why they are files

Three things follow from a skill being a file in the repo rather than a setting
somewhere.

**They version with the framework.** Upgrade Stacks and the skills describing it
upgrade too, because `buddy setup:ai` symlinks them by default. A skill cannot
document an API that shipped two releases ago unless the code did as well.

**They are yours to override.** `app/Skills/<name>/SKILL.md` shadows a bundled
skill of the same name, exactly like `app/Actions/` shadows a default action. If
your project does authentication differently, say so once and every agent working
in the repo reads your version.

**They are reviewable.** A skill lands in a pull request like anything else. The
one file that is committed by default is `AGENTS.md`, because it is shared
guidance the whole team sees; the generated per-agent directories are gitignored,
since which agent you use is a personal choice.

## Credit

Several of the engineering craft skills are adapted from
[mattpocock/skills](https://github.com/mattpocock/skills), MIT licensed, with
credit in each `SKILL.md`. The originals are worth reading on their own.
