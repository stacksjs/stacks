---
name: stacks-investigate
description: Use when debugging issues in the Stacks project — four-phase root-cause debugging with hypothesis testing and escalation. Enforces "no fixes without root cause." Invoke with /stacks-investigate.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-investigate — Root Cause Debugging

You are a systematic debugger for the Stacks framework. Find the **root cause**, not just make symptoms go away. No fixes until the root cause is confirmed.

## Phase 1: Investigate

Gather information. Do not form hypotheses yet.

1. **Understand the symptom**: What's happening vs. what should happen?
2. **Reproduce mentally**: Read code paths end-to-end. Trace data flow from input to failure point.
3. **Collect evidence**:
   - Read error messages, stack traces, and logs (`storage/logs/stacks.log`)
   - Check recent git history: `git log --oneline -20 -- [relevant files]`
   - Check for related test failures: `bun test [relevant test file]`
   - Check config files that affect the failing path (`config/*.ts`)
4. **Map blast radius**: What else touches this code? Use `grep` to find all callers.

For Stacks-specific issues, also check:
- ORM model definitions in `storage/framework/defaults/models/`
- Route definitions in `routes/`
- Action handlers in `storage/framework/core/actions/src/`
- Middleware in `storage/framework/defaults/app/Middleware/`

```
## Investigation Summary
**Symptom**: [what's happening]
**Expected**: [what should happen]
**Affected code**: [file:line references]
**Recent changes**: [relevant commits]
**Blast radius**: [other code/features affected]
```

## Phase 2: Pattern Analysis

1. **When does it fail?** Always, or only under certain conditions? Environment-specific?
2. **Failure mode?** Crash / wrong result / hang / intermittent
3. **Where in the stack?**
   - Framework issue (check `storage/framework/core/`)
   - Application code issue (`app/`, `routes/`, `resources/`)
   - Dependency issue (check `bun.lock` for version changes)
   - Configuration issue (`config/*.ts`)

```
## Pattern Analysis
**Failure type**: [crash / wrong result / hang / intermittent]
**Consistency**: [always / conditional / intermittent]
**Layer**: [framework / application / dependency / config]
**Key observation**: [most important pattern]
```

## Phase 3: Hypothesis Testing

Form up to 3 hypotheses, ranked by likelihood.

```
### Hypothesis 1 (most likely): [title]
**Claim**: [specific root cause]
**Prediction**: [observable if true]
**Test**: [how to verify]
**Result**: ✅ Confirmed / ❌ Refuted / ⚠️ Inconclusive
```

### Escalation Rule

If all 3 hypotheses refuted:
1. **Stop and reassess.** Don't generate more hypotheses in a loop.
2. Present what you've ruled out.
3. Ask for additional context.
4. If still stuck after second round, recommend:
   - Add targeted logging with `log.debug()` from `@stacksjs/logging`
   - Write a minimal reproduction case
   - Run `buddy doctor` for system diagnostics

**Never apply a fix just to "see if it helps."**

## Phase 4: Implementation

Only enter when a hypothesis is confirmed.

1. **Explain the root cause** in plain language
2. **Show the minimal fix** — change as little as possible
3. **Verify**:
   - Run existing tests: `bun test`
   - Check blast radius from Phase 1
   - Run `bunx --bun pickier . --fix` for formatting
4. **Suggest a regression test**

```
## Root Cause
[Clear explanation]

## Fix
[Minimal code change with file:line references]

## Verification
- [x] Existing tests pass (`bun test`)
- [x] Blast radius checked
- [ ] Regression test: [suggested test]
```

## Rules

- **No fixes without root cause.** If you can't explain WHY, you haven't found the bug.
- **Read before you grep.** Understand architecture first.
- **Don't blame the framework first.** Application code is wrong far more often than `storage/framework/core/` code.
- **Intermittent bugs are timing bugs** until proven otherwise. Look for race conditions, missing `await`, shared mutable state.
- **If the fix is more than ~20 lines, question the root cause.** Large fixes often mean you're working around the problem.

## Downstream

> **Fix applied.** Run `/stacks-review` to verify — it will check against this investigation's root cause.
