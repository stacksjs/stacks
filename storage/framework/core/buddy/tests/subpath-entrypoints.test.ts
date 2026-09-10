import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { withoutComments } from './declared-dependencies.test'

/**
 * A package subpath that resolves in TypeScript also resolves at runtime.
 *
 * Every core package's `exports` map sends `./*` to `./dist/*.js`, and dtsx
 * emits a `.d.ts` for every SOURCE file. `Bun.build` emits a `.js` only for a
 * declared ENTRYPOINT. The two disagreeing is silent in the worst way:
 * `@stacksjs/queue/bun-queue` typechecked against `dist/bun-queue.d.ts` while
 * `dist/bun-queue.js` did not exist, so the documented way to reach `dispatch`,
 * `Queue` and the middleware classes threw at import time in every installed
 * app, for as long as the subpath had been documented (stacksjs/stacks#2581).
 *
 * The check is deliberately driven by USE, not by the exports map: `./*` is a
 * wildcard, so the map cannot say which subpaths exist. What it can say is that
 * every subpath somebody imports must be buildable.
 */

const coreDir = dirname(dirname(import.meta.dir))
const frameworkDir = dirname(coreDir)
const repoRoot = dirname(dirname(frameworkDir))

/** Directories whose source is allowed to name a core subpath. */
const scanRoots = [
  coreDir,
  join(frameworkDir, 'defaults'),
  join(repoRoot, 'docs'),
]

const SUBPATH = /@stacksjs\/([a-z][\w-]*)\/([\w./-]+)/g

/** Every `@stacksjs/<pkg>/<subpath>` named in real code under `dir`. */
function collectSubpaths(dir: string, found = new Map<string, Set<string>>()): Map<string, Set<string>> {
  for (const entry of readdirSync(dir)) {
    // `dist` is build output and `node_modules` is not ours; both are full of
    // minified strings that happen to match anything.
    if (entry === 'dist' || entry === 'node_modules' || entry.startsWith('.'))
      continue

    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      collectSubpaths(path, found)
      continue
    }
    if (!/\.(?:ts|md)$/.test(entry))
      continue

    // Markdown is scanned whole: a fenced sample is the documentation making
    // the same promise the exports map does. TypeScript has its comments
    // stripped, since prose about a specifier is not an import of it.
    const source = readFileSync(path, 'utf8')
    const scanned = entry.endsWith('.md') ? source : withoutComments(source)

    for (const match of scanned.matchAll(SUBPATH)) {
      const [, pkg, subpath] = match
      if (!pkg || !subpath)
        continue
      const trimmed = subpath.replace(/\.js$/, '')
      if (!existsSync(join(coreDir, pkg, 'build.ts')))
        continue
      const set = found.get(pkg) ?? new Set<string>()
      set.add(trimmed)
      found.set(pkg, set)
    }
  }
  return found
}

/**
 * The subpaths a package's `build.ts` can produce, or `null` for "all of them".
 *
 * There are two build strategies in `core/` and they differ exactly here.
 * `transpilePackage` walks `src` file by file, so every source file has a
 * matching `dist` file and no subpath can be missing. `Bun.build` bundles the
 * entrypoints it is given and emits nothing for the rest, so a subpath it does
 * not name has no `dist` file at all.
 */
export function buildableSubpaths(buildSource: string): string[] | null {
  if (/\btranspilePackage\s*\(/.test(buildSource))
    return null

  const block = buildSource.match(/entrypoints:\s*\[([^\]]*)\]/)?.[1] ?? ''
  return [...block.matchAll(/['"]([^'"]+)['"]/g)]
    .map(match => match[1]!.replace(/^\.\/src\//, '').replace(/\.ts$/, ''))
}

describe('core package subpaths', () => {
  const used = collectSubpaths(coreDir, collectSubpaths(join(frameworkDir, 'defaults'), collectSubpaths(join(repoRoot, 'docs'))))

  it('scans something', () => {
    // A regex that silently stopped matching would make every case below pass.
    expect(used.size).toBeGreaterThan(0)
  })

  for (const [pkg, subpaths] of [...used].sort((a, b) => a[0].localeCompare(b[0]))) {
    const buildPath = join(coreDir, pkg, 'build.ts')
    const entrypoints = buildableSubpaths(readFileSync(buildPath, 'utf8'))
    if (entrypoints === null)
      continue

    for (const subpath of [...subpaths].sort()) {
      // Only a subpath backed by a source file is this test's business. A name
      // that matches no file is a broken import, which is what
      // `buddy docs:snippets` and the compiler are for.
      const source = join(coreDir, pkg, 'src', `${subpath}.ts`)
      if (!existsSync(source))
        continue

      it(`@stacksjs/${pkg}/${subpath} is built`, () => {
        expect(entrypoints).toContain(subpath)
      })
    }
  }
})
