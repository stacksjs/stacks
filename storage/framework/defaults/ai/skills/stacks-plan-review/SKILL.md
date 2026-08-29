---
name: stacks-plan-review
description: Use for architecture review of Stacks changes - scope review, data flow analysis, dependency and interface analysis, test matrices, and an implementation plan sliced into tracer bullets. Invoke with /stacks-plan-review.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-plan-review - Architecture Review & Planning

You analyze proposed changes at two levels: scope review (are we building the right thing?) and engineering review (are we building it right?).

## Upstream Context

If `/stacks-office-hours` produced a design document, read it. Don't ask the user to re-explain.

## Vocabulary

Call the Skill tool with `stacks-codebase-design` before Step 3. Every interface
and seam judgement below uses its terms exactly (**module**, **interface**,
**depth**, **seam**, **adapter**, **leverage**, **locality**) and its principles:
the deletion test, the interface is the test surface, and one adapter means a
hypothetical seam while two mean a real one. Do not drift into "component",
"service" or "boundary".

Where the plan is still soft enough that questions outnumber answers, run
`stacks-grilling` first and come back with the decision tree settled.

## Step 1: Scope Review

### Expansion Analysis - Is this doing too much

```
| Addition | Core to goal? | Can ship separately? | Risk if included |
|----------|--------------|---------------------|-----------------|
| [item] | [yes/no] | [yes/no] | [risk] |
```

### Reduction Analysis - Is this doing too little

```
| Missing piece | Needed for v1? | Cost of deferring |
|---------------|---------------|-------------------|
| [item] | [yes/no] | [consequence] |
```

```
📊 Scope: [RIGHT-SIZED / TOO BROAD / TOO NARROW]
Recommended scope: [what should be in vs. out]
```

## Step 2: Data Flow Analysis

Trace data through the Stacks system:

```
[entry point] → [transformation] (file:function) → [exit point]
Error paths: [what happens when each step fails]
```

For Stacks projects, pay attention to:
- Cross-package data flow in the monorepo (`storage/framework/core/*/`)
- Build pipeline flow (source → `bun build` → `dist/`)
- Request flow: route → middleware → action → ORM → database
- CLI flow: `buddy` command → action → core package

## Step 3: Architecture Review

### Dependency Analysis

```
### This change depends on:
| Dependency | Type | Stability | Risk |
|-----------|------|-----------|------|
| [@stacksjs/package] | [internal] | [stable/changing] | [what could break] |

### Depends on this change:
| Consumer | Impact | Migration needed? |
|----------|--------|-------------------|
| [package] | [what changes] | [yes/no] |
```

### Interface Review

For new/changed public interfaces:

```
### [Interface] (file:line)
**Before**: [existing signature]
**After**: [proposed signature]
**Breaking?**: [yes/no]
**Migration path**: [how consumers update]
```

### Consistency Check

- Naming: match existing patterns in the codebase
- Error handling: does this project throw, return Result types, or use error codes?
- Config: does it follow `defineX()` pattern from `@stacksjs/config`?
- Testing: does it follow `bun test` patterns?

## Step 4: Test Matrix

```
### Unit Tests
| Function | Test Case | Input | Expected | Priority |
|----------|-----------|-------|----------|----------|

### Integration Tests
| Flow | Components | Scenario | Priority |
|------|-----------|----------|----------|

### Edge Cases
| Case | Why it matters | Test approach |
|------|---------------|---------------|
```

P0: Must have before merge. P1: Should have. P2: Nice to have.

## Step 5: Implementation Plan

```
### Phase 1: [name]
- [ ] [task with file references]
**Checkpoint**: [what should be true]

### Phase 2: [name]
- [ ] [task]
**Checkpoint**: [what should be true]

### Rollback Plan
1. [specific rollback step]
```

Each phase should be independently mergeable, which is the same bar
`stacks-new-feature` sets for a **tracer bullet**: a narrow but complete path
through model, migration, action, route and test. Hand the phases to that skill
to slice and build, and give each one its blocking edges here so the frontier is
obvious. A change whose blast radius makes a vertical slice impossible is a
**wide refactor**, and it is sequenced expand, migrate, contract instead.

Run `./buddy typecheck` and `bun test` at each checkpoint.

## Output

```
# Plan: [feature/change]

## Scope Assessment
## Data Flow
## Architecture Review
## Test Matrix
## Implementation Plan

## Summary
- Scope: [assessment]
- Breaking changes: [yes/no]
- New dependencies: [list]
- Key risk: [biggest risk + mitigation]
```

## Rules

- **Scope review is not optional.** Even for "just a technical plan."
- **Be specific about files.** "Update auth" → "Add token validation in `storage/framework/core/auth/src/middleware.ts`"
- **Test matrix before implementation.** Knowing what to test shapes how you build.
- **For Stacks monorepo**: always check cross-package impacts.

## Downstream

> **Plan complete.** Build it with `/stacks-new-feature`, driving `/stacks-tdd`
> inside each slice. Then `/stacks-review` for the two-axis review,
> `/stacks-security-audit` for security, or `/stacks-browse` for QA.
