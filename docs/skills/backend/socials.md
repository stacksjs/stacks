---
title: "Socials skill"
description: "Use when implementing social authentication in Stacks."
---
# Socials

`stacks-socials` · Backend and API · model-invoked

OAuth2 sign-in with GitHub, Google, Facebook and Twitter. Covers the provider
base class, PKCE, state handling, scopes and the social profile shape.

## When to reach for it

- OAuth2 flows with GitHub/Google/Facebook/Twitter providers
- The AbstractProvider base class
- PKCE support
- State management
- Scope configuration
- Social user profiles
- Token handling

## Covers

`@stacksjs/socials`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- AbstractProvider Base Class
- Provider Implementations
- SocialUser Interface
- ProviderInterface
- Token Class
- Provider-Specific Types
- Exceptions
- OAuth2 Flow
- Configuration Source
- Dependencies
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/socials/src/`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-socials
```

Source: [`stacks-socials/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-socials/SKILL.md).
Shadow it for one project with `app/Skills/stacks-socials/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
