---
title: "Technical diagrams skill"
description: "Create polished, dependency-free architecture, workflow, sequence, data-flow, and lifecycle diagrams for Stacks applications as standalone HTML with inline SVG, dark/light themes, and PNG, JPEG, WebP, and SVG export. Use for system or cloud architecture, security boundaries, network topology, technical workflows, CI/CD, runbooks, API call sequences, request lifecycles, data pipelines, lineage, PII boundaries, state machines, status transitions, or converting Mermaid into a purpose-built diagram."
---
# Technical diagrams

`stacks-technical-diagrams` · Design · model-invoked

Architecture, workflow, sequence, data flow and lifecycle diagrams. The largest
skill in the set by supporting files, with three dozen reference documents behind
one `SKILL.md`, which is progressive disclosure doing its job.

## Inside the skill

The sections an agent reads once the skill loads.

- Attribution
- Dependency-free contract
- Stacks repository workflow
- Choosing a Diagram Type
- Mermaid as an Input Dialect
- Layout principles (read before placing)
- Renderer Modes (architecture / workflow / sequence / dataflow / lifecycle)
- Architecture Mode
- Output

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`.DS_Store`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/.DS_Store)
- [`LICENSE`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/LICENSE)
- [`agents/openai.yaml`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/agents/openai.yaml)
- [`assets/template.html`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/assets/template.html)
- [`bin/technical-diagrams.mjs`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/bin/technical-diagrams.mjs)
- [`bunfig.toml`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/bunfig.toml)
- [`examples/agent-run.lifecycle.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/examples/agent-run.lifecycle.json)
- [`examples/agent-tool-call.workflow.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/examples/agent-tool-call.workflow.json)
- [`examples/cache-miss-request.sequence.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/examples/cache-miss-request.sequence.json)
- [`examples/product-analytics.dataflow.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/examples/product-analytics.dataflow.json)
- [`examples/web-app.architecture.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/examples/web-app.architecture.json)
- [`renderers/architecture`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/renderers/architecture)
- [`renderers/dataflow`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/renderers/dataflow)
- [`renderers/lifecycle`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/renderers/lifecycle)
- [`renderers/sequence`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/renderers/sequence)
- [`renderers/shared`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/renderers/shared)
- [`renderers/workflow`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/renderers/workflow)
- [`schemas/README.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/schemas/README.md)
- [`schemas/architecture.schema.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/schemas/architecture.schema.json)
- [`schemas/common.schema.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/schemas/common.schema.json)
- [`schemas/dataflow.schema.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/schemas/dataflow.schema.json)
- [`schemas/lifecycle.schema.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/schemas/lifecycle.schema.json)
- [`schemas/sequence.schema.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/schemas/sequence.schema.json)
- [`schemas/workflow.schema.json`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/schemas/workflow.schema.json)
- [`scripts/check-render-output.mjs`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/scripts/check-render-output.mjs)
- [`scripts/render-examples.mjs`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/scripts/render-examples.mjs)

## Related skills

- [Actions](/skills/backend/actions)
- [Cloud](/skills/toolchain/cloud)
- [Database](/skills/data/database)
- [Events](/skills/backend/events)
- [Jobs](/skills/backend/jobs)
- [Models](/skills/data/models)
- [Realtime](/skills/backend/realtime)
- [Router](/skills/backend/router)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-technical-diagrams
```

Source: [`stacks-technical-diagrams/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/SKILL.md).
Shadow it for one project with `app/Skills/stacks-technical-diagrams/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
