---
title: "Tunnel skill"
description: "Use when setting up tunnels in Stacks."
---
# Tunnel

`stacks-tunnel` · Toolchain · model-invoked

Tunnels for webhook testing locally, and custom tunnels deployed to your own EC2,
with event callbacks and subdomain configuration.

## When to reach for it

- Local development tunnels for webhook testing
- Custom cloud tunnel deployment to AWS EC2
- Tunnel event callbacks (onConnect, onRequest, onResponse, onError)
- Subdomain configuration
- The buddy share command

## Covers

`@stacksjs/tunnel`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Local Tunnel (Quick)
- Advanced Local Tunnel
- Cloud Tunnel Deployment (AWS)
- CLI Command
- TunnelOptions Interface
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/tunnel/src/`
- External tool: ~/Code/Tools/localtunnels/

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-tunnel
```

Source: [`stacks-tunnel/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-tunnel/SKILL.md).
Shadow it for one project with `app/Skills/stacks-tunnel/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
