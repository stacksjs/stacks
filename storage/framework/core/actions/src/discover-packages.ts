import type { StackDirectory } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { projectPath, storagePath } from '@stacksjs/path'

/**
 * Find the installed packages that extend this application.
 *
 * Stacks' answer to Laravel's package auto-discovery: a package declares a
 * `stacks` key in its package.json, and the framework registers what it brings
 * without the application wiring anything up.
 *
 * Two roots are searched, in this order:
 *
 *   `node_modules/`  where a package manager puts what an application asked
 *                    for, so this is the one that matters for `bun add loghq`.
 *                    Only DIRECT dependencies are considered, read from the
 *                    application's own package.json. A transitive dependency
 *                    has no business injecting models or routes into an app
 *                    that never named it, and walking the whole tree would
 *                    mean reading thousands of manifests on every boot.
 *
 *   `pantry/`        this repository's own package tree, and the root the
 *                    scan was originally written against. Globbed rather than
 *                    read from dependencies, because it is a small tree that
 *                    is not always reflected in a package.json.
 *
 * A package found in both is taken from `node_modules`, and its other location
 * is reported in {@link DiscoveredPackagesManifest.shadowed} rather than
 * silently dropped: the two copies are frequently different versions, and
 * which one won is the first thing worth knowing when a package misbehaves.
 */

export interface PackageStacksMeta {
  providers?: string[]
  routes?: string[]
  views?: string[]
  components?: string[]
  commands?: string[]
  middleware?: string[]
  migrations?: string[]
  /** Stack extension name (identifies this as a full Stack extension) */
  name?: string
  /** Stack extension description */
  description?: string
  /** Which top-level directories this stack provides */
  directories?: StackDirectory[]
  /** Prefix applied to every route file this package registers. */
  routePrefix?: string
  /** Middleware applied to every route file this package registers. */
  routeMiddleware?: string | string[]
  /**
   * Where the package is installed, relative to the project root.
   *
   * Written by discovery, not by the package. Consumers resolve the package's
   * files against this instead of assuming a root: before it existed the
   * router hardcoded `pantry/<name>`, which is the wrong directory for
   * anything a package manager installed.
   *
   * Relative because this manifest is committed, and an absolute path would
   * be a machine-specific diff on every boot.
   */
  root?: string
}

/** A package that was found in more than one root. */
export interface ShadowedPackage {
  name: string
  /** The root discovery used, relative to the project. */
  used: string
  /** The root it ignored, relative to the project. */
  ignored: string
}

export interface DiscoveredPackagesManifest {
  generated_at: string
  packages: Record<string, PackageStacksMeta>
  /** Packages present in more than one root. Omitted when there are none. */
  shadowed?: ShadowedPackage[]
}

export interface DiscoverPackagesOptions {
  /** Project root to scan. Defaults to the real project. */
  projectRoot?: string
  /** Where to write the manifest. Defaults to `storage/framework/discovered-packages.json`. */
  manifestPath?: string
  /** Skip the write and just return what was found. */
  dryRun?: boolean
}

/** A package.json that declares a `stacks` object, and where it was found. */
interface Candidate {
  name: string
  meta: PackageStacksMeta
  /** Absolute directory holding the package. */
  dir: string
}

async function readManifest(file: string): Promise<{ name?: string, stacks?: unknown } | null> {
  try {
    return await Bun.file(file).json()
  }
  catch {
    // A package.json that is missing, unreadable or not JSON is not a
    // discovery failure. Nothing in the tree is required to be a stack.
    return null
  }
}

/** Direct dependency names from the application's own package.json. */
async function directDependencies(projectRoot: string): Promise<string[]> {
  const pkg = await readManifest(join(projectRoot, 'package.json')) as Record<string, unknown> | null
  if (!pkg)
    return []

  const names = new Set<string>()
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    const block = pkg[field]
    if (block && typeof block === 'object') {
      for (const name of Object.keys(block as Record<string, unknown>)) names.add(name)
    }
  }
  return [...names].sort()
}

