---
title: "Technical diagrams skill"
description: "Create validated, interactive diagrams for Stacks, including native entity-relationship diagrams."
---
# Technical diagrams

`stacks-technical-diagrams` creates self-contained HTML with inline SVG, pan/zoom,
search, guided views, light/dark themes, and image/SVG export. It supports ten
native diagram types: architecture, workflow, sequence, dataflow, lifecycle,
**ERD**, class, tree, timeline, and waterfall. It also supports one-page explainers.

The Stacks port follows Archify 3.2.0, pinned to commit
`d6059331abbddb49bca380ff46dca8ce33158b04`. Its Apache-2.0 license, MIT origin
notice, bundled font licenses and third-party notices ship with the sources.

## Run it in Stacks

Use the launcher, which runs Bun with an empty configuration and no application
env file. Child renderers retain the same isolation. Diagram delivery never
checks for or downloads a runtime update; update the pinned port in Stacks.

```sh
storage/framework/defaults/ai/skills/stacks-technical-diagrams/bin/diagrams doctor
storage/framework/defaults/ai/skills/stacks-technical-diagrams/bin/diagrams finalize erd schema.json docs/public/diagrams/application-erd/index.html --quality standard --json
```

Existing `deliver` and `visual-check` commands remain available. Read the current
[skill source](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-technical-diagrams/SKILL.md)
for the bounded authoring and repair workflow.

## Entity-relationship diagrams

Start from the actual model or database schema. Include every physical column of
each selected table, SQL types, primary/foreign/unique key roles, referenced
columns and accurate relationship cardinality. Group tables into rectangular
functional domains and use guided views for dense schemas. A large physical ERD
should start at `standard` quality; avoid hiding fields to make the first view fit.

The current renderer checks attribute capacity, key/reference consistency,
relationship routing and table overlap. `finalize` reports schema, artifact and
browser gates separately; review the rendered result before claiming visual
quality. Browser receipts alone are not a perceptual review.

## Publish with BunPress

Write artifacts under `docs/public/diagrams/<slug>/index.html` and keep the source
JSON alongside them. Link from a Markdown guide using `/diagrams/<slug>` so
BunPress applies the docs base path. Keep repository provenance private when the
application's white-label requirements prohibit exposing its implementation.

## Related skills

- [Database](/skills/data/database)
- [Models](/skills/data/models)
- [Cloud](/skills/toolchain/cloud)
- [Router](/skills/backend/router)
