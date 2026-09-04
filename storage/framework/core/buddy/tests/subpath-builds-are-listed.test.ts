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
 * `ci.yml` carries the list by hand. This checks the list still matches what
 * the source actually imports, so adding the next subpath import fails here
 * rather than in a red typecheck nobody expected.
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
  it('only name packages that ci.yml builds first', () => {
    const packages = workspacePackages()
    const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf-8')
    const listed = new Set(
      (workflow.match(/for pkg in ([a-z0-9 -]+); do/)?.[1] ?? '').split(/\s+/).filter(Boolean),
    )

    const needed = new Set<string>()
    for (const [name, dir] of packages) {
      for (const file of sourceFiles(join(coreDir, dir, 'src'))) {
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
})
