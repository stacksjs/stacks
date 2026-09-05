/**
 * The committed server auto-import declarations match what the source produces.
 *
 * #2056 asks CI to fail when generated artifacts differ from regenerated
 * output. The OpenAPI half was doable; the declarations half was not, and
 * #2408 recorded why: generation was config-driven, so a developer with
 * `.env.keys` and every feature scaffolded produced one file and CI produced
 * another. "Is this file current?" had no single answer, and an attempt at this
 * check was reverted (e75835733b, reverted in 6ecc9e9091 + fde61313c4).
 *
 * `STACKS_CANONICAL_FEATURES=1` gives it one: every framework feature reads as
 * enabled and every optional model module is scanned, whatever the project
 * carries, so the output is a function of the source tree alone. That is what
 * makes this check meaningful rather than a machine-comparison.
 *
 * Regenerates into place, compares, and restores the original on failure so a
 * red run does not leave a dirty tree behind.
 *
 * Run: `bun .github/scripts/check-declarations-fresh.ts`
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '../..')
const declarations = resolve(root, 'storage/framework/types/server-auto-imports.d.ts')

async function main(): Promise<void> {
  const committed = readFileSync(declarations, 'utf-8')

  const proc = Bun.spawn(['./buddy', 'generate:types'], {
    cwd: root,
    env: { ...process.env, STACKS_CANONICAL_FEATURES: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const code = await proc.exited
  if (code !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim()
    console.error(`\`buddy generate:types\` exited ${code}, so freshness could not be checked:\n${stderr.slice(-2000)}\n`)
    process.exit(1)
  }

  const regenerated = readFileSync(declarations, 'utf-8')
  if (regenerated === committed) {
    console.log('✓ server auto-import declarations are current')
    return
  }

  // Put the committed file back: this job reports, it does not edit.
  writeFileSync(declarations, committed)

  const committedLines = committed.split('\n')
  const regeneratedLines = regenerated.split('\n')
  const added = regeneratedLines.filter(line => !committedLines.includes(line))
  const removed = committedLines.filter(line => !regeneratedLines.includes(line))

  console.error('\nstorage/framework/types/server-auto-imports.d.ts is stale.\n')
  for (const line of removed.slice(0, 20))
    console.error(`  - ${line.trim()}`)
  for (const line of added.slice(0, 20))
    console.error(`  + ${line.trim()}`)
  if (added.length + removed.length > 40)
    console.error(`  ... and ${added.length + removed.length - 40} more`)

  console.error('\nRun `buddy generate:types` and commit the result.\n')
  process.exit(1)
}

if (import.meta.main)
  await main()
