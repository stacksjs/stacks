---
name: stacks-tdd
description: Use when building a feature or fixing a bug test-first in a Stacks project, when the user mentions red-green-refactor or vertical slices, or when deciding which seam a test belongs at. Covers the red-green loop over bun test and @stacksjs/testing, seam selection, and the test anti-patterns.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Test-driven development

TDD is the red to green loop. This skill is the reference that makes the loop
produce tests worth keeping: what a good test is, where tests go, the
anti-patterns, and the rules of the loop. Every section applies on every cycle.
Consult them before and during, not after.

`stacks-testing` is the *mechanics*: `setupDatabase()`, `refreshDatabase()`,
DynamoDB Local, `bunfig.toml` preload, the CLI flags. This skill is the
*discipline*. Read that one for the API and this one for the decisions.

Credit: adapted from Matt Pocock's `tdd` skill (MIT),
<https://github.com/mattpocock/skills>.

## What a good test is

Tests verify behaviour through public interfaces, never implementation details.
Code can change entirely, tests should not. A good test reads like a
specification: "a customer can check out with a valid cart" tells you exactly
what capability exists, and it survives refactors because it does not care about
internal structure.

See [EXAMPLES.md](EXAMPLES.md) for good and bad tests side by side, and for
where mocking is legitimate.

## Seams: where tests go

A **seam** is the public boundary you test at, the interface where you observe
behaviour without reaching inside. Tests live at seams, never against internals.
When the shape of that interface is itself in question, call the Skill tool with
`stacks-codebase-design` for the vocabulary. It owns the module, interface,
depth, seam, adapter, leverage and locality terms.

**Test only at pre-agreed seams.** Before writing any test, write down the seams
under test and confirm them with the user. No test is written at an unconfirmed
seam. You cannot test everything, so agreeing the seams up front is how testing
effort lands on the critical paths instead of on every edge case.

A Stacks app has four seams worth naming, from highest to lowest. Prefer the
highest one that can go red on the behaviour you care about:

| Seam | Test through | Use when |
|---|---|---|
| Route | an HTTP request against the running route, middleware included | the behaviour is a user-visible endpoint |
| Action | calling the action in `app/Actions/` directly | the behaviour is the request-to-response logic, and you do not need middleware in the picture |
| Model | the model's query and mutation surface, against the test database | the behaviour is a trait, a relationship, a computed attribute, or a validation rule |
| Function | a plain import from `resources/functions/` or a `@stacksjs/*` package | the behaviour is pure computation |

The fewer seams you cross for one feature, the better. One is ideal.

## The database is not a boundary to mock

The framework hands you a real one. `setupDatabase()` creates
`database/stacks_testing.sqlite`, `refreshDatabase()` drops and re-migrates it,
and the per-attribute `factory` functions in each model produce realistic rows.
Use them. A test that mocks `User.find()` is testing the mock.

Real boundaries in a Stacks app, the ones where a stand-in is correct: third
party HTTP (Stripe, SES, Anthropic, Meilisearch), the clock, randomness, and the
queue when you are asserting that a job was dispatched rather than that it ran.
`fake()` / `restore()` from `@stacksjs/queue` exist for that last one.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private
  methods, or verifies through a side channel (querying the database with raw
  SQL instead of reading back through the model). The tell: the test breaks when
  you refactor but behaviour has not changed.
- **Tautological**: the assertion recomputes the expected value the way the code
  does, so it passes by construction and can never disagree with the code.
  Expected values must come from an independent source of truth: a known-good
  literal, a worked example, the spec.
- **Horizontal slicing**: writing all the tests first, then all the
  implementation. Bulk tests verify *imagined* behaviour. You test the shape of
  things rather than user-facing behaviour, the tests go insensitive to real
  changes, and you commit to a test structure before understanding the
  implementation. Work in **vertical slices** instead: one test, one
  implementation, repeat. Each test is a **tracer bullet** that responds to what
  the last cycle taught you.
- **Leaking state between files**: `refreshDatabase()` drops every table, and
  `fake()` mutates global queue state. Both belong in setup and teardown, never
  mid-test.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to
  pass it. Do not anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per
  cycle.
- **Run the narrow thing during the loop.** `bun test tests/feature/articles.test.ts`
  is the loop. `buddy test` is the gate you run once at the end. Passing a path
  to `bun test` filters, it does not scope, so keep the path narrow while you
  iterate.
- **Typecheck alongside.** `./buddy typecheck` for `app/`, `config/`,
  `resources/` and `routes/`. It runs on tsgo and finishes in seconds, so there
  is no reason to save it for the end.
- **Refactoring is not part of the loop.** It belongs to review. Run
  `/stacks-review` once the slice is green.

## Model-first order

A vertical slice in Stacks cuts through the model, the migration, the action, the
route and the test. Migrations are derived from models here, so the loop has one
extra beat compared to other frameworks:

```
model change  →  buddy generate:migrations  →  review the SQL  →  buddy migrate  →  red test  →  green
```

Skipping the review step is how a wrong column type reaches every downstream
environment. See `stacks-new-feature` for the full slice and
`stacks-migrations` for the generation rules.

## Downstream

> Green? Run `/stacks-review` for the two-axis review, then `/stacks-browse` if
> the slice has a UI.
