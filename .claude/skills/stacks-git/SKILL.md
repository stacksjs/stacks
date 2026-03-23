---
name: stacks-git
description: Use when working with git in a Stacks application — commit conventions, git hooks, changelog generation, commit scopes/types, or GitHub API types. Covers @stacksjs/git, config/git.ts, config/commit.ts, and the git hooks system.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Git

## Key Paths
- Core package: `storage/framework/core/git/`
- Git config: `config/git.ts`
- Commit config: `config/commit.ts`
- Git hooks config: `storage/framework/core/git-hooks.config.ts`
- Git utilities: `storage/framework/core/utils/src/git.ts`
- Commit action: `storage/framework/core/actions/src/commit.ts`
- Buddy commands: `storage/framework/core/buddy/src/commands/commit.ts`, `changelog.ts`
- GitHub API types: `storage/framework/types/git.ts`
- Core types: `storage/framework/core/types/src/git.ts`

## Git Configuration (config/git.ts)

```typescript
interface GitOptions {
  hooks: GitHooks
  scopes: string[]
  types: { value: string, name: string, emoji: string }[]
  messages: {
    type: string, scope: string, customScope: string, subject: string
    body: string, breaking: string, footer: string, confirmCommit: string
  }
}
```

### Hooks
```typescript
hooks: {
  'pre-commit': 'lint-staged'
}
```

### Commit Types

| Value | Emoji | Description |
|-------|-------|-------------|
| feat | ✨ | A new feature |
| fix | 🐛 | A bug fix |
| docs | 📝 | Documentation only changes |
| style | 💄 | Changes that don't affect meaning |
| refactor | ♻️ | Code change without fix or feature |
| perf | ⚡️ | Performance improvement |
| test | ✅ | Adding/adjusting tests |
| build | 📦️ | Build system or dependencies |
| ci | 🎡 | CI configuration changes |
| chore | 🔨 | Other changes not affecting src/test |
| revert | ⏪️ | Reverts previous commit |

### Commit Scopes

`ci`, `deps`, `dx`, `release`, `docs`, `test`, `core`, `actions`, `arrays`, `auth`, `build`, `cache`, `cli`, `cloud`, `collections`, `config`, `database`, `datetime`, `errors`, `git`, `lint`, `x-ray`, `modules`, `notifications`, `objects`, `path`, `realtime`, `router`, `buddy`, `security`, `server`, `storage`, `strings`, `tests`, `types`, `ui`, `utils`

## Commit Configuration (config/commit.ts)

Based on `cz-git` UserConfig:

```typescript
{
  rules: { 'scope-enum': [2, 'always', [...scopes]] },
  prompt: {
    useEmoji: false,
    allowCustomScopes: true,
    allowEmptyScopes: true,
    allowBreakingChanges: ['feat', 'fix'],
    breaklineNumber: 100,
    breaklineChar: '|',
    issuePrefixs: [{ value: 'closed', name: 'closed: ISSUES has been processed' }],
    maxHeaderLength: Infinity,
    maxSubjectLength: Infinity,
  }
}
```

## Git Utilities

```typescript
import { isGitClean } from '@stacksjs/utils'

function isGitClean(): boolean
// Uses: git diff-index --quiet HEAD --
// Returns true if clean, false if dirty
```

## CLI Commands

```bash
buddy commit                    # Interactive conventional commit
buddy commit --verbose
buddy commit -p [project]       # Target specific project

buddy changelog                 # Generate changelog
buddy changelog --quiet
buddy changelog --dry-run       # Preview without writing
buddy changelog -p [project]
```

## GitHub API Types

### GitHubCommit
```typescript
interface GitHubCommit {
  sha: string
  commit: {
    author: { name: string, email: string, date: string }
    committer: { name: string, email: string, date: string }
    message: string
    verification: { verified: boolean, reason: string }
  }
  url: string, html_url: string
  author: { login: string, id: number, avatar_url: string }
}
```

### WorkflowRun
```typescript
interface WorkflowRun {
  id: number, name: string, head_branch: string, head_sha: string
  run_number: number, event: string, status: string, conclusion: string
  workflow_id: number, created_at: string, updated_at: string
  actor: { login: string, id: number }
  run_attempt: number, run_started_at: string
  jobs_url: string, logs_url: string, artifacts_url: string
  head_commit: { id: string, message: string, timestamp: string }
}
```

## Package Dependencies

```json
{
  "name": "@stacksjs/git",
  "devDependencies": {
    "@stacksjs/gitlint": "^0.1.5",
    "@stacksjs/gitit": "^0.2.5",
    "bun-git-hooks": "^0.3.1"
  }
}
```

## Gotchas
- **`@stacksjs/git` is mostly re-exports** — actual functionality in `@stacksjs/gitlint`, `@stacksjs/gitit`, `bun-git-hooks`
- **Pre-commit runs lint-staged** — the only default hook
- **Emoji disabled by default** — `useEmoji: false` but emoji mappings exist for each type
- **`buddy commit` runs `npm run commit`** — delegates to commitizen/cz-git flow
- **Scopes dynamically extended** — component and function names merged into scopes at runtime
- **Breaking changes only for feat/fix** — `allowBreakingChanges: ['feat', 'fix']`
- **No max header length** — `maxHeaderLength: Infinity`
- **Git hooks config re-exports** — `git-hooks.config.ts` just re-exports from `config/git.ts`
