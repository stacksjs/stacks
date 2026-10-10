---
title: "Git skill"
description: "Use when working with git in a Stacks application - commit conventions, git hooks, changelog generation, commit scopes and types, GitHub API types, or resolving an in-progress merge or rebase conflict. Covers @stacksjs/git, config/git.ts, config/commit.ts, and the git hooks system."
---
# Git

`stacks-git` · Native Stacks · model-invoked

Use when working with git in a Stacks application - commit conventions, git hooks, changelog generation, commit scopes and types, GitHub API types, or resolving an in-progress merge or rebase conflict. Covers @stacksjs/git, config/git.ts, config/commit.ts, and the git hooks system.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Git Configuration (config/git.ts)
- Commit Configuration (config/commit.ts)
- Git Utilities
- CLI Commands
- GitHub API Types
- Package Dependencies
- Resolving a merge or rebase conflict
- Gotchas

## Supporting references

- [NOTICE.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-git/NOTICE.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-git
```

Source: [`stacks-git/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-git/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-git/SKILL.md`. See [Using skills](/skills/using).
