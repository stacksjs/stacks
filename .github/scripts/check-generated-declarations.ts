/**
 * The committed auto-import barrels and declarations match what regenerating
 * would produce.
 *
 * `docs:artifacts:check` does this for OpenAPI. Nothing did it for the other
 * half of #2056's first criterion — the generated DECLARATIONS — and the gap
 * is not theoretical. Adding `app/Jobs/ProbeStaleJob.ts` and committing without
 * running `buddy generate` leaves both `auto-imports/jobs.ts` and
 * `types/server-auto-imports.d.ts` describing a codebase that no longer exists,
 * and every check passes:
 *
 *   generated-declarations.test.ts — passes. It asks whether each DECLARED
 *   global exists at runtime, and compares against the barrel. Both files are
 *   stale together, so they agree with each other and the test sees nothing.
 *   Two stale files are consistent; that is exactly what makes this invisible.
 *
 * The consequence is a job the app can call and TypeScript says is undefined,
 * or worse the reverse. So: regenerate into the working tree, diff against
 * what git has, put the tree back.
 *
 * Restoring afterwards matters. CI runs on a throwaway checkout and would not
 * care, but a developer running this locally must not be left with a dirty
 * tree — a check that has side effects is one people stop running.
 *
 * Run: `bun .github/scripts/check-generated-declarations.ts`
 */

import { execFileSync } from 'node:child_process'
import process from 'node:process'

/** Paths `generateAutoImportFiles()` writes. */
const GENERATED = [
  'storage/framework/auto-imports',
  'storage/framework/types/server-auto-imports.d.ts',
  'storage/framework/types/browser-auto-imports.d.ts',
]

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/** Tracked paths whose contents differ from the index, among GENERATED. */
function dirtyGenerated(): string[] {
  const output = git(['status', '--porcelain', '--', ...GENERATED])
  return output
    .split('\n')
    .filter(Boolean)
    .map(line => line.slice(3).trim())
    .filter(Boolean)
}

async function main(): Promise<void> {
  const alreadyDirty = dirtyGenerated()
  if (alreadyDirty.length > 0) {
    console.error('\nGenerated declarations are already modified in the working tree:\n')
    for (const path of alreadyDirty)
      console.error(`  ${path}`)
    console.error('\nCommit or stash them first — this check cannot tell your edits from staleness.\n')
    process.exit(1)
  }

  const { generateAutoImportFiles } = await import('../../storage/framework/core/server/src/imports')
  await generateAutoImportFiles()

  const stale = dirtyGenerated()

  // Put the tree back either way, before reporting, so a failure does not also
  // leave a mess to clean up.
  if (stale.length > 0)
    git(['checkout', '--', ...GENERATED])

  if (stale.length === 0) {
    console.log(`✓ generated declarations are current (${GENERATED.length} path(s) checked)`)
    return
  }

  console.error('\nGenerated declarations do not match the source they describe:\n')
  for (const path of stale)
    console.error(`  ${path}`)
  console.error('\nRun `buddy generate` and commit the result.\n')
  process.exit(1)
}

if (import.meta.main)
  await main()
