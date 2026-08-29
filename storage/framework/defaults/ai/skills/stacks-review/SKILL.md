---
name: stacks-review
description: Use when reviewing code changes in a Stacks project - a PR, a branch, staged work, or the diff since a fixed point. Reviews on two axes, Standards (does it follow this repo's rules and avoid the smell baseline) and Spec (does it do what was asked), plus a test coverage audit and an auto-fix pass. Invoke with /stacks-review.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-review - code review

Two-axis review of a diff. Be direct, specific and opinionated. Every finding
references a file and a line.

- **Standards**: does the code follow this repo's rules, and is it free of the
  smell baseline below?
- **Spec**: does the code faithfully implement what the originating issue, spec
  or conversation asked for?

A change can pass one axis and fail the other. Code that follows every rule and
implements the wrong thing passes Standards and fails Spec. Code that does
exactly what the issue asked while breaking the project's conventions does the
reverse. Reporting them separately stops one axis from masking the other, so
**do not merge or rerank across axes**.

Credit: the two-axis structure and the Fowler smell baseline are adapted from
Matt Pocock's `code-review` skill (MIT), <https://github.com/mattpocock/skills>.

## 1. Pin the scope

1. If the user gives a PR number, branch, tag or commit, that is the fixed point.
   Diff with `git diff <fixed-point>...HEAD` (three dots, so the comparison is
   against the merge base) and list the commits with
   `git log <fixed-point>..HEAD --oneline`.
2. If no scope is given, review staged changes (`git diff --cached`). If nothing
   is staged, review unstaged (`git diff`).
3. If there are no changes at all, ask what to review.

Confirm the ref resolves (`git rev-parse <fixed-point>`) and the diff is
non-empty before going further. A bad ref should fail here, not inside two
parallel sub-agents.

Read the changed files in full. A diff without its surrounding context produces
confident nonsense.

## 2. Identify the spec source

Look for what the change was supposed to do, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`), fetched with
   `gh issue view`.
2. A path the user passed as an argument.
3. A spec or plan under `docs/`, `.scratch/`, or a design document from
   `/stacks-office-hours` or `/stacks-plan-review`.
4. The conversation itself, if the work happened in this session.

If nothing is found, ask. If the user says there is no spec, the Spec axis
reports "no spec available" and you review Standards only.

## 3. Run both axes

Both axes run as **parallel sub-agents** so they do not pollute each other's
context, then this skill aggregates. Give each the diff command, the commit list,
and its own brief.

### Standards axis

Sources, in order of authority:

1. `AGENTS.md` at the repo root. It is the project's own rules and it **wins over
   everything below**.
2. The relevant `stacks-*` skill for whatever the diff touches. A model change is
   reviewed against `stacks-models`, a route change against `stacks-router`.
3. The smell baseline below, which applies even where nothing is documented.

Skip anything tooling already enforces. `pickier` catches formatting and lint,
`tsgo` catches types, so a finding that repeats them is noise.

#### Critical findings

Must be fixed before merge. Only flag at confidence 8/10 or higher.

**Security**: SQL injection, XSS, command injection, path traversal. Hardcoded
secrets, keys or tokens (check `config/services.ts` and anything env-shaped).
Missing auth or authorization on a route. Unsafe deserialization or `eval`.
Missing validation at a system boundary.

**Correctness**: races and missing `await`. Off-by-one. Null or undefined access
with no guard. Resource leaks, including unclosed database connections. Swallowed
errors and wrong error types. Logic errors in model definitions or migrations.

**Stacks-specific**:

- Model attributes with the wrong validator type, or a fillable attribute with no
  `factory` where `useSeeder` is on.
- A model change with no regenerated migration, or a generated migration nobody
  read.
- Routes pointing at an action path that does not resolve, or missing the
  middleware their siblings carry.
- A registry that silently drops the entry: `app/Routes.ts`, `app/Events.ts`,
  `app/Middleware.ts`, `app/Listener.ts`, `app/Scheduler.ts`. These fail by doing
  nothing.
- Breaking changes to a `@stacksjs/*` package's public exports, and relative type
  imports that escape the package, which degrade consumers to `any`.
- Migrations that will not run on SQLite.
- Vanilla JS in an stx template (`var`, `document.*`, `window.*`), a hand-rolled
  SVG icon path, a new icon or animation dependency.
- An em-dash in any user-visible string.

```
🔴 CRITICAL: [title]
File: [path]:[line]
Issue: [specific description]
Impact: [what goes wrong]
Fix: [the concrete fix]
```

#### Smell baseline

A fixed set of Fowler code smells (*Refactoring*, ch.3) that applies even when a
repo documents nothing. Two rules bind it: **the repo overrides**, so where
`AGENTS.md` or a `stacks-*` skill endorses something the baseline would flag,
suppress it. And each smell is **always a judgement call**, a labelled heuristic
("possible feature envy"), never a hard violation.

Each reads *what it is* then *how to fix*. Match against the diff:

- **Mysterious name**: a function, variable or type whose name does not reveal
  what it does. Rename it, and if no honest name comes, the design is murky.
- **Duplicated code**: the same logic shape in more than one hunk or file.
  Extract the shape and call it from both. In this framework, the fifth
  near-identical action usually wants to be a trait.
- **Feature envy**: a method reaching into another object's data more than its
  own. Move it onto the data it envies.
- **Data clumps**: the same few fields travelling together, a type wanting to be
  born. Bundle them.
- **Primitive obsession**: a string or number standing in for a domain concept.
  Give the concept its own small type, and its own name in `CONTEXT.md`.
- **Repeated switches**: the same cascade on the same type recurring across the
  change. Replace with polymorphism, a driver, or one shared map.
- **Shotgun surgery**: one logical change forcing scattered edits across many
  files. Gather what changes together.
- **Divergent change**: one file edited for several unrelated reasons. Split so
  each module changes for one reason.
- **Speculative generality**: abstraction, params or hooks added for needs the
  spec does not have. Delete it. One adapter is a hypothetical seam.
- **Message chains**: long `a.b().c().d()` navigation the caller should not
  depend on. Hide the walk behind one method.
- **Middle man**: a class or function that mostly delegates onward. Call the real
  target.
- **Refused bequest**: a subclass that ignores most of what it inherits. Use
  composition.

```
🟡 INFO: [title]
File: [path]:[line]
Note: [observation, and which smell if it is one]
Suggestion: [improvement]
```

Also flag here: `any` where a discriminated union or `satisfies` would do,
misleading names, errors that lose their stack, dead code introduced by the
change, N+1 queries through a relationship, and a PR title that fails the
conventional-commit rules in `config/commit.ts`.

### Spec axis

Report:

- Requirements the spec asked for that are **missing or partial**.
- Behaviour in the diff that **was not asked for**, which is scope creep.
- Requirements that look implemented but where the implementation looks **wrong**.

Quote the spec line for each finding. Keep it under 400 words.

## 4. Test coverage audit

1. Identify every changed function, action, model attribute and route.
2. Search `tests/` for existing coverage.
3. List the untested paths.

```
## Test coverage

| Changed | Test file | Covered? |
|---|---|---|
| [function or route] | [path or "none"] | ✅ / ❌ |

Missing coverage:
- [untested path or edge case]
```

Judge the tests you find, not just their existence. A test that mocks an internal
collaborator or recomputes its own expected value is worse than no test, because
it reports green. `stacks-tdd` has the anti-pattern list.

## 5. Auto-fix

After presenting the findings, ask:

> Want me to fix the mechanical issues? Formatting, imports, simple type fixes.

If yes, fix **only** mechanical issues, then run `./buddy lint:fix` and
`./buddy typecheck`. Never auto-fix architectural decisions, logic changes, or
anything with several valid approaches.

## Output

```
# Code review: [brief description]

## Standards
[critical findings, then informational]

## Spec
[findings, or "no spec available"]

## Test coverage
[table]

## Summary
- Standards: [count], worst: [issue]
- Spec: [count], worst: [issue]
- Test gaps: [count]
```

The summary names the worst issue **within each axis**. Do not pick a single
winner across axes, because that is the reranking the separation exists to
prevent.

## Rules

- Never say "consider" or "you might want to". It is a problem or it is not.
- Every finding carries a concrete fix.
- Do not flag what `pickier` or `tsgo` already catches.
- Do not review generated files, lock files, `storage/framework/types/*.d.ts`, or
  anything under a `dist/`.
- For monorepo changes, check cross-package impact. A change in
  `storage/framework/core/` can reach 15+ downstream packages.

## Downstream

> **Review complete.** Run `/stacks-browse` to QA in the browser, or
> `/stacks-retro` to turn the findings into environment improvements.
