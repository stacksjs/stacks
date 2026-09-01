/**
 * The committed auto-import barrels match what regenerating produces.
 *
 * Half of #2056's first criterion — CI failing when generated artifacts drift
 * from their source. `docs:artifacts:check` covers OpenAPI; this covers the
 * barrels, for the subset where the question is well posed.
 *
 * ## The gap it closes
 *
 * Adding `app/Jobs/Something.ts` and committing without `buddy generate`
 * leaves `auto-imports/jobs.ts` describing a codebase that no longer exists,
 * and every other check passes — including `generated-declarations.test.ts`,
 * which compares declarations against the barrel. Both go stale together, so
 * they agree with each other and it sees nothing. Two stale files being
 * consistent is exactly what makes this invisible.
 *
 * ## Why only three files
 *
 * `models.ts` is deliberately excluded, and so is `server-auto-imports.d.ts`
 * which is derived from it. `resolveDefaultModelDirs()` gates optional model
 * subdirectories on `configEnabled()`, so which models are emitted depends on
 * which features are enabled — and config depends on env, which differs
 * between a developer's machine (`.env.keys` present, values decrypted) and CI
 * (no key, defaults apply). "Is models.ts current?" therefore has no single
 * answer, and an earlier version of this check that included it went red in CI
 * for that reason (#2408).
 *
 * The three barrels here are pure directory scans with no feature gating, and
 * both scanners now sort — the in-repo one in 25109ce2ff, the plugin's in
 * bun-plugin-auto-imports 0.4.2 — so their output is a function of the source
 * rather than of the machine.
 *
 * Run: `bun .github/scripts/check-generated-barrels.ts`
 */

import { execFileSync } from 'node:child_process'
import process from 'node:process'

/**
 * Barrels whose contents depend only on which files exist.
 *
 * Deliberately NOT `models.ts` or `types/server-auto-imports.d.ts`; see above.
 */
const UNGATED_BARRELS = [
  'storage/framework/auto-imports/jobs.ts',
  'storage/framework/auto-imports/controllers.ts',
  'storage/framework/auto-imports/functions.ts',
]

/**
 * Everything a regeneration rewrites, measured by running one against a dirty
 * tree and reading `git status` — not inferred from the write calls, which
 * name their paths through variables.
 */
const GENERATION_WRITES = [
  'storage/framework/auto-imports',
  'storage/framework/types',
  'storage/framework/server-auto-imports.json',
]

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/** Which of the watched paths differ from the index. */
function modified(paths: string[]): string[] {
  return git(['status', '--porcelain', '--', ...paths])
    .split('\n')
    .filter(Boolean)
    .map(line => line.slice(3).trim())
    .filter(Boolean)
}

async function main(): Promise<void> {
  const dirtyBefore = modified(UNGATED_BARRELS)
  if (dirtyBefore.length > 0) {
    console.error('\nThese barrels are already modified in the working tree:\n')
    for (const path of dirtyBefore)
      console.error(`  ${path}`)
    console.error('\nCommit or stash them first — this cannot tell your edits from staleness.\n')
    process.exit(1)
  }

  const { generateAutoImportFiles } = await import('../../storage/framework/core/server/src/imports')
  await generateAutoImportFiles()

  const stale = modified(UNGATED_BARRELS)

  // Restore everything generation touched, not just what this checks: the run
  // also rewrites models.ts, the declarations and the manifest, and leaving
  // any of them modified is a side effect on a developer's tree. A check that
  // dirties the repo is one people stop running.
  //
  // The list is what a regeneration was MEASURED to modify, not what the
  // writes in imports.ts appear to name — the first version of this restored
  // two of the three paths and left `server-auto-imports.json` dirty.
  git(['checkout', '--', ...GENERATION_WRITES])

  if (stale.length === 0) {
    console.log(`✓ generated barrels are current (${UNGATED_BARRELS.length} checked)`)
    return
  }

  console.error('\nGenerated barrels do not match the source they describe:\n')
  for (const path of stale)
    console.error(`  ${path}`)
  console.error('\nRun `buddy generate` and commit the result.\n')
  process.exit(1)
}

if (import.meta.main)
  await main()
