---
title: "Marketing Ads skill"
description: "the user wants help with paid advertising campaigns on Google Ads, Meta (Facebook/Instagram), LinkedIn, Twitter/X, or other ad platforms."
---
# Marketing Ads

`stacks-marketing-ads` · Marketing · model-invoked

the user wants help with paid advertising campaigns on Google Ads, Meta (Facebook/Instagram), LinkedIn, Twitter/X, or other ad platforms.

Adapted from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/tree/1efedbc5148b54b2f0f6c6c9fe0be62e151c7fff/skills/ads).
Source revisions and adaptation details are recorded in the bundled notice.

## Workflow

Read the skill entrypoint and the branch-specific playbook or references it
points to. It keeps Stacks APIs, TypeScript/Bun tooling, and existing user
authorization in scope. Preserve established project conventions and distinguish
a draft or recommendation from a change already applied.

Marketing recommendations use the established product brief. Source examples
and benchmarks are illustrative; verify changing platform facts before using
them. Implementation uses stx, Crosswind, and the appropriate framework skill.
Upstream CLI tools and MCP servers are optional references, not bundled services.

## Using it

This skill is **model-invoked**. Your agent can select it when the task matches, and you can call it directly.

```text
/stacks-marketing-ads
```

Source: [`stacks-marketing-ads/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-marketing-ads/SKILL.md).

The skill and all supporting files ship in `@stacksjs/defaults`. New apps and
framework upgrades receive them through the managed defaults sync. Run
`buddy setup:ai` to refresh the agent setup. Override this skill per project
with `app/Skills/stacks-marketing-ads/SKILL.md`.

See [Marketing skills](/skills/marketing) and [Marketing workflow](/skills/marketing/marketing).
