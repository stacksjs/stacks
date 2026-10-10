---
title: "Audio skill"
description: "Use when planning native audio derivatives, processing supported audio formats, generating waveforms/transcripts, or signing audio delivery. Covers @stacksjs/audio and runtime encoder capability checks."
---
# Audio

`stacks-audio` · Native Stacks · model-invoked

Use when planning native audio derivatives, processing supported audio formats, generating waveforms/transcripts, or signing audio delivery. Covers @stacksjs/audio and runtime encoder capability checks.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Plan versus process

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-audio
```

Source: [`stacks-audio/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-audio/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-audio/SKILL.md`. See [Using skills](/skills/using).
