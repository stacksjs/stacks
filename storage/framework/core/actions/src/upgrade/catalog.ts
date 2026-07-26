import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Bun's `catalog:` protocol resolves a dependency's version from a catalog
 * declared on the *workspace root* manifest. The stacks monorepo declares that
 * catalog in its own root `package.json`, but a vendored app only receives the
 * `storage/framework/**` workspace members — so every `"catalog:"` reference
 * those members carry would fail to resolve against a userland root that has
 * never heard of the catalog.
 *
 * `buddy update` therefore mirrors the upstream catalog into the app root as
 * part of the sync. We copy only the entries the vendored tree actually
 * references, and never touch catalog entries the user added themselves.
 */

const CATALOG_PROTOCOL = 'catalog:'

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

/** Directories that never contain first-party workspace manifests. */
const MANIFEST_SCAN_SKIP = new Set(['node_modules', 'dist', '.git', '.cache', 'cache'])

export interface PackageManifest {
  catalog?: Record<string, string>
  workspaces?: string[] | { catalog?: Record<string, string> }
  [field: string]: unknown
}

export interface CatalogMergeResult {
  /** The merged catalog, ready to write to the root manifest. */
  catalog: Record<string, string>
  /** Entries newly introduced to the root manifest. */
  added: string[]
  /** Entries whose version moved to match upstream. */
  updated: string[]
  /** Referenced by the vendored tree but absent upstream — unresolvable. */
  missing: string[]
}

/**
 * Every dependency name a manifest pins to `catalog:`.
 *
 * Bun also accepts the named form (`catalog:react19`); those resolve from a
 * separate `catalogs` map rather than the default catalog, so we deliberately
 * match only the bare default protocol here.
 */
export function collectCatalogReferences(manifests: PackageManifest[]): string[] {
  const names = new Set<string>()

  for (const manifest of manifests) {
    for (const field of DEPENDENCY_FIELDS) {
      const deps = manifest[field]
      if (!deps || typeof deps !== 'object') continue

      for (const [name, range] of Object.entries(deps as Record<string, unknown>)) {
        if (range === CATALOG_PROTOCOL)
          names.add(name)
      }
    }
  }

  return [...names].sort()
}

/**
 * Read a catalog off a manifest, accepting either shape Bun supports: a
 * top-level `catalog` field, or `workspaces.catalog` on the object form.
 */
export function readCatalogField(manifest: PackageManifest | null | undefined): Record<string, string> {
  if (!manifest) return {}

  if (manifest.catalog && typeof manifest.catalog === 'object')
    return { ...manifest.catalog }

  const workspaces = manifest.workspaces
  if (workspaces && !Array.isArray(workspaces) && workspaces.catalog)
    return { ...workspaces.catalog }

  return {}
}

/**
 * Merge the upstream catalog into the app's own, restricted to what the
 * vendored tree references.
 *
 * User-authored entries survive untouched: we only write keys that appear in
 * `referenced`, so a catalog entry the app added for its own packages is never
 * clobbered by an upgrade.
 */
export function mergeCatalog(
  current: Record<string, string>,
  upstream: Record<string, string>,
  referenced: string[],
): CatalogMergeResult {
  const catalog = { ...current }
  const added: string[] = []
  const updated: string[] = []
  const missing: string[] = []

  for (const name of referenced) {
    const version = upstream[name]
    if (!version) {
      // Referenced but unresolvable. Leave any existing entry in place — a
      // stale pin still installs, while dropping it guarantees a hard failure.
      if (!(name in catalog))
        missing.push(name)
      continue
    }

    if (!(name in catalog)) {
      catalog[name] = version
      added.push(name)
      continue
    }

    if (catalog[name] !== version) {
      catalog[name] = version
      updated.push(name)
    }
  }

  return { catalog: sortKeys(catalog), added, updated, missing }
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
}

/** Parse a `package.json`, returning null rather than throwing on bad input. */
export function readManifest(path: string): PackageManifest | null {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8')) as PackageManifest
  }
  catch {
    return null
  }
}

/**
 * Walk a synced tree for workspace manifests. Depth is bounded because the
 * framework nests packages at most a few levels deep, and an unbounded walk
 * over a vendored tree is needlessly expensive on every upgrade.
 */
export function findWorkspaceManifests(root: string, maxDepth = 4): string[] {
  const found: string[] = []

  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth || !existsSync(dir)) return

    const manifest = join(dir, 'package.json')
    if (existsSync(manifest)) found.push(manifest)

    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    }
    catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.') || MANIFEST_SCAN_SKIP.has(entry.name)) continue
      walk(join(dir, entry.name), depth + 1)
    }
  }

  walk(root, 0)
  return found
}

/**
 * Fetch the upstream catalog for a GitHub-sourced upgrade.
 *
 * We hit the raw root manifest directly rather than re-downloading a tarball
 * we've already extracted the interesting parts of. Failure is non-fatal: the
 * caller falls back to leaving the existing catalog alone.
 */
export async function fetchUpstreamCatalog(ref: string): Promise<Record<string, string>> {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/stacksjs/stacks/${ref}/package.json`)
    if (!response.ok) return {}
    return readCatalogField(await response.json() as PackageManifest)
  }
  catch {
    return {}
  }
}

export interface ReconcileCatalogOptions {
  /** The app root — where the catalog must live for Bun to resolve it. */
  projectRoot: string
  /** The synced framework tree to scan for `catalog:` references. */
  frameworkRoot: string
  /** Local stacks checkout, when upgrading with `--from`. */
  localStacksRoot?: string | null
  /** Git ref, when upgrading from GitHub. */
  ref?: string
}

/**
 * Mirror the upstream catalog into the app's root manifest so the vendored
 * workspace members resolve. Returns null when there is nothing to do.
 */
export async function reconcileWorkspaceCatalog(
  options: ReconcileCatalogOptions,
): Promise<CatalogMergeResult | null> {
  const rootManifestPath = join(options.projectRoot, 'package.json')
  const rootManifest = readManifest(rootManifestPath)
  if (!rootManifest) return null

  const manifests = findWorkspaceManifests(options.frameworkRoot)
    .map(readManifest)
    .filter((manifest): manifest is PackageManifest => manifest !== null)

  const referenced = collectCatalogReferences(manifests)
  if (referenced.length === 0) return null

  const upstream = options.localStacksRoot
    ? readCatalogField(readManifest(join(options.localStacksRoot, 'package.json')))
    : await fetchUpstreamCatalog(options.ref || 'main')

  const result = mergeCatalog(readCatalogField(rootManifest), upstream, referenced)
  if (result.added.length === 0 && result.updated.length === 0)
    return result

  // Write through the top-level `catalog` field, matching upstream's shape.
  // `workspaces` stays an array so we don't rewrite the app's globs.
  rootManifest.catalog = result.catalog
  await Bun.write(rootManifestPath, `${JSON.stringify(rootManifest, null, 2)}\n`)

  return result
}
