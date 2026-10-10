---
title: "Testing skill"
description: "Use when writing or running tests in Stacks - test setup, database test utilities (setup, refresh, truncate), DynamoDB testing, feature test patterns, the test CLI commands, test configuration in bunfig.toml, or test environment setup. Covers @stacksjs/testing and tests/."
---
# Testing

`stacks-testing` · Native Stacks · model-invoked

Use when writing or running tests in Stacks - test setup, database test utilities (setup, refresh, truncate), DynamoDB testing, feature test patterns, the test CLI commands, test configuration in bunfig.toml, or test environment setup. Covers @stacksjs/testing and tests/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Test Setup
- DynamoDB Testing
- Writing Tests
- Queue Testing
- HTTP, identity and boundary assertions
- Fakes, time and CLI tests
- CLI Commands
- Configuration (bunfig.toml)
- Test File Conventions
- Gotchas
- Downstream

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-testing
```

Source: [`stacks-testing/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-testing/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-testing/SKILL.md`. See [Using skills](/skills/using).
