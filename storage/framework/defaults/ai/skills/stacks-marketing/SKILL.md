---
name: stacks-marketing
description: Use when choosing a marketing workflow or coordinating product positioning, acquisition, conversion, retention, and measurement. Covers the bundled marketing skill catalog and its integration with Stacks application APIs.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Marketing workflows

Read [WORKFLOW.md](WORKFLOW.md) for shared context and Stacks integration.
Then choose the task-specific skill from [CATALOG.md](CATALOG.md). Read its
entrypoint before recommending a workflow; the catalog is a discovery aid.

The catalog ports all 50 skills in the recorded snapshot of
[coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills).
Each retains its playbook, supporting references, templates, and MIT notice.
Marketing names are distinct from Stacks' runtime package skills: marketing
analytics plans measurement; `stacks-analytics` documents the application API.

Start with `stacks-marketing-product-marketing` when positioning or audience
context is missing. Reuse context that already exists. A narrow copy request
does not require a new strategy document. Deliver the requested artifact and
the evidence or assumptions that materially affect it.

Source revisions and all source-to-Stacks mappings are recorded in
[upstream-skills.json](../stacks-flow/upstream-skills.json).
