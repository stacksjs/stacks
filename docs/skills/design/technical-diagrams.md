---
title: "Technical diagrams skill"
description: "Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle diagrams for Stacks applications as explorable standalone HTML with inline SVG, dark/light themes, four visual presets, optional trace motion, and PNG, JPEG, WebP, SVG and WebM export. Accepts plain-language requirements or pasted Mermaid; reads repository evidence when the diagram must reflect real code; compares two architecture snapshots as a Before/Delta/After review."
---
# Technical diagrams

`stacks-technical-diagrams` · Design · model-invoked

Architecture, workflow, sequence, data flow and lifecycle diagrams, rendered from
typed JSON into one explorable, self-contained HTML file. The largest skill in the
set by supporting files: five renderers, six schemas, a delta comparer and four
reference documents sit behind one lean `SKILL.md`, which is progressive
disclosure doing its job.

## Inside the skill

The sections an agent reads once the skill loads.

- Attribution
- Running the CLI
- Fast authoring path
- Stacks repository workflow
- Type router
- Mermaid input
- Authoring invariants
- Delivery evidence
- Architecture Delta
- Brand marks
- Dependency-free and offline contract
- Deeper references
- Hand-placed fallback (no Bun available)
- Output

## Supporting files

Reference, renderers and scripts the skill reaches for on demand, rather than loading up front.

- [`LICENSE`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/LICENSE)
- [`THIRD_PARTY_NOTICES.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/THIRD_PARTY_NOTICES.md)
- [`agents/openai.yaml`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/agents/openai.yaml)
- [`assets/template.html`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/assets/template.html)
- [`bin/diagrams`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/bin/diagrams)
- [`bin/technical-diagrams.mjs`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/bin/technical-diagrams.mjs)
- [`bin/preview.mjs`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/bin/preview.mjs)
- [`bin/visual-check.mjs`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/bin/visual-check.mjs)
- [`brand-marks/README.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/brand-marks/README.md)
- [`bunfig.toml`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/bunfig.toml)
- [`delta/architecture-delta.mjs`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/delta/architecture-delta.mjs)
- [`examples`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/examples)
- [`migrations/workflow-v2.mjs`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/migrations/workflow-v2.mjs)
- [`recipes/scenarios.mjs`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/recipes/scenarios.mjs)
- [`references/authoring-contract.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/references/authoring-contract.md)
- [`references/brand-marks.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/references/brand-marks.md)
- [`references/delivery-contract.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/references/delivery-contract.md)
- [`references/viewer-runtime.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/references/viewer-runtime.md)
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
