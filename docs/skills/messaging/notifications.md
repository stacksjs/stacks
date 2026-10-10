---
title: "Notifications skill"
description: "Use when implementing notifications in Stacks - multi-channel notifications (email, SMS, push, chat, database), the database notification driver with read/unread tracking, notification factories (useEmail, useSMS, useChat, useDatabase), or notification configuration. Covers @stacksjs/notifications and config/notification.ts."
---
# Notifications

`stacks-notifications` · Native Stacks · model-invoked

Use when implementing notifications in Stacks - multi-channel notifications (email, SMS, push, chat, database), the database notification driver with read/unread tracking, notification factories (useEmail, useSMS, useChat, useDatabase), or notification configuration. Covers @stacksjs/notifications and config/notification.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Application notification
- Preferences and delivery tracking
- Channel factories
- Database inbox
- Sources and evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-notifications
```

Source: [`stacks-notifications/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-notifications/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-notifications/SKILL.md`. See [Using skills](/skills/using).
