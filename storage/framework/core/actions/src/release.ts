#!/usr/bin/env bun
import { parseOptions } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { Action } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { runActions } from '.'
import { BYPASS_ENV, formatPreflightFailure, runPinnedChecks } from './release-preflight'

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

// Pre-flight BEFORE anything mutates the tree or creates a tag.
//
// release.yml gates publishing on these same checks, but only after a tag has
// been pushed, so a stale artifact there costs a re-tag. Catching it here costs
// nothing: no bump, no commit, no tag. Runs on dry-runs too, because a dry run
// whose whole purpose is "would this release work" should not answer yes when
// the real thing would be blocked.
const preflight = await runPinnedChecks({ cwd: projectPath() })
if (preflight.bypassed) {
  log.warn(`${BYPASS_ENV} is set, so the pinned checks were skipped for this release.`)
}
else if (preflight.failures.length > 0) {
  // `log.exit`, not `log.error` + `process.exit`: the error write is async and
  // `process.exit` does not wait for it, so the only line explaining why the
  // release stopped was dropped on the way out. `bun run release:patch` printed
  // nothing at all and exited 1 — a blocked release that looked like a broken one.
  await log.exit(formatPreflightFailure(preflight.failures), 1)
}

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
  await log.exit(`Release failed: ${(result as { error?: { message?: string } }).error?.message ?? String((result as { error?: unknown }).error)}`, 1)
}

log.success(`Successfully released ${app.name}`)
