---
name: stacks-chief-of-staff
description: Pursue a long-running goal in a single session by co-ordinating subagents. Covers Stacks engineering workflows.
disable-model-invocation: true
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Chief Of Staff

Read [the Stacks adaptation rules](../stacks-flow/ENGINEERING.md), then
[PLAYBOOK.md](PLAYBOOK.md). The playbook preserves this workflow's decision
criteria; the Stacks rules govern APIs, tooling, tracking, and authorization.

Credit: adapted from Matt Pocock's `chief-of-staff` skill, MIT licensed.
See [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).

This source is in upstream's in-progress collection. Use it explicitly as an
optional workflow; do not install tooling or start background work merely
because the skill is present.

## Completion

Produce the requested behavior or reviewable artifact and satisfy the
playbook's completion criteria. Preserve existing decisions and user edits.
Use the native Stacks skills for implementation and verification, and carry
existing authorization through the workflow.
