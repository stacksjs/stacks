/**
 * Every subpath a package imports must be exported by the LOWEST version its
 * declared range admits.
 *
 * `@stacksjs/mobile` imports `craft-native/mobile` and `@stacksjs/actions`
 * imports `craft-native/android`, while both declared ranges resolved to
 * versions of craft-native whose only export was `.`. Inside this repo it
 * looked fine — a local checkout, a nested install and a pantry copy all
 * happened to provide the subpath — so nothing caught it until an app
 * installed the published package and got `Cannot find module
 * 'craft-native/mobile'`, and CI typechecked red on main for four commits.
 * stacksjs/stacks#2322.
 *
 * The check is deliberately about the DECLARED RANGE rather than about what is
 * installed here. What is installed here is exactly what hid the bug: a range
 * can promise a version that cannot work while the local tree quietly resolves
 * something newer. So this asks the registry what the range actually admits,
 * and fails when the floor of that range does not export the subpath.
 *
 * Caret ranges on a `0.0.x` package are worth knowing about: `^0.0.67` admits
 * only 0.0.67, so a caret there is an exact pin and its floor is its ceiling.
 *
 * Run: `bun .github/scripts/check-subpath-exports.ts`
 */

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

export interface SubpathUse {
  /** The package the subpath belongs to, e.g. `craft-native`. */
  pkg: string
  /** The subpath, in `exports` form, e.g. `./mobile`. */
  subpath: string
  /** The workspace package whose source imports it. */
  importer: string
  /** Repo-relative file it was imported from. */
  file: string
}

/**
 * Split an import specifier into its package and `exports`-style subpath.
 *
 * Returns null for anything that is not an external subpath import: relative
 * and absolute paths, builtins, and a bare package name (which resolves to
 * `.`, an export every package has).
 */
export function splitSubpathImport(specifier: string): { pkg: string, subpath: string } | null {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('~'))
    return null
  if (specifier.startsWith('node:') || specifier.startsWith('bun:') || specifier === 'bun')
    return null

  const parts = specifier.split('/')
  const nameLength = specifier.startsWith('@') ? 2 : 1
  if (parts.length <= nameLength)
    return null

  return {
    pkg: parts.slice(0, nameLength).join('/'),
    subpath: `./${parts.slice(nameLength).join('/')}`,
  }
}

/**
 * Does `exports` publish `subpath`?
 *
 * Wildcards count: a package declaring `"./*"` answers for every subpath, and
 * `"./api/*"` answers for `./api/mobile`. That is how `@stacksjs/*` packages
 * publish their whole dist, and treating those as misses would make the check
 * useless on our own packages.
 */
export function exportsSubpath(exportsField: unknown, subpath: string): boolean {
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField))
    return false

  const keys = Object.keys(exportsField as Record<string, unknown>)

  // A conditions-only exports object (`{ import, require }`) publishes `.` alone.
  if (!keys.some(key => key.startsWith('.')))
    return subpath === '.'

  for (const key of keys) {
    if (key === subpath)
      return true
    if (!key.includes('*'))
      continue

    const [prefix, suffix = ''] = key.split('*')
    if (subpath.startsWith(prefix) && subpath.endsWith(suffix) && subpath.length >= prefix.length + suffix.length)
      return true
  }

  return false
}

/** The lowest published version satisfying `range`, or null when none does. */
export function lowestSatisfying(versions: readonly string[], range: string): string | null {
  const ordered = [...versions].sort((a, b) => (Bun.semver.order(a, b)))
  return ordered.find(version => Bun.semver.satisfies(version, range)) ?? null
}

/**
 * Which manifest to check a range against.
 *
 * Normally the lowest PUBLISHED version the range admits: that is the one a
 * consumer can actually be resolved onto, and the whole point of this script.
 *
 * A release lands its version bump as a commit and publishes minutes later,
 * though, and in that window no published version satisfies any internal
 * range. Calling that a broken tree failed CI on six separate releases in one
 * day for something no diff caused. When the sibling's own version in this
 * repo satisfies the range, the range is describing the release in flight, and
 * its source is exactly what is about to be published - so check that.
 *
 * Anything else unsatisfiable is still a real failure.
 */
