---
title: "Testing skill"
description: "Use when writing or running tests in Stacks."
---
# Testing

`stacks-testing` · Toolchain · model-invoked

The test utilities and setup: the database helpers, DynamoDB testing, feature test
patterns, the CLI flags and the `bunfig.toml` preload. The discipline half is
[TDD](/skills/craft/tdd).

## When to reach for it

- Test setup
- Database test utilities (setup, refresh, truncate)
- DynamoDB testing
- Feature test patterns
- The test CLI commands
- Test configuration in bunfig.toml
- Test environment setup

## Covers

`@stacksjs/testing`, `tests/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Test Setup
- DynamoDB Testing
- Writing Tests
- Queue Testing
- CLI Commands
- Configuration (bunfig.toml)
- Test File Conventions
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/testing/src/`
- Test directory: `tests/`
- Test setup: `tests/setup.ts`
- Package: `@stacksjs/testing`

## Related skills

- [Review](/skills/craft/review)
- [TDD](/skills/craft/tdd)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-testing
```

Source: [`stacks-testing/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-testing/SKILL.md).
Shadow it for one project with `app/Skills/stacks-testing/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
