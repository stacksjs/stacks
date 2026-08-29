---
name: stacks-investigate
description: Use when debugging a Stacks issue - something broken, throwing, failing, flaky or slow. Builds a tight feedback loop that goes red on the bug before any hypothesis is allowed, then minimises, tests hypotheses, fixes and locks it down with a regression test. Enforces no fixes without root cause. Invoke with /stacks-investigate.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-investigate - root cause debugging

A discipline for hard bugs. Find the **root cause**, not a way to make the
symptom go away. Skip a phase only when you can say why.

Credit: the feedback-loop-first structure is adapted from Matt Pocock's
`diagnosing-bugs` skill (MIT), <https://github.com/mattpocock/skills>.

## Redact

This skill has you show commands, outputs and captured artifacts. **Redact every
secret first**, writing `<REDACTED>` in its place. Build loops against env vars
so the credential stays in the environment rather than in what you show. In a
Stacks project the usual offenders are `.env`, `.env.production`,
`config/services.ts`, `APP_KEY`, AWS keys and `HCLOUD_TOKEN`, plus captured HTTP
traffic carrying an `Authorization` header. Quote only the lines that carry the
signal.

If the redacted output is not enough to diagnose the bug, say so and ask the
user.

## Phase 1: build a feedback loop

**This is the skill.** Everything else is mechanical. With a **tight** pass/fail
signal, one that goes **red** on *this* bug, you will find the cause: bisection,
hypothesis testing and instrumentation all just consume it. Without one, no
amount of staring at code will save you.

Spend disproportionate effort here. Be aggressive, be creative, refuse to give
up.

### Ways to construct one, in roughly this order

1. **Failing test** at whatever seam reaches the bug. `bun test <path>` is the
   loop. See `stacks-tdd` for which seam.
2. **HTTP script** against `buddy dev`, using `curl` or `Bun.fetch` with a
   fixture payload.
3. **CLI invocation**, for instance `buddy <command>` with a fixture input,
   diffing stdout against a known-good snapshot.
4. **REPL probe**. `buddy repl` reaches models, config and the query builder
   directly, which is the fastest loop for an ORM or relationship bug.
5. **Headless browser script**. `/stacks-browse` drives a real browser over CDP
   and asserts on DOM, console and network with nothing to install.
6. **Replay a captured trace.** Save a real request, payload or event log to
   disk, then replay it through the code path in isolation.
7. **Throwaway harness.** A single file that boots the minimum (one action, a
   seeded database) and exercises the bug path with one call.
8. **Deterministic database state.** `buddy migrate:fresh --seed` plus the
   model factories gives byte-identical rows every run, which turns "sometimes
   wrong" into "always wrong" more often than you would expect.
9. **Property or fuzz loop.** For "sometimes the output is wrong", run a
   thousand inputs and look for the failure mode.
10. **Bisection harness.** If the bug appeared between two known states, automate
    "boot at state X, check, repeat" so `git bisect run` can consume it.
11. **Differential loop.** Same input through two versions or two configs, diff
    the outputs. This is the one for a dependency bump or a driver swap.
12. **HITL bash script.** Last resort. If a human must click, drive *them* with
    [scripts/hitl-loop.template.sh](scripts/hitl-loop.template.sh) so the loop is
    still structured, and the captured output feeds back to you.

Build the right feedback loop and the bug is 90% fixed.

### Tighten the loop

Treat the loop as a product. Once you have *a* loop, **tighten** it:

- Faster. Narrow the test path, skip unrelated init, reuse the seeded database
  instead of re-migrating.
- Sharper signal. Assert on the specific symptom, not "it did not crash".
- More deterministic. Pin the clock, seed the RNG, isolate the filesystem, freeze
  the network, and pick one driver rather than whatever `config/` happens to
  select.

A 30-second flaky loop is barely better than no loop. A 2-second deterministic
one is a superpower.

### Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the
trigger 100 times, parallelise, add stress, narrow the timing window, inject
sleeps. A 50% flake is debuggable, 1% is not, so keep raising the rate.

### When you genuinely cannot build a loop

Stop and say so explicitly. List what you tried. Ask the user for one of: access
to an environment that reproduces it, a redacted captured artifact (a HAR file, a
log dump from `storage/logs/stacks.log`, a screen recording with timestamps), or
permission to add temporary instrumentation in production. Do **not** proceed to
hypothesise without a loop.

### Completion criterion: a tight loop that goes red

Phase 1 is done when you can name **one command** that you have **already run at
least once**, showing the invocation and its output, redacted, and that is:

- [ ] **Red-capable.** It drives the actual bug code path and asserts the
      **user's exact symptom**, so it can go red now and green once fixed. Not
      "runs without erroring".
- [ ] **Deterministic.** Same verdict every run, or for a flaky bug, a pinned
      high reproduction rate.
- [ ] **Fast.** Seconds, not minutes.
- [ ] **Agent-runnable.** You can run it unattended, with a human in the loop
      only through the HITL template.

If you catch yourself reading code to build a theory before this command exists,
**stop. Jumping straight to a hypothesis is the exact failure this skill
prevents.** No red-capable command, no Phase 2.

