---
title: "Tunnel skill"
description: "Use when setting up tunnels in Stacks - local development tunnels for webhook testing, custom cloud tunnel deployment to AWS EC2, tunnel event callbacks (onConnect, onRequest, onResponse, onError), subdomain configuration, or the buddy share command. Covers @stacksjs/tunnel."
---
# Tunnel

`stacks-tunnel` · Native Stacks · model-invoked

Use when setting up tunnels in Stacks - local development tunnels for webhook testing, custom cloud tunnel deployment to AWS EC2, tunnel event callbacks (onConnect, onRequest, onResponse, onError), subdomain configuration, or the buddy share command. Covers @stacksjs/tunnel.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Local Tunnel (Quick)
- Advanced Local Tunnel
- Cloud Tunnel Deployment (AWS)
- CLI Command
- TunnelOptions Interface
- Gotchas
- Lifecycle and evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-tunnel
```

Source: [`stacks-tunnel/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-tunnel/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-tunnel/SKILL.md`. See [Using skills](/skills/using).
