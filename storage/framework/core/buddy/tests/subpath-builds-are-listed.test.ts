/**
 * Every workspace package imported by subpath is built before CI typechecks.
 *
 * A workspace package's ROOT export resolves from source when `dist` is
 * missing, but a subpath pattern like `./error-page` does not - the exports map
 * points its types at `./dist/*.d.ts`. `dist` is gitignored, so CI has none
 * unless something builds it, and the typecheck job went red with:
 *
 *   error TS2307: Cannot find module '@stacksjs/error-handling/handler'
 *   error TS2307: Cannot find module '@stacksjs/storage/uploaded-file'
 *
 * It stays green on developer machines because a stale `dist` is already
 * sitting there, which is exactly why nobody notices until CI does
 * (stacksjs/stacks#2056).
 *
 * `ci.yml` no longer carries the list by hand - it runs
 * `.github/scripts/subpath-packages.ts`, which computes it. This checks the
 * script still agrees with what the source actually imports, and that CI is
 * still asking it. The hand-written list was checked the same way, and the
 * check worked: it named `database`, then `path`. Both times it named them
 * after main had already gone red, for a package nobody had reason to know
 * needed listing.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname
const coreDir = join(root, 'storage/framework/core')

/** Workspace package names, by directory. */
function workspacePackages(): Map<string, string> {
  const byName = new Map<string, string>()

  for (const entry of readdirSync(coreDir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue
    try {
      const manifest = JSON.parse(readFileSync(join(coreDir, entry.name, 'package.json'), 'utf-8'))
      if (manifest.name)
        byName.set(manifest.name, entry.name)
    }
    catch {}
  }

  return byName
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return found
  }

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'dist' && entry.name !== 'node_modules')
        sourceFiles(full, found)
    }
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      found.push(full)
    }
  }

  return found
}

describe('subpath imports', () => {
  it('are all built first, per the script ci.yml runs', async () => {
    const packages = workspacePackages()
    const { subpathBuildTargets } = await import('../../../../../.github/scripts/subpath-packages')
    const listed = new Set(subpathBuildTargets())

    const needed = new Set<string>()
    // The defaults tree as well as the core packages. Nothing under `core`
    // imports `@stacksjs/browser` by subpath, but
    // `defaults/functions/dashboard-api.ts` imports
    // `@stacksjs/browser/composables/csrf` - so a scan of `core` alone said
    // `browser` was unneeded, and dropping it turned every test run into
    // `Cannot find module`.
    const scanned = [
      ...[...packages.values()].flatMap(dir => sourceFiles(join(coreDir, dir, 'src'))),
      ...sourceFiles(join(root, 'storage/framework/defaults')),
    ]
    {
      for (const file of scanned) {
        /*
         * Real import statements only. Half these packages document themselves
         * with `* import { X } from '@stacksjs/email/drivers/log'` in a JSDoc
         * block, and counting those put four packages on this list that CI
         * never needed to build.
         */
        const source = readFileSync(file, 'utf-8')
          .split('\n')
          .filter((line) => {
            const code = line.trimStart()
            return !code.startsWith('*') && !code.startsWith('//') && !code.startsWith('/*')
          })
          .join('\n')

        /*
         * Static AND dynamic. The imports that actually broke the typecheck
         * were `await import('@stacksjs/error-handling/handler')` inside the
         * router's error path, which a `from '...'` pattern alone does not see.
         */
        const specifiers = [
          ...source.matchAll(/from '(@stacksjs\/[a-z0-9-]+)\/[^']+'/g),
          ...source.matchAll(/\bimport\('(@stacksjs\/[a-z0-9-]+)\/[^']+'\)/g),
        ]

        for (const match of specifiers) {
          const importedDir = packages.get(match[1]!)
          // A package importing its OWN subpath needs a dist too - `storage`
          // does exactly that with `@stacksjs/storage/image`.
          if (importedDir)
            needed.add(importedDir)
        }
      }
    }

    const missing = [...needed].filter(dir => !listed.has(dir))
    expect(missing.sort()).toEqual([])
  })

  /**
   * The script is only worth anything if CI actually runs it. A workflow that
   * went back to a hand-written list would pass the check above and be exactly
   * as stale as before.
   */
  it('are built by the computed set, not a list typed into the workflow', () => {
    const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf-8')

    const loops = [...workflow.matchAll(/for pkg in (.+?); do/g)].map(match => match[1]!)

    expect(loops.length).toBeGreaterThan(0)
    for (const loop of loops)
      expect(loop).toBe('$(bun .github/scripts/subpath-packages.ts)')
  })
})
