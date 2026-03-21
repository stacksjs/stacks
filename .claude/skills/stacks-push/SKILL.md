---
name: stacks-push
description: Use when implementing push notifications in a Stacks application — web push, mobile push, or push notification providers. Covers the @stacksjs/push package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Push Notifications

The `@stacksjs/push` package provides push notification support for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/push/src/`
- Package: `@stacksjs/push`

## Features
- Web push notifications
- Mobile push notification support
- Push provider abstraction
- Notification payload management

## Integration
- Works as a channel within `@stacksjs/notifications`
- Can be triggered from events, jobs, or actions
- Push subscription management

## Gotchas
- Push notifications require service worker setup for web
- Mobile push requires platform-specific configuration
- Use the `@stacksjs/notifications` package for multi-channel notifications
- Push is one channel -- for email use `@stacksjs/email`, for SMS use `@stacksjs/sms`
