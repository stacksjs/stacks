---
title: "Push skill"
description: "Use when implementing push notifications in Stacks."
---
# Push

`stacks-push` · Messaging · model-invoked

Push notifications through Expo or Firebase Cloud Messaging: payloads, batch and
multicast sending, topic subscriptions, token validation and receipt checking.

## When to reach for it

- Sending via Expo Push Service
- Firebase Cloud Messaging (FCM legacy and v1 APIs)
- Configuring push drivers
- Batch sending
- Multicast
- Topic subscriptions
- Push notification payloads
- Token validation
- Receipt checking

## Covers

`@stacksjs/push`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Main send() Function
- PushNotification Interface (index.ts)
- PushResult Interface (from @stacksjs/types)
- Types
- Expo Push Driver (expo.ts)
- FCM Driver (fcm.ts)
- Configuration
- Usage Examples
- Dependencies
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/push/src/`
- Types: `storage/framework/core/types/src/push.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-push
```

Source: [`stacks-push/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-push/SKILL.md).
Shadow it for one project with `app/Skills/stacks-push/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
