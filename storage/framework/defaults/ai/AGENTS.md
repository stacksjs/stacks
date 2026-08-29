# AGENTS.md

Guidance for AI coding agents (Claude Code, OpenAI Codex CLI, Cursor, and others)
working in this Stacks application. Every agent reads this file, so it is the one
place to record project-specific rules.

This is the starter version `buddy setup:ai` writes when a project has no
`AGENTS.md` yet. Edit it freely - it is yours, and it is committed so the whole
team (and every agent) sees the same rules.

---

## Project conventions

### Linting

- Use **pickier**, never eslint directly.
- Lint: `./buddy lint` Auto-fix: `./buddy lint:fix`
- For unused variables, prefer `// eslint-disable-next-line` over an underscore
  prefix.

### Frontend

- Use **stx** for templating. Never vanilla JS (`var`, `document.*`, `window.*`)
  inside stx templates - use signals (`state` / `derived` / `effect`) and
  composables.
- Use **Crosswind** utility classes for styling.
- Icons are Iconify classes (`i-{collection}-{name}`). Never hand-roll SVG paths
  and never add an icon npm package.
- Stacks ships no animation library. Use Crosswind transitions, CSS keyframes,
  scroll-driven animations, and the motion composables.

### Commits

- Conventional commit messages (`fix:`, `feat:`, `chore:`, ...).
- Only commit or push when asked.

### Requirements

Bun >= 1.3.0, SQLite >= 3.47.2, TypeScript throughout.

---

## Repository map

| Path | What lives here |
|---|---|
| `app/` | Your code: `Actions/`, `Jobs/`, `Listeners/`, `Middleware/`, `Mail/`, `Commands/`, `Models/`, `Skills/`, plus `Routes.ts`, `Events.ts`, `Gates.ts`, `Scheduler.ts` |
| `routes/` | Route files, registered via `app/Routes.ts` |
| `config/` | Typed configuration, one file per subsystem |
| `database/` | Migrations, seeders, local SQLite files |
| `resources/` | stx frontend: `views/`, `components/`, `layouts/`, `partials/` |
| `storage/framework/` | Framework internals and defaults. Read-only reference |
| `tests/` | Bun test suites |

### The `app/` override model

Stacks resolves files from `app/` first and falls back to
`storage/framework/defaults/app/`. To customize a framework default, create the
same path under `app/` and it wins.

---

## Skills

The framework ships two kinds of skill under
`storage/framework/defaults/ai/skills`.

**Subsystem reference**, one per area (`stacks-orm`, `stacks-router`,
`stacks-queue`, ...), each documenting it authoritatively. Read the relevant
`SKILL.md` before doing non-trivial work rather than guessing at an API.

**Engineering craft**, which shape how the work happens:

| Situation | Skill |
|---|---|
| Which skill fits, and where to cut a session | `stacks-flow` |
| Stress-test an idea before building it | `stacks-office-hours`, `stacks-grilling` |
| Answer a design question with throwaway code | `stacks-prototype` |
| Plan the change: scope, seams, test matrix | `stacks-plan-review`, `stacks-codebase-design` |
| Name things, keep `CONTEXT.md` and ADRs current | `stacks-domain-modeling` |
| Build it test-first, one tracer bullet at a time | `stacks-tdd`, `stacks-new-feature` |
| Something is broken, flaky or slow | `stacks-investigate` |
| Review the diff on standards and spec | `stacks-review` |
| A step only a human can take | `stacks-wizard` |
| Improve the environment for next time | `stacks-retro` |
| Write a skill or any doc an agent reads | `stacks-writing-for-agents` |

Add your own with `app/Skills/<name>/SKILL.md`, then re-run `buddy setup:ai`.
A project skill shadows a bundled one of the same name. Read
`stacks-writing-for-agents` first: it covers the frontmatter the validator
enforces and how to write a description that actually fires.

---

## Before finishing

- Lint: `./buddy lint` (fix with `./buddy lint:fix`)
- Type check: `./buddy typecheck`
- Test: `./buddy test`
