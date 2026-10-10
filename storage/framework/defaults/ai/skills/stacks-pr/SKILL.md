---
name: stacks-pr
description: Use when writing a PR description with concise behavior, concrete evidence, and material rollback or compatibility risks. Covers Stacks pull request descriptions.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# PR

Read [the Stacks adaptation rules](../stacks-flow/ENGINEERING.md), then
[PLAYBOOK.md](PLAYBOOK.md). The playbook preserves this workflow's decision
criteria; the Stacks rules govern APIs, tooling, tracking, and authorization.

Credit: adapted from Matt Pocock's `pr` skill, MIT licensed.
See [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).

## Completion

Produce the requested behavior or reviewable artifact and satisfy the
playbook's completion criteria. Preserve existing decisions and user edits.
Use the native Stacks skills for implementation and verification, and carry
existing authorization through the workflow.
