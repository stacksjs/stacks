---
title: "Chat skill"
description: "Use when implementing chat messaging in Stacks - sending messages to Slack (webhooks, bot tokens, block kit), Discord (webhooks, bot tokens, embeds), Microsoft Teams (adaptive cards, webhooks), the BaseChatDriver abstraction, retry logic, multi-channel chat routing, or READING a person's conversations from iMessage, WhatsApp, Slack and Discord and archiving them there (the inbox drivers). Covers @stacksjs/chat."
---
# Chat

`stacks-chat` · Native Stacks · model-invoked

Use when implementing chat messaging in Stacks - sending messages to Slack (webhooks, bot tokens, block kit), Discord (webhooks, bot tokens, embeds), Microsoft Teams (adaptive cards, webhooks), the BaseChatDriver abstraction, retry logic, multi-channel chat routing, or READING a person's conversations from iMessage, WhatsApp, Slack and Discord and archiving them there (the inbox drivers). Covers @stacksjs/chat.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- Router (index.ts)
- BaseChatDriver (base.ts)
- ChatMessage Interface (from @stacksjs/types)
- ChatResult Interface (from @stacksjs/types)
- Slack Driver
- Discord Driver
- Teams Driver
- Inbox drivers (reading and archiving)
- Retry Logic
- Dependencies
- Gotchas
- Results and native notification integration

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-chat
```

Source: [`stacks-chat/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-chat/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-chat/SKILL.md`. See [Using skills](/skills/using).
