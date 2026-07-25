---
name: stacks-guard
description: Use for safety rails — warns on destructive commands (rm -rf, DROP TABLE, force-push, git reset --hard) and provides freeze mode for focused debugging. Invoke with /stacks-guard.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-guard — Safety Rails

Prevent destructive actions and enforce focus during debugging sessions.

## Destructive Command Detection

### 🔴 CRITICAL — Block and require confirmation:

| Pattern | Risk |
|---------|------|
| `rm -rf /`, `rm -rf ~`, `rm -rf .` | Catastrophic file deletion |
| `DROP TABLE`, `DROP DATABASE`, `TRUNCATE` | Irreversible data loss |
| `git push --force` to `main`/`master` | Overwrites shared history |
| `git reset --hard` with uncommitted changes | Loses uncommitted work |
| `git clean -fd` | Deletes untracked files permanently |
| `buddy migrate:fresh` on production | Drops ALL tables |
| `buddy seed --fresh` on production | Truncates all data |

Response:
```
🔴 GUARD: Destructive command detected
Command: [command]
Risk: [what will be destroyed]
Reversible: [yes/no]
```

### 🟡 WARNING — Warn but allow:

| Pattern | Risk |
|---------|------|
| `git push --force` (non-main) | Overwrites remote branch |
| `rm -rf [specific dir]` | Deletes directory tree |
| `bun remove [core dep]` | May break build |
| `git checkout -- .` | Discards all unstaged changes |
| Bulk file moves/renames | May break imports/aliases |
| Modifying `config/services.ts` | Contains API keys |
| Modifying `storage/framework/core/*/src/index.ts` | Public package API |

### 🟢 INFORMATIONAL — Note but don't block:

| Pattern | Note |
|---------|------|
| `git rebase` | History rewrite — ensure not shared |
| `bun update` (major versions) | May introduce breaking changes |
| Modifying CI/CD config | Affects deployment pipeline |
| Changing auth/permissions code | Security-sensitive |
| Modifying migration files | Database schema change |

## Freeze Mode

Restrict edits during focused debugging.

### Activate
```
/stacks-guard freeze [file or directory pattern]
```

When active:
1. **Block edits outside the freeze scope**
2. **Track all changes** made during the session
3. **Warn if changes grow large** (>5 files or >50 lines)

### Deactivate
```
/stacks-guard thaw
```

Produces a summary of all changes.

## Pre-Commit Safety

Before commits, scan for:
1. **Secrets**: API keys, tokens, passwords in staged files
2. **Debug artifacts**: `console.log`, `debugger`, `TODO: remove`
3. **Large files**: >1MB being committed
4. **Lockfile consistency**: `package.json` changed → `bun.lock` should too

## Stacks-Specific Guards

- **Don't edit `storage/framework/types/*.d.ts`** — these are auto-generated
- **Don't edit `storage/framework/defaults/models/`** without also generating migrations
- **Don't modify `config/services.ts` in commits** — contains API keys
- **Check `storage/framework/core/*/package.json` versions** — workspace packages should stay in sync

## Rules

- **Never silently allow destructive commands.**
- **Don't be annoying.** `rm file.txt` doesn't need a warning. `rm -rf node_modules` is fine — it's regenerable.
- **Respect user intent.** After warning once, if confirmed, proceed.
- **Context matters.** Force-push to personal branch ≠ force-push to main.
