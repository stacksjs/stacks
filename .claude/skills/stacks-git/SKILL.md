---
name: stacks-git
description: Use when working with git utilities in a Stacks project — commit conventions, git hooks, changelog generation, or git-related configuration. Covers @stacksjs/git, config/git.ts, and config/commit.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Git

The `@stacksjs/git` package provides git utilities and conventions for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/git/src/`
- Git config: `config/git.ts`
- Commit config: `config/commit.ts`
- Git types: `storage/framework/types/git.ts`
- VCS defaults: `storage/framework/defaults/vcs/github/`
- Package: `@stacksjs/git`

## CLI Commands
- `buddy commit` - Create a conventional commit
- `buddy changelog` - Generate changelog
- `buddy release` - Release automation

## Commit Conventions
Stacks uses **conventional commits**:
- `fix:` - Bug fix
- `feat:` - New feature
- `chore:` - Maintenance
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Test additions/changes

## Features
- Git hook management (via bun-git-hooks)
- Conventional commit enforcement
- Changelog generation
- Release automation

## Gotchas
- Always use conventional commit messages
- Git configuration is in `config/git.ts`
- Commit conventions are in `config/commit.ts`
- The framework uses `bun-git-hooks` for hook management
- GitHub-specific defaults are in `storage/framework/defaults/vcs/github/`
