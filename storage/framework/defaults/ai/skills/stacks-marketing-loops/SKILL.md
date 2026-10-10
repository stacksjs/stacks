---
name: stacks-marketing-loops
description: Use when the user wants to set up a recurring, self-running marketing workflow - a repeatable loop an AI agent runs on a cadence (weekly, daily, on a trigger) rather than a one-off task. Covers marketing planning and its Stacks implementation.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Marketing Loops

Read [the shared Stacks workflow](../stacks-marketing/WORKFLOW.md), then
[PLAYBOOK.md](PLAYBOOK.md) before doing this task. Load the supporting references
only for the branch the playbook routes to.

This ports `marketing-loops` from
[coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/tree/1efedbc5148b54b2f0f6c6c9fe0be62e151c7fff/skills/marketing-loops).
[NOTICE.md](NOTICE.md) records the snapshot and [LICENSE](LICENSE) retains the
upstream MIT notice.

## Stacks integration

Keep marketing recommendations distinct from application API facts. Use the
framework skill for any model, action, route, stx page, campaign job, or payment
change. Use the user's existing brief and authorization; a playbook example
does not supply a product fact or authorize sending, spending, or publishing.

Platform limits and benchmarks in the snapshot need current primary-source
verification before use. Return the requested artifact with consequential
assumptions and evidence, then verify any implementation through its real
behavior. Use TypeScript and Bun for executable helpers.
