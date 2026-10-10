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

The framework ships task-specific skills under
`storage/framework/defaults/ai/skills`.

Start with `stacks-native` when implementing a feature or checking what Stacks
already provides. Its catalog maps every core package to the appropriate skill,
its recipes connect model definitions to migrations and protected CRUD, and its
driver reference records supported, partial, and experimental capabilities.

Describe schema once in `app/Models/` with `defineModel()`; use `extendModel()`
for additive changes to a built-in model. Run `./buddy generate:migrations`,
review the generated SQL and snapshot, then apply with `./buddy migrate`.
`useApi` registers CRUD at runtime. Read `stacks-models`, `stacks-migrations`,
and `stacks-router` for selection, authentication, ownership, and mount behavior.
Use `stacks-auto-imports` to distinguish browser bindings from declarations
and explicit module imports.

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
| Humanize prose with a broad editorial rewrite | `stacks-humanizer` |
| Audit AI-sounding prose, suggest minimal edits, or learn and match a voice | `stacks-unslop` |
| Persist design decisions, write a spec, and create linked tickets | `stacks-grill-with-docs`, `stacks-to-spec`, `stacks-to-tickets` |
| Implement a ticket or a spec's task graph | `stacks-implement`, `stacks-implement-spec` |
| Triage reports or resolve a large decision map | `stacks-triage`, `stacks-wayfinder` |
| Research, architecture improvements, or PR descriptions | `stacks-research`, `stacks-improve-codebase-architecture`, `stacks-pr` |
| Learn, collect writing material, or shape an article | `stacks-teach`, `stacks-writing-fragments`, `stacks-writing-shape`, `stacks-writing-beats` |
| Specify a recurring workflow or coordinate a long-running effort | `stacks-loop`, `stacks-chief-of-staff` |

**Marketing**: read `stacks-marketing`, then choose the task-specific skill from
its `CATALOG.md`. The framework bundles all 50 reviewed marketing playbooks,
including copywriting, SEO, acquisition, conversion, retention, and measurement.
They complement framework skills such as `stacks-analytics` and `stacks-email`.
Use stx and Crosswind for implementation. A draft does not authorize sending,
spending, publishing, or scheduling; existing explicit authorization carries forward.

Source revisions, hashes, native substitutes, and all 38 reviewed Matt Pocock
skill mappings live in `stacks-flow/upstream-skills.json` beside its entrypoint.

Add your own with `app/Skills/<name>/SKILL.md`, then re-run `buddy setup:ai`.
A project skill shadows a bundled one of the same name. Read
`stacks-writing-for-agents` first: it covers the frontmatter the validator
enforces and how to write a description that actually fires.

---

## Before finishing

Generated user-visible copy uses regular hyphens and ordinary sentence
punctuation. Never emit em-dashes or separator en-dashes. Preserve verbatim
source quotations; flag a punctuation conflict rather than altering a quote.

- Lint: `./buddy lint` (fix with `./buddy lint:fix`)
- Type check: `./buddy typecheck`
- Test: `./buddy test`
