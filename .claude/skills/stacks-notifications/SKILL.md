---
name: stacks-notifications
description: Use when implementing notifications in a Stacks application — sending notifications via email, SMS, push, or in-app channels. Covers @stacksjs/notifications, config/notification.ts, and app/Notifications/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Notifications

The `@stacksjs/notifications` package provides a multi-channel notification system for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/notifications/src/`
- Configuration: `config/notification.ts`
- Application notifications: `app/Notifications/` (in defaults)
- Notification model: `storage/framework/models/Notification.ts`
- Package: `@stacksjs/notifications`

## Channels
- **Email** - Via `@stacksjs/email`
- **SMS** - Via `@stacksjs/sms`
- **Push** - Via `@stacksjs/push`
- **In-app** - Database-backed notifications

## CLI Commands
- `buddy make:notification` - Create a new notification

## Architecture
- Notifications are multi-channel by design
- Each notification specifies which channels to use
- Channel configuration is in `config/notification.ts`
- Notification model stores in-app notifications

## Gotchas
- Notifications aggregate email, SMS, push, and in-app channels
- Use `buddy make:notification` to scaffold new notifications
- Channel-specific configuration is in each channel's config
- Notification model is at `storage/framework/models/Notification.ts`
