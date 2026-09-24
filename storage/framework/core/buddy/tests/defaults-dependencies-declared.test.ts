import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'

/**
 * Every first-party package the shipped defaults import is one `stacks`
 * depends on.
 *
 * A scaffolded app depends on the `stacks` meta package and nothing else of
 * ours, so `storage/framework/defaults` - its routes, actions, models, views -
 * can only reach what that manifest pulls in. `@stacksjs/forms` was missing:
 * `buddy forms:install` switched on routes whose handlers `import()` it, and
 * every request to them failed with "Cannot find module", in an app that had
 * done exactly what the install told it to. `@stacksjs/sites` resolved only
 * because three other packages happen to depend on it.
 *
 * Scoped to packages that live in `core/`: anything else (`@stacksjs/stx`,
 * `@stacksjs/bun-router`) is another repository's release, pulled in by the
 * core package that wraps it.
 */

/** Comments removed, so prose about an import is not read as one (see declared-dependencies.test.ts). */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

const core = resolve(import.meta.dir, '../..')
const defaults = resolve(core, '../defaults')

function firstPartyPackages(): Set<string> {
  const names = new Set<string>()
  for (const entry of readdirSync(core)) {
    const manifest = join(core, entry, 'package.json')
    try {
      const pkg = JSON.parse(readFileSync(manifest, 'utf-8')) as { name?: string, private?: boolean }
      if (pkg.name?.startsWith('@stacksjs/') && !pkg.private)
        names.add(pkg.name)
    }
    catch {
      // not a package directory
    }
  }
  return names
}

function importedBy(dir: string, found = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (entry === 'node_modules' || entry === 'tests')
      continue
    if (statSync(path).isDirectory()) {
      importedBy(path, found)
      continue
    }
    if (!/\.(?:ts|stx)$/.test(entry) || entry.endsWith('.test.ts'))
      continue

    const source = withoutComments(readFileSync(path, 'utf-8'))
    for (const match of source.matchAll(/(?:from\s+|import\(\s*)['"](@stacksjs\/[a-z0-9-]+)/g)) {
      if (!found.has(match[1]!))
        found.set(match[1]!, path.replace(`${defaults}/`, 'defaults/'))
    }
  }
  return found
}

describe('the stacks meta package', () => {
  it('depends on every first-party package the defaults import', () => {
    const meta = JSON.parse(readFileSync(join(core, 'package.json'), 'utf-8'))
    const declared = new Set(Object.keys({ ...meta.dependencies, ...meta.optionalDependencies }))
    const ours = firstPartyPackages()

    const undeclared = [...importedBy(defaults)]
      .filter(([name]) => ours.has(name) && !declared.has(name))
      .map(([name, file]) => `${name} (imported by ${file})`)
      .sort()

    expect(undeclared).toEqual([])
  })
})