## Phase 2: reproduce and minimise

Run the loop. Watch it go red.

Confirm:

- [ ] The loop produces the failure the **user** described, not a different one
      that happens to be nearby. Wrong bug means wrong fix.
- [ ] It reproduces across multiple runs, or at a high enough rate to debug
      against.
- [ ] You have captured the exact symptom (error message, wrong output, slow
      timing) so later phases can verify the fix addresses it.

Then shrink the repro to the **smallest scenario that still goes red**. Cut
inputs, callers, config, middleware, seeded rows and steps **one at a time**,
re-running the loop after each cut, and keep only what is load-bearing.

A minimal repro shrinks the hypothesis space in Phase 3 and becomes the clean
regression test in Phase 5.

Done when **every remaining element is load-bearing**: removing any one of them
makes the loop go green.

## Phase 3: hypothesise

Generate **3 to 5 ranked hypotheses** before testing any of them.
Single-hypothesis generation anchors on the first plausible idea.

Each must be **falsifiable**, stating the prediction it makes:

> If X is the cause, then changing Y will make the bug disappear, or changing Z
> will make it worse.

If you cannot state the prediction, the hypothesis is a vibe. Discard or sharpen
it.

Gather the evidence that ranks them from where Stacks actually keeps it:

- `storage/logs/stacks.log` for the runtime trail.
- `git log --oneline -20 -- <paths>` for what changed recently.
- `config/*.ts` for which driver, connection or host is selected in this
  environment.
- `app/Models/` and `storage/framework/defaults/app/Models/` for the model, and
  `database/migrations/` for whether the schema matches it.
- `storage/framework/types/*.d.ts` and the auto-import manifests, which are
  generated and go stale. A symbol that types as `any` in an app is usually this.
- `routes/`, `app/Middleware.ts` and `app/Events.ts` for the registries, where a
  missing entry fails silently rather than loudly.
- `bun.lock` and `pantry.lock`. There are two install trees, and Bun resolves
  `node_modules`, so verify the version that actually loads.

Show the ranked list to the user before testing. They often re-rank it instantly
("we just deployed a change to number three") or name one already ruled out. Do
not block on it. Proceed with your ranking if the user is away.

## Phase 4: instrument

Each probe maps to a specific prediction from Phase 3. **Change one variable at a
time.**

Tool preference:

1. **REPL or debugger inspection** where the environment supports it. One
   breakpoint beats ten logs, and `buddy repl` is usually reachable.
2. **Targeted logs** at the boundaries that distinguish the hypotheses, via
   `log.debug()` from `@stacksjs/logging`.
3. Never "log everything and grep".

**Tag every debug log** with a unique prefix such as `[DEBUG-a4f2]`, so cleanup
is a single grep. Untagged logs survive. Tagged ones die.

**Performance branch.** For a regression, logs are usually the wrong instrument.
Establish a baseline measurement first (a timing harness, `performance.now()`, a
profiler, the query plan), then bisect. Measure first, fix second. In a Stacks
app the first thing to measure is query count, because an N+1 through a
relationship looks exactly like "the framework got slower".

## Phase 5: fix and regression test

Write the regression test **before the fix**, but only if there is a **correct
seam** for it.

A correct seam is one where the test exercises the **real bug pattern** as it
occurs at the call site. If the only available seam is too shallow (a single
caller test when the bug needs several, a unit test that cannot replicate the
chain that triggered it), a test there gives false confidence.

**If no correct seam exists, that itself is the finding.** Note it. The
architecture is preventing the bug from being locked down, which is a
`stacks-codebase-design` problem, not a testing one.

If a correct seam exists:

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail.
3. Apply the fix. Change as little as possible.
4. Watch it pass.
5. Re-run the Phase 1 loop against the original, un-minimised scenario.

## Phase 6: cleanup

Required before declaring done:

- [ ] The original repro no longer reproduces. Re-run the Phase 1 loop.
- [ ] The regression test passes, or the absence of a seam is documented.
- [ ] All `[DEBUG-...]` instrumentation removed. Grep the prefix.
- [ ] Throwaway harnesses deleted, or moved to a clearly marked debug location.
- [ ] `./buddy lint:fix` and `./buddy typecheck` are clean.
- [ ] The hypothesis that turned out correct is stated in the commit message, so
      the next debugger learns.

## Rules

- **No fixes without root cause.** If you cannot explain why, you have not found
  the bug.
- **Never apply a fix to see if it helps.** That is a hypothesis test with no
  prediction and no cleanup.
- **Do not blame the framework first.** Application code and configuration are
  wrong far more often than `storage/framework/core/` is.
- **Intermittent bugs are timing bugs** until proven otherwise. Look for a
  missing `await`, a race, or shared mutable state.
- **If the fix runs past about 20 lines, question the root cause.** Large fixes
  usually mean you are working around the problem.
- **Check the blast radius before you fix.** A change in `storage/framework/core/`
  can reach 15+ downstream packages, and in a published package a change to a
  `.d.ts` path can silently degrade consumers to `any`.

## Downstream

> **Fix applied.** Run `/stacks-review` to review it, and `/stacks-retro` when
> the real lesson is that the environment let the bug hide.
