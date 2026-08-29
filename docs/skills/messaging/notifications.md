---
title: "Notifications skill"
description: "Use when implementing notifications in Stacks."
---
# Notifications

`stacks-notifications` · Messaging · model-invoked

One notification, many channels: email, SMS, push, chat and database. Covers the
database driver's read and unread tracking and the factory helpers for each
channel.

## When to reach for it

- Multi-channel notifications (email, SMS, push, chat, database)
- The database notification driver with read/unread tracking
- Notification factories (useEmail, useSMS, useChat, useDatabase)
- Notification configuration

## Covers

`@stacksjs/notifications`, `config/notification.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Package Exports
- Channel Factories
- Database Notification Driver
- Notification Model Fields
- CLI Commands
- config/notification.ts
- Architecture
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/notifications/src/`
- Main entry: `storage/framework/core/notifications/src/index.ts`
- Drivers: `storage/framework/core/notifications/src/drivers/`
- Database driver: `storage/framework/core/notifications/src/drivers/database.ts`
- Configuration: `config/notification.ts`
- Notification model: `storage/framework/defaults/app/Models/Notification.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-notifications
```

Source: [`stacks-notifications/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-notifications/SKILL.md).
Shadow it for one project with `app/Skills/stacks-notifications/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
