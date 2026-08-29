---
title: "Chat skill"
description: "Use when implementing chat messaging in Stacks."
---
# Chat

`stacks-chat` · Messaging · model-invoked

Messages into Slack, Discord and Microsoft Teams, through webhooks or bot tokens,
behind a shared driver abstraction with retry logic and multi-channel routing.

## When to reach for it

- Sending messages to Slack (webhooks, bot tokens, block kit)
- Discord (webhooks, bot tokens, embeds)
- Microsoft Teams (adaptive cards, webhooks)
- The BaseChatDriver abstraction
- Retry logic
- Multi-channel chat routing

## Covers

`@stacksjs/chat`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Router (index.ts)
- BaseChatDriver (base.ts)
- ChatMessage Interface (from @stacksjs/types)
- ChatResult Interface (from @stacksjs/types)
- Slack Driver
- Discord Driver
- Teams Driver
- Retry Logic
- Dependencies
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/chat/src/`
- Types: `storage/framework/core/types/src/chat.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-chat
```

Source: [`stacks-chat/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-chat/SKILL.md).
Shadow it for one project with `app/Skills/stacks-chat/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
