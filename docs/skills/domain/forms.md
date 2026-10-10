---
title: "Forms skill"
description: "Use when building persisted form definitions, conditional fields, uploads, payments, submissions, or CSV exports. Covers @stacksjs/forms and config/forms.ts."
---
# Forms

`stacks-forms` · Native Stacks · model-invoked

Use when building persisted form definitions, conditional fields, uploads, payments, submissions, or CSV exports. Covers @stacksjs/forms and config/forms.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Definitions and submissions
- Uploads, notifications, and paid forms

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-forms
```

Source: [`stacks-forms/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-forms/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-forms/SKILL.md`. See [Using skills](/skills/using).
