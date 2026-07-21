---
title: Runtime Data Examples
team: Stacks
outline: deep
---

# {{ title }}

BunPress exposes frontmatter and files from `docs/.data/` directly to the STX render context. No client framework or runtime composable is required.

## Frontmatter

**Input**

```md
---
title: Runtime Data Examples
team: Stacks
---

# {{ title }}

Built by {{ team }}.
```

**Output**

Built by {{ team }}.

## Global data

Add `docs/.data/project.json`:

```json
{
  "repository": "stacksjs/stacks"
}
```

The object is available as `project` in Markdown and STX expressions:

```md
Repository: {{ project.repository }}
```

See the [BunPress data-loading guide](https://github.com/stacksjs/bunpress/blob/main/docs/advanced.md#data-loading) for loaders and build-time data sources.
