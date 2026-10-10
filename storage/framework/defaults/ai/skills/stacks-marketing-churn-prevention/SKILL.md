---
name: stacks-marketing-churn-prevention
description: Use when the user wants to reduce churn, build cancellation flows, set up save offers, recover failed payments, or implement retention strategies. Covers marketing planning and its Stacks implementation.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Marketing Churn Prevention

Read [the shared Stacks workflow](../stacks-marketing/WORKFLOW.md), then
[PLAYBOOK.md](PLAYBOOK.md) before doing this task. Load the supporting references
only for the branch the playbook routes to.

This ports `churn-prevention` from
[coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/tree/1efedbc5148b54b2f0f6c6c9fe0be62e151c7fff/skills/churn-prevention).
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
