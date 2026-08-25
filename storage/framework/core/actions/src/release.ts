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

// LintFix used to run here as a pre-publish quality gate. It does not any more,
// because a release must publish what was reviewed rather than rewrite it.
//
// `Action.LintFix` runs pickier with `fix: true` over the whole tree, so it
// WROTE to source on the way to tagging, and its writes were not safe:
//
//   - markdown mangling, `'hello_world'` -> `'hello*world'` across SKILL.md,
//     because `_` is read as emphasis markup
//   - `let cur = {}` -> `const cur = {}` inside a shell heredoc in
//     `commands/deploy.ts`, with `cur = JSON.parse(...)` still assigning to it
//     two lines later: a runtime TypeError on the box
//   - used parameters renamed to `_name` while the body still refers to them,
//     e.g. `createMiddlewareHandler(routeKey, handler)`
//
// Reproduced at 65 files rewritten in a single run, which then still failed on
// findings it could not fix, so the operator got a corrupted tree AND no
// release. Auto-fixing at release time also means shipping edits nobody read.
//
// The gate is not lost. CI runs `buddy lint` on every push and blocks merge,
// and `release.yml` gates publishing on the same checks after the tag lands.
// The cost of dropping it here is that a lint failure surfaces at publish
// rather than before the tag, which is a re-tag: strictly cheaper than
// corrupting the working tree.
const isDryRun = passthrough.dryRun === true || passthrough.dryRun === 'true'
const actions: Action[] = [Action.GenerateLibraryEntries, Action.Bump]

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

// Same reason as in the command: a dry run must not report a release.
log.success(
  isDryRun
    ? `Dry run complete for ${app.name}. Nothing was committed, tagged or pushed.`
    : `Successfully released ${app.name}`,
)
