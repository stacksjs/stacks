---
name: stacks-review
description: Use when reviewing code changes in the Stacks project — two-pass code review with critical issue detection, test coverage audit, and auto-fix workflow. Invoke with /stacks-review.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-review — Code Review

You are performing a structured two-pass code review for the Stacks framework. Be direct, specific, and opinionated. Every finding must reference a specific file and line number.

## Determine Scope

1. If the user provides a PR number or branch, review the diff against the base branch
2. If no scope is given, review staged changes (`git diff --cached`). If nothing staged, review unstaged (`git diff`)
3. If no changes at all, ask what to review

Read changed files in full to understand context around the changes.

## Pass 1: Critical Issues

Scan for issues that **must be fixed before merge**. Only flag with confidence 8/10+:

### Security
- SQL injection, XSS, command injection, path traversal
- Hardcoded secrets, API keys, tokens (check `config/services.ts`)
- Missing auth/authorization checks on API routes
- Unsafe deserialization or eval usage
- Improper input validation at system boundaries

### Correctness
- Race conditions, missing `await` on async calls
- Off-by-one errors, null/undefined access without guards
- Resource leaks (unclosed database connections, missing `db.close()`)
- Incorrect error handling (swallowed errors, wrong error types)
- Logic errors in ORM model definitions or migration files

### Stacks-Specific
- Incorrect model attribute definitions (wrong validator types, missing `factory` for seeder)
- Broken route definitions (missing middleware, wrong action paths)
- Misconfigured `config/*.ts` files
- Breaking changes to `@stacksjs/*` package exports
- Migration files that won't work on SQLite (check preprocessing quirks)

For each critical finding:

```
🔴 CRITICAL: [title]
File: [path]:[line]
Issue: [specific description]
Impact: [what can go wrong]
Fix: [concrete fix, not "consider doing X"]
```

## Pass 2: Informational

Scan for non-blocking issues:

- Run `bunx --bun pickier` compliance (don't flag what pickier catches)
- TypeScript best practices (avoid `any`, prefer discriminated unions, use `satisfies`)
- Naming clarity (misleading variable/function names)
- Missing error context (errors that lose stack traces)
- Test gaps (changed logic without corresponding test changes)
- Dead code introduced by the change
- Performance concerns (N+1 queries in ORM, unnecessary re-renders)
- Conventional commit compliance for the PR title (`gitlint` standards)

For each:

```
🟡 INFO: [title]
File: [path]:[line]
Note: [observation]
Suggestion: [improvement]
```

## Test Coverage Audit

1. Identify all changed functions/methods
2. Search for existing tests (`bun test` files)
3. List untested paths

```
## Test Coverage

| Changed Function | Test File | Covered? |
|-----------------|-----------|----------|
| [function] | [test file or "none"] | ✅ / ❌ |

Missing coverage:
- [untested path or edge case]
```

## Auto-Fix Workflow

After presenting findings, ask:

> "Want me to fix the mechanical issues? (formatting, imports, simple type fixes)"

If yes, fix ONLY mechanical issues. After fixing, run `bunx --bun pickier . --fix`.

Do NOT auto-fix: architectural decisions, logic changes, anything with multiple valid approaches.

## Output Format

```
# Code Review: [brief description]

## Pass 1: Critical Issues
[findings or "No critical issues found."]

## Pass 2: Informational
[findings]

## Test Coverage
[table]

## Summary
- Critical: [count]
- Informational: [count]
- Test gaps: [count]
```

## Rules

- Never say "consider" or "you might want to" — it's a problem or it isn't
- Every finding must have a concrete fix
- Don't flag style issues that `pickier` would catch
- Don't review generated files, lock files, or `storage/framework/types/` auto-generated types
- For Stacks monorepo changes, check cross-package impacts — a change in `core/` might affect 15+ downstream packages

## Downstream

> **Review complete.** Run `/stacks-browse` to QA in the browser, or `/stacks-retro` to reflect on this session.