export function resolveTarget(
  range: string,
  publishedVersions: readonly string[],
  localVersion?: string,
): { source: 'published' | 'releasing', version: string } | null {
  const floor = lowestSatisfying(publishedVersions, range)
  if (floor)
    return { source: 'published', version: floor }

  if (localVersion && Bun.semver.satisfies(localVersion, range))
    return { source: 'releasing', version: localVersion }

  return null
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir))
    return out

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'tests', 'test', '__tests__'].includes(entry.name))
        continue
      sourceFiles(path, out)
    }
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(path)
    }
  }

  return out
}

async function main(): Promise<void> {
  const root = process.cwd()
  const coreDir = join(root, 'storage/framework/core')
  const transpiler = new Bun.Transpiler({ loader: 'ts' })

  const uses: SubpathUse[] = []
  const rangesByImporter = new Map<string, Map<string, string>>()
  /** Sibling manifests in this repo, by package name. */
  const localManifests = new Map<string, { version?: string, exports?: unknown }>()

  for (const entry of readdirSync(coreDir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue

    const pkgDir = join(coreDir, entry.name)
    const manifestPath = join(pkgDir, 'package.json')
    if (!existsSync(manifestPath))
      continue

    const manifest = await Bun.file(manifestPath).json()
    if (!manifest.name || manifest.private)
      continue

    localManifests.set(manifest.name, manifest)
    rangesByImporter.set(manifest.name, new Map(Object.entries({
      ...(manifest.dependencies ?? {}),
      ...(manifest.peerDependencies ?? {}),
      ...(manifest.optionalDependencies ?? {}),
    } as Record<string, string>)))

    for (const file of sourceFiles(join(pkgDir, 'src'))) {
      let imports
      try {
        imports = transpiler.scanImports(await Bun.file(file).text())
      }
      catch {
        continue
      }

      for (const imported of imports) {
        const split = splitSubpathImport(imported.path)
        if (!split || split.pkg === manifest.name)
          continue

        uses.push({ ...split, importer: manifest.name, file: file.slice(root.length + 1) })
      }
    }
  }

  const registry = new Map<string, any>()
  const failures: string[] = []
  const skipped: string[] = []

  for (const use of uses) {
    const range = rangesByImporter.get(use.importer)?.get(use.pkg)

    // An undeclared dependency is a different check's problem
    // (tests/declared-dependencies.test.ts), and reporting it twice would make
    // both reports noisier without making either more actionable.
    if (!range)
      continue

    // A workspace sibling is checked from its source in this repo, not from
    // the registry: its published exports are built from what is here.
    if (range.startsWith('workspace:'))
      continue

    if (!registry.has(use.pkg)) {
      const response = await fetch(`https://registry.npmjs.org/${use.pkg}`)
      registry.set(use.pkg, response.ok ? await response.json() : null)
    }

    const packument = registry.get(use.pkg)
    if (!packument) {
      skipped.push(`${use.pkg} (not on the public registry)`)
      continue
    }

    const releasing = localManifests.get(use.pkg)
    const target = resolveTarget(range, Object.keys(packument.versions ?? {}), releasing?.version)
    if (!target) {
      failures.push(`${use.importer} declares ${use.pkg}@${range}, which no published version satisfies (${use.file})`)
      continue
    }

    if (target.source === 'releasing') {
      if (!exportsSubpath(releasing?.exports, use.subpath)) {
        failures.push(
          `${use.importer} imports ${use.pkg}${use.subpath.slice(1)} but ${use.pkg}@${target.version} `
          + `(unpublished, in this repo) does not export ${use.subpath} (${use.file})`,
        )
      }
      continue
    }

    const floor = target.version
    if (!exportsSubpath(packument.versions[floor]?.exports, use.subpath)) {
      failures.push(
        `${use.importer} imports ${use.pkg}${use.subpath.slice(1)} but declares ${use.pkg}@${range}, `
        + `whose lowest published match ${use.pkg}@${floor} does not export ${use.subpath} (${use.file})`,
      )
    }
  }

  for (const note of [...new Set(skipped)].sort())
    console.log(`skipped: ${note}`)

  if (failures.length === 0) {
    console.log(`✓ every subpath import is exported by the floor of its declared range (${uses.length} checked)`)
    return
  }

  console.error('\nSubpath imports a declared range cannot satisfy:\n')
  for (const failure of [...new Set(failures)].sort())
    console.error(`  ✗ ${failure}`)
  console.error('\nRaise the range to the first version that exports the subpath.\n')
  process.exit(1)
}

if (import.meta.main)
  await main()
