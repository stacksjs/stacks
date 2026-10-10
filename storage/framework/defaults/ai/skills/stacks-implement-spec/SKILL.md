---
name: stacks-implement-spec
description: Implement the result of /to-spec and /to-tickets in code. Covers Stacks engineering workflows.
disable-model-invocation: true
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Implement Spec

Read [the Stacks adaptation rules](../stacks-flow/ENGINEERING.md), then
[PLAYBOOK.md](PLAYBOOK.md). The playbook preserves this workflow's decision
criteria; the Stacks rules govern APIs, tooling, tracking, and authorization.

Credit: adapted from Matt Pocock's `implement-spec` skill, MIT licensed.
See [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).

## Completion

Produce the requested behavior or reviewable artifact and satisfy the
playbook's completion criteria. Preserve existing decisions and user edits.
Use the native Stacks skills for implementation and verification, and carry
existing authorization through the workflow.
