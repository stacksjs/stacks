/**
 * Every source file that should be auto-imported appears in its barrel.
 *
 * `generated-declarations.test.ts` next door asks the opposite question -
 * whether each DECLARED global exists at runtime. Both directions are needed,
 * because adding `app/Jobs/ProbeStaleJob.ts` and committing without running
 * `buddy generate` leaves the barrel and the declarations stale TOGETHER. They
 * agree with each other, so the existing check sees nothing, and the job is
 * silently not a global (stacksjs/stacks#2408).
 *
 * This is option 3 from that issue, and deliberately the weak one. A real
 * freshness check - regenerate and diff - cannot work while generation is
 * config-driven: which files get emitted depends on `feature()` gates that read
 * config that reads env, so CI without `.env.keys` legitimately produces a
 * different set than a developer machine. Options 1 and 2 there (generate under
 * a canonical config, or stop committing these) are the ones that make the
 * output reproducible, and both change what apps receive.
 *
 * What this does catch is the reported case: a file on disk that no barrel
 * mentions. It says nothing about ordering, contents, or the declarations.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname

/** Barrel file → the directories whose modules it should re-export. */
const barrels: Record<string, string[]> = {
  'jobs.ts': ['app/Jobs', 'storage/framework/defaults/app/Jobs'],
  'listeners.ts': ['app/Listeners', 'storage/framework/defaults/app/Listeners'],
  'actions.ts': ['app/Actions', 'storage/framework/defaults/app/Actions'],
  'middleware.ts': ['app/Middleware', 'storage/framework/defaults/app/Middleware'],
}

/** Modules, not the things that sit beside them. */
function sourceFiles(dir: string, found: string[] = []): string[] {
  if (!existsSync(dir))
    return found

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!['dist', 'node_modules', 'tests', '__tests__'].includes(entry))
        sourceFiles(full, found)
      continue
    }

    // `index.ts` is a barrel itself; `.d.ts` declares rather than defines; a
    // test beside the module it tests is not an import target.
    if (!entry.endsWith('.ts') || entry === 'index.ts')
      continue
    if (entry.endsWith('.d.ts') || entry.endsWith('.test.ts') || entry.endsWith('.spec.ts'))
      continue

    found.push(full)
  }

  return found
}

describe('auto-import barrels', () => {
  for (const [barrel, dirs] of Object.entries(barrels)) {
    it(`mentions every module under ${dirs.map(dir => `${dir}/`).join(' and ')}`, () => {
      const barrelPath = join(root, 'storage/framework/auto-imports', barrel)
      if (!existsSync(barrelPath))
        return

      // Match on the module's own name rather than the whole path: the barrel
      // spells app files `../../../app/Jobs/X` and framework ones
      // `../defaults/app/Jobs/X`, and both are correct.
      const referenced = new Set(
        [...readFileSync(barrelPath, 'utf-8').matchAll(/'([^']+)'/g)]
          .map(match => basename(match[1]!, extname(match[1]!))),
      )

      const absent = dirs
        .flatMap(dir => sourceFiles(join(root, dir)))
        .filter(file => !referenced.has(basename(file, '.ts')))
        .map(file => file.replace(root, ''))

      expect(absent.sort()).toEqual([])
    })
  }
})
