/**
 * The workspace packages CI has to build before it typechecks anything.
 *
 * A workspace package's ROOT export resolves from source when `dist` is
 * missing. A subpath does not: the exports map points `./project` at
 * `./dist/project.js`, `dist` is gitignored, and CI has none until something
 * builds it. So an import like `@stacksjs/path/project` is `TS2307: Cannot find
 * module` in the typecheck job while staying green on every developer machine,
 * where a stale `dist` is already sitting there.
 *
 * This list used to be typed into `ci.yml` by hand, with a test to catch it
 * drifting. The test worked - it named `database` and then `path` - but only
 * after main had already gone red, twice in one day, for a package somebody had
 * no reason to know needed listing. Computing the set removes the step where a
 * person has to remember.
 *
 * Prints one package directory per line, for `for pkg in $(bun … )`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../', import.meta.url).pathname
const coreDir = join(root, 'storage/framework/core')

/**
 * Where subpath imports are written.
 *
 * The core packages' own sources, AND `storage/framework/defaults` - which
 * typecheck and the test suite both compile. Scanning only `core/*` is how
 * `browser` fell off this list: nothing under `core` imports it by subpath, but
 * `defaults/functions/dashboard-api.ts` imports
 * `@stacksjs/browser/composables/csrf`, and dropping it turned every test run
 * into `Cannot find module`.
 */
const SCAN_ROOTS = [coreDir, join(root, 'storage/framework/defaults')]

/** Workspace package names, by the directory that holds them. */
function workspacePackages(): Map<string, string> {
  const byName = new Map<string, string>()

  for (const entry of readdirSync(coreDir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue
    try {
      const manifest = JSON.parse(readFileSync(join(coreDir, entry.name, 'package.json'), 'utf8'))
      if (manifest.name)
        byName.set(manifest.name, entry.name)
    }
    catch {
      // A directory without a readable manifest is not a workspace package.
    }
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

/**
 * Directories whose `dist` a subpath import needs.
 *
 * Static AND dynamic imports count: the ones that actually broke the typecheck
 * were `await import('@stacksjs/error-handling/handler')` inside the router's
 * error path, which a `from '…'` pattern alone does not see.
 */
export function subpathBuildTargets(): string[] {
  const packages = workspacePackages()
  const needed = new Set<string>()

  const files = [
    ...[...packages.values()].flatMap(dir => sourceFiles(join(coreDir, dir, 'src'))),
    ...sourceFiles(join(root, 'storage/framework/defaults')),
  ]

  for (const file of files) {
    // Comment lines first. Half these packages document themselves with
    // `* import { X } from '@stacksjs/email/drivers/log'` in a JSDoc block,
    // and counting those puts four packages on the list that CI never needs
    // to build.
    const source = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => {
        const code = line.trimStart()
        return !code.startsWith('*') && !code.startsWith('//') && !code.startsWith('/*')
      })
      .join('\n')

    const specifiers = [
      ...source.matchAll(/from '(@stacksjs\/[a-z0-9-]+)\/[^']+'/g),
      ...source.matchAll(/\bimport\('(@stacksjs\/[a-z0-9-]+)\/[^']+'\)/g),
    ]

    for (const match of specifiers) {
      // A package importing its OWN subpath needs a dist too - `storage`
      // does exactly that with `@stacksjs/storage/image`.
      const importedDir = packages.get(match[1]!)
      if (importedDir)
        needed.add(importedDir)
    }
  }

  return [...needed].sort()
}

if (import.meta.main)
  console.log(subpathBuildTargets().join('\n'))
