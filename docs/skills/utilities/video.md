---
title: "Video skill"
description: "Use when planning or processing native video renditions, HLS/DASH delivery, preview tracks, signed assets, or file/range responses. Covers @stacksjs/video and actual runtime codec capabilities."
---
# Video

`stacks-video` · Native Stacks · model-invoked

Use when planning or processing native video renditions, HLS/DASH delivery, preview tracks, signed assets, or file/range responses. Covers @stacksjs/video and actual runtime codec capabilities.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Plan, process, and serve

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-video
```

Source: [`stacks-video/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-video/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-video/SKILL.md`. See [Using skills](/skills/using).
