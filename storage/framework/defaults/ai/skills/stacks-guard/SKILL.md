---
name: stacks-guard
description: Use for safety rails in a Stacks project - detecting destructive commands (rm -rf, DROP TABLE, force-push, git reset --hard, migrate:fresh against production), installing a PreToolUse hook that blocks them before they run, freeze mode for focused debugging, and a pre-commit safety scan. Invoke with /stacks-guard.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-guard - Safety Rails

Prevent destructive actions and enforce focus during debugging sessions.

## Destructive Command Detection

### 🔴 CRITICAL - Block and require confirmation

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

### 🟡 WARNING - Warn but allow

| Pattern | Risk |
|---------|------|
| `git push --force` (non-main) | Overwrites remote branch |
| `rm -rf [specific dir]` | Deletes directory tree |
| `bun remove [core dep]` | May break build |
| `git checkout -- .` | Discards all unstaged changes |
| Bulk file moves/renames | May break imports/aliases |
| Modifying `config/services.ts` | Contains API keys |
| Modifying `storage/framework/core/*/src/index.ts` | Public package API |

### 🟢 INFORMATIONAL - Note but don't block

| Pattern | Note |
|---------|------|
| `git rebase` | History rewrite - ensure not shared |
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

- **Don't edit `storage/framework/types/*.d.ts`** - these are auto-generated
- **Don't edit `storage/framework/defaults/app/Models/`** without also generating migrations
- **Don't modify `config/services.ts` in commits** - contains API keys
- **Check `storage/framework/core/*/package.json` versions** - workspace packages should stay in sync

## Make it enforcing

Everything above is advisory: it works only while the agent is paying attention.
A **PreToolUse hook** turns it into enforcement, because the harness runs it on
every Bash call before the command executes.

[scripts/block-destructive.sh](scripts/block-destructive.sh) is the hook. It
reads the tool call on stdin, exits 2 with a message on stderr when the command
matches a blocked pattern, and exits 0 otherwise. It blocks two lists: commands
that are unrecoverable anywhere (`rm -rf /` or `~` or `.`, force-push,
`reset --hard`, `clean -f`, `branch -D`, `DROP TABLE`, `TRUNCATE TABLE`), and
commands that are routine locally but destructive against production
(`migrate:fresh`, `seed --fresh`, `cloud:remove`, `cloud:cleanup`, gated on the
command naming a production env).

Deliberately not blocked: a plain `git push`, `rm -rf node_modules`,
`buddy migrate:fresh` locally. A guard that fires on regenerable things gets
turned off, and a guard that is off protects nothing.

Credit: adapted from Matt Pocock's `git-guardrails-claude-code` skill (MIT),
<https://github.com/mattpocock/skills>.

### Install

1. **Ask the scope.** This project (`.claude/settings.json`) or every project
   (`~/.claude/settings.json`)?
2. **Copy the script** to `.claude/hooks/block-destructive.sh` or
   `~/.claude/hooks/block-destructive.sh`, and `chmod +x` it.
3. **Register it.** Merge into the existing `hooks.PreToolUse` array rather than
   overwriting the file:

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [
             {
               "type": "command",
               "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-destructive.sh"
             }
           ]
         }
       ]
     }
   }
   ```

   For the global install, the command is `~/.claude/hooks/block-destructive.sh`.
4. **Tune the lists.** Ask the user what to add or remove. A repo that never
   deploys does not need the production list. A repo with a protected `main` may
   want a plain `git push` blocked too.
5. **Verify.** Each of these should print a BLOCKED line and exit 2:

   ```bash
   echo '{"tool_input":{"command":"git push --force origin main"}}' | .claude/hooks/block-destructive.sh
   ```

   And each of these should exit 0 silently:

   ```bash
   echo '{"tool_input":{"command":"rm -rf node_modules"}}' | .claude/hooks/block-destructive.sh
   ```

`.claude/` is gitignored in a Stacks project, so a project-scope install is
per-developer. To make it a team rule, commit the script under `scripts/` and
have `buddy setup:ai` users point their hook at that path.

## Rules

- **Never silently allow destructive commands.**
- **Don't be annoying.** `rm file.txt` doesn't need a warning. `rm -rf node_modules` is fine - it's regenerable.
- **Respect user intent.** After warning once, if confirmed, proceed.
- **Context matters.** Force-push to a personal branch is not force-push to main.

## Downstream

> Guard installed? `/stacks-retro` is where a near-miss becomes a permanent
> check, and `/stacks-wizard` is for the production steps a human should be
> doing by hand anyway.
