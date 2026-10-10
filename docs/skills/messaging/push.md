---
title: "Push skill"
description: "Use when implementing push notifications in Stacks - sending via Expo Push Service or Firebase Cloud Messaging (FCM v1 API), configuring push drivers, batch sending, multicast, topic subscriptions, push notification payloads, token validation, or receipt checking. Covers @stacksjs/push."
---
# Push

`stacks-push` · Native Stacks · model-invoked

Use when implementing push notifications in Stacks - sending via Expo Push Service or Firebase Cloud Messaging (FCM v1 API), configuring push drivers, batch sending, multicast, topic subscriptions, push notification payloads, token validation, or receipt checking. Covers @stacksjs/push.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Browser Web Push

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-push
```

Source: [`stacks-push/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-push/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-push/SKILL.md`. See [Using skills](/skills/using).
