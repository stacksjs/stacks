/**
 * Every file `buddy generate:types` writes matches what the source produces.
 *
 * #2056 asks CI to fail when generated artifacts differ from regenerated
 * output. The OpenAPI half was doable; the declarations half was not, and
 * #2408 recorded why: generation was config-driven, so a developer with
 * `.env.keys` and every feature scaffolded produced one file and CI produced
 * another. "Is this file current?" had no single answer, and an attempt at this
 * check was reverted (e75835733b, reverted in 6ecc9e9091 + fde61313c4).
 *
 * `STACKS_CANONICAL_FEATURES=1` gives it one: every framework feature reads as
 * enabled, every optional model module is scanned, and `database/types.d.ts`
 * is written for the default connection whatever DB_CONNECTION the shell
 * carries, so the output is a function of the source tree alone. That is what
 * makes this check meaningful rather than a machine-comparison.
 *
 * ## Which files
 *
 * All of them, measured rather than listed. This check used to compare one
 * path, `types/server-auto-imports.d.ts`, while the same run also rewrote
 * `database/types.d.ts`, the auto-import barrels and the manifest. It printed
 * "current" and left two of those modified on a clean checkout
 * (stacksjs/stacks#2879). A list is what went stale, so instead every tracked
 * and untracked file is fingerprinted before generation and compared after,
 * and anything generation changed, created or removed is reported. A new
 * artifact is covered the day the generator starts writing it.
 *
 * Restores the tree it found, byte for byte, whatever the result: this job
 * reports, it does not edit, and a check that dirties a developer's checkout is
 * one people stop running.
 *
 * Run: `bun .github/scripts/check-declarations-fresh.ts`
 */
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export interface GeneratedDrift {
  path: string
  change: 'modified' | 'created' | 'deleted'
  /** Lines only the committed copy has (modified only). */
  removed: string[]
  /** Lines only the regenerated copy has (modified and created). */
  added: string[]
}

/** The files a regeneration could touch: tracked, plus untracked ones git does not ignore. */
function candidateFiles(root: string): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean)
}

function snapshot(root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>()
  for (const path of new Set(candidateFiles(root))) {
    const absolute = resolve(root, path)
    // A tracked file deleted in the working tree is still listed by --cached,
    // and a tracked symlink (`storage/public`) can point at a directory.
    // Generation writes regular files, so those are the ones compared.
    if (existsSync(absolute) && lstatSync(absolute).isFile())
      files.set(path, readFileSync(absolute))
  }
  return files
}

function lineDiff(before: string, after: string): { removed: string[], added: string[] } {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const beforeSet = new Set(beforeLines)
  const afterSet = new Set(afterLines)
  return {
    removed: beforeLines.filter(line => !afterSet.has(line)),
    added: afterLines.filter(line => !beforeSet.has(line)),
  }
}

/**
 * Runs `generate`, reports every file it changed, and puts each one back.
 *
 * Compares against the working tree as found, not against HEAD, so a local
 * edit to a generated file reads as drift until it is regenerated. In CI the
 * tree is the commit, so there the two are the same thing.
 */
export async function findGeneratedDrift(root: string, generate: () => Promise<void>): Promise<GeneratedDrift[]> {
  const before = snapshot(root)
  let after = before
  try {
    await generate()
  }
  finally {
    // Measured after `generate` even when it throws: a half-finished run has
    // still written files, and they are put back below either way.
    after = snapshot(root)
    for (const [path, content] of before) {
      const now = after.get(path)
      if (now === undefined || !now.equals(content)) {
        mkdirSync(dirname(resolve(root, path)), { recursive: true })
        writeFileSync(resolve(root, path), content)
      }
    }
    for (const path of after.keys()) {
      if (!before.has(path))
        rmSync(resolve(root, path), { force: true })
    }
  }

  const drift: GeneratedDrift[] = []
  for (const [path, content] of before) {
    const now = after.get(path)
    if (now === undefined)
      drift.push({ path, change: 'deleted', removed: [], added: [] })
    else if (!now.equals(content))
      drift.push({ path, change: 'modified', ...lineDiff(content.toString('utf8'), now.toString('utf8')) })
  }
  for (const [path, content] of after) {
    if (!before.has(path))
      drift.push({ path, change: 'created', removed: [], added: content.toString('utf8').split('\n') })
  }
  return drift.sort((a, b) => a.path.localeCompare(b.path))
}

/** The command that regenerates exactly what this check compares against. */
export const REGENERATE = 'STACKS_CANONICAL_FEATURES=1 ./buddy generate:types'

export function describeDrift(drift: GeneratedDrift[], perFile = 10): string {
  const out: string[] = []
  for (const one of drift) {
    out.push(`  ${one.change}: ${one.path}`)
    if (one.change === 'deleted')
      continue
    // Half the budget each way, so a change shows both its sides rather than
    // ten removals and none of what replaced them.
    const removedShown = Math.min(one.removed.length, Math.max(perFile - Math.min(one.added.length, Math.ceil(perFile / 2)), Math.floor(perFile / 2)))
    const addedShown = Math.min(one.added.length, perFile - removedShown)
    out.push(...one.removed.slice(0, removedShown).map(line => `      - ${line.trim()}`))
    out.push(...one.added.slice(0, addedShown).map(line => `      + ${line.trim()}`))
    const hidden = one.removed.length + one.added.length - removedShown - addedShown
    if (hidden > 0)
      out.push(`      ... and ${hidden} more`)
  }
  return out.join('\n')
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dir, '../..')

  const drift = await findGeneratedDrift(root, async () => {
    const proc = Bun.spawn(['./buddy', 'generate:types'], {
      cwd: root,
      env: { ...process.env, STACKS_CANONICAL_FEATURES: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    if (code !== 0) {
      const stderr = (await new Response(proc.stderr).text()).trim()
      throw new Error(`\`buddy generate:types\` exited ${code}, so freshness could not be checked:\n${stderr.slice(-2000)}`)
    }
  }).catch((error: Error) => {
    console.error(`\n${error.message}\n`)
    process.exit(1)
  })

  if (drift.length === 0) {
    console.log('✓ every file `buddy generate:types` writes is current')
    return
  }

  console.error(`\n${drift.length} generated file(s) do not match the source they describe:\n`)
  console.error(describeDrift(drift))
  console.error(`\nRun \`${REGENERATE}\` and commit the result.\n`)
  process.exit(1)
}

if (import.meta.main)
  await main()
