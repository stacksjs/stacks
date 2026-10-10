# Stacks adaptation of the engineering workflows

This shared reference applies to the Matt Pocock ports listed in
[upstream-skills.json](upstream-skills.json). Read it with the selected skill.
Stacks conventions and explicit user instructions govern the adapted playbooks.

## Context, skills, and tracking

Read `AGENTS.md`, the relevant Stacks package skill, existing specs, and ADRs.
Use the existing domain source: `CONTEXT.md`, or `GLOSSARY.md` when that is the
project's established glossary. Follow an existing context map in a multi-context
repository. Keep glossary terms separate from implementation decisions and
create domain files only when a resolved term or decision needs recording.

The translated skill names are the entrypoints. Read a skill before relying on
its summary or skipping a step. A Skill tool is optional: reading `SKILL.md`
and its relevant references provides the same instructions.

Read `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` when present.
If no tracker convention exists, use local specs and one Markdown file per
ticket under `.scratch/<feature>/issues/`. Configure a remote tracker only when
requested. Spec synthesis, ticket drafting, and local planning can proceed
without an account or a setup ceremony.

Existing authorization and resolved decisions carry forward. Confirm an
uncertain seam, destination, or consequential choice when necessary; do not
re-ask settled preferences or impose a permission prompt for each reversible
step. A planning interview resolves human decisions, not facts the agent can read.

## Implementation and verification

Use TypeScript and Bun. Application files override framework defaults. Read the
subsystem skill before calling Stacks APIs. Build features in the model,
generated migration, action, route, and test order, one tracer bullet at a time.
A spec or ticket names observable acceptance criteria and genuine blockers.

Use `./buddy lint` through pickier, never an extra linter or formatter. Use
`./buddy typecheck` for application code and `bun run typecheck` for framework
internals. Run focused Bun tests during the loop and the appropriate buddy
test suite before finishing. Preserve the user-defined test seams and exercise
real behavior through public interfaces.

UI uses stx and Crosswind, signals and composables, and Iconify classes. Read
the design skill before visually important work. Reports may use standalone
HTML with local CSS; do not introduce Tailwind or React into the application.
Copied example commands for other package managers are conceptual; use Bun and
the repository's actual scripts. Do not duplicate better-dx tooling.

## Parallel work and long-running tasks

Use subagents when the invoked workflow asks for parallel work and the harness
supports it. Otherwise work sequentially through the same dependency frontier.
Treat user decisions as human-in-the-loop work; a subagent cannot answer them
for the user. Give workers context pointers, a concrete scope, acceptance
criteria, and a disjoint edit surface. Preserve existing user edits.

For an implementation graph, integrate completed work before unblocking
dependent tickets. Validate the combined result and distinguish completed,
blocked, and unstarted work. Do not silently reset a worktree with changes.
Archive only task-owned temporary worktrees after preserving needed work.

Research files are cited primary-source evidence. Background orchestration is
optional, not a precondition for answering a research question. Do not create
recurring schedules or a long-running goal merely because an upstream playbook
mentions them; use native tools when the user requests that behavior.

## Git and external actions

Only commit or push when asked. Use conventional commits and branch off the
default branch before a requested commit. An upstream "commit", "push", or
"publish" step is conditional on the user's authorization. Never close or
alter tracker issues, post comments, or send a questionnaire merely because
the draft is complete. Perform the requested external action when authorized;
otherwise return its concrete draft.

Attach any created or actively reviewed PR using the harness's artifact tool
when available. Preserve authored `AGENTS.md`; generated agent files are
per-developer. Setup guidance edits the canonical guidance, not an independent
copy of a symlinked `CLAUDE.md`.

Generate user-visible copy with regular hyphens and ordinary punctuation.
Keep quotes, secrets, executable code, and source evidence accurate. Redact
secrets from reports and handoffs. Completion is the requested behavior or
reviewable artifact with its relevant checks, not an unsolicited deployment.
