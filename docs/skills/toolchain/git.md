---
title: "Git skill"
description: "Use when working with git in a Stacks application."
---
# Git

`stacks-git` · Toolchain · model-invoked

Commit conventions, hooks, changelog generation, the scope and type vocabulary,
and resolving an in-progress merge or rebase conflict by intent.

## When to reach for it

- Commit conventions
- Git hooks
- Changelog generation
- Commit scopes and types
- GitHub API types
- Resolving an in-progress merge
- Rebase conflict

## Covers

`@stacksjs/git`, `config/git.ts`, `config/commit.ts`, the git hooks system.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Git Configuration (config/git.ts)
- Commit Configuration (config/commit.ts)
- Git Utilities
- CLI Commands
- GitHub API Types
- Package Dependencies
- Resolving a merge or rebase conflict
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/git/`
- Git config: `config/git.ts`
- Commit config: `config/commit.ts`
- Git hooks config: `storage/framework/core/git-hooks.config.ts`
- Git utilities: `storage/framework/core/utils/src/git.ts`
- Commit action: `storage/framework/core/actions/src/commit.ts`
- Buddy commands: `storage/framework/core/buddy/src/commands/commit.ts`, `changelog.ts`
- GitHub API types: `storage/framework/types/git.ts`
- Core types: `storage/framework/core/types/src/git.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-git
```

Source: [`stacks-git/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-git/SKILL.md).
Shadow it for one project with `app/Skills/stacks-git/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
