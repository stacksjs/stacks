#!/usr/bin/env bun
import { parseOptions } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { Action } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { runActions } from '.'

// Forward any flags passed from `buddy release` (e.g. --bump patch, --dry-run)
// to the chained sub-actions so non-interactive bumps work end-to-end.
// Strip cac's `--` separator key — leaving it in turns into a literal `----`
// CLI arg that confuses the spawned action's argv parsing.
const raw = parseOptions() ?? {}
const passthrough: Record<string, unknown> = {}
for (const [k, v] of Object.entries(raw)) {
  if (k === '--' || k === '_') continue
  passthrough[k] = v
}

// LintFix is a pre-publish quality gate (formats and fixes everything that
// can be auto-fixed). It's skipped on dry-runs because dry-runs are meant
// to verify the bump+publish plumbing, not the working tree's lint state —
// running it would also block CI on transient pickier scan timeouts.
const isDryRun = passthrough.dryRun === true || passthrough.dryRun === 'true'
const actions: Action[] = isDryRun
  ? [Action.GenerateLibraryEntries, Action.Bump]
  : [Action.GenerateLibraryEntries, Action.LintFix, Action.Bump]

const result = await runActions(
  actions,
  {
    cwd: projectPath(),
    ...passthrough,
  },
)

// runActions returns a Result — it does NOT throw on missing actions or
// failed sub-commands. Surface errors so a half-completed release isn't
// reported as success.
if (result && (result as { isErr?: boolean }).isErr) {
  log.error(`Release failed: ${(result as { error?: { message?: string } }).error?.message ?? String((result as { error?: unknown }).error)}`)
  process.exit(1)
}

log.success(`Successfully released ${app.name}`)