/** Candidates from `node_modules`, limited to the application's direct dependencies. */
async function fromNodeModules(projectRoot: string): Promise<Candidate[]> {
  const root = join(projectRoot, 'node_modules')
  if (!existsSync(root))
    return []

  const out: Candidate[] = []
  for (const name of await directDependencies(projectRoot)) {
    const dir = join(root, name)
    const pkg = await readManifest(join(dir, 'package.json'))
    if (!pkg?.name || !pkg.stacks || typeof pkg.stacks !== 'object')
      continue
    out.push({ name: pkg.name, meta: pkg.stacks as PackageStacksMeta, dir })
  }
  return out
}

/** Candidates from the `pantry` tree, globbed as the original scan did. */
async function fromPantry(projectRoot: string): Promise<Candidate[]> {
  const root = join(projectRoot, 'pantry')
  if (!existsSync(root))
    return []

  const out: Candidate[] = []
  for (const pattern of ['*/package.json', '@*/*/package.json']) {
    const glob = new Bun.Glob(pattern)
    for await (const file of glob.scan({ cwd: root, absolute: true, onlyFiles: true })) {
      const pkg = await readManifest(file)
      if (!pkg?.name || !pkg.stacks || typeof pkg.stacks !== 'object')
        continue
      out.push({ name: pkg.name, meta: pkg.stacks as PackageStacksMeta, dir: join(file, '..') })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** The application's `stacks["dont-discover"]` opt-out list. */
async function dontDiscover(projectRoot: string): Promise<Set<string>> {
  const pkg = await readManifest(join(projectRoot, 'package.json')) as Record<string, any> | null
  const list = pkg?.stacks?.['dont-discover']
  return new Set<string>(Array.isArray(list) ? list : [])
}

export async function discoverPackages(
  options: DiscoverPackagesOptions = {},
): Promise<DiscoveredPackagesManifest> {
  const projectRoot = options.projectRoot ?? projectPath()
  const manifestPath = options.manifestPath ?? storagePath('framework/discovered-packages.json')

  const excluded = await dontDiscover(projectRoot)

  // node_modules first, so a package an application actually depends on wins
  // over a copy sitting in the pantry tree.
  const found = [...await fromNodeModules(projectRoot), ...await fromPantry(projectRoot)]

  const packages: Record<string, PackageStacksMeta> = {}
  const shadowed: ShadowedPackage[] = []
  const chosen = new Map<string, string>()

  for (const candidate of found) {
    if (excluded.has(candidate.name))
      continue

    const root = toRelative(projectRoot, candidate.dir)
    const already = chosen.get(candidate.name)
    if (already !== undefined) {
      shadowed.push({ name: candidate.name, used: already, ignored: root })
      continue
    }

    chosen.set(candidate.name, root)
    packages[candidate.name] = { ...candidate.meta, root }
  }

  const manifest: DiscoveredPackagesManifest = {
    generated_at: new Date().toISOString(),
    packages,
    ...(shadowed.length > 0 ? { shadowed } : {}),
  }

  if (options.dryRun)
    return manifest

  // Rewrite only on a real change. `generated_at` moves on every run, so
  // comparing whole manifests would dirty a committed file on every boot.
  try {
    const current = await Bun.file(manifestPath).json() as DiscoveredPackagesManifest
    if (JSON.stringify(current.packages ?? {}) === JSON.stringify(manifest.packages)
      && JSON.stringify(current.shadowed ?? []) === JSON.stringify(shadowed)) {
      return current
    }
  }
  catch {
    // Missing or unreadable manifests are regenerated below.
  }

  await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  return manifest
}

function toRelative(projectRoot: string, dir: string): string {
  const rel = relative(projectRoot, dir)
  // A package resolved outside the project (a linked checkout, say) has no
  // meaningful relative form; keep what we were given so it still resolves.
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : dir
}
