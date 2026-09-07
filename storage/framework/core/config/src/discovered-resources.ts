import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { path } from '@stacksjs/path'

/**
 * The view directories that discovered packages contribute.
 *
 * A package declaring a `stacks` key already has its route files registered by
 * the router. This is the same idea for templates, so a package can ship the
 * pages that its routes render rather than asking the application to copy them
 * in.
 *
 * The manifest is READ, not imported. `discoverPackages()` lives in
 * `@stacksjs/actions`, which depends on this package, so importing it here
 * would close a cycle. The router and the model resolver both read the same
 * file for the same reason.
 */

/** One directory a discovered package contributes. */
export interface PackageResourceRoot {
  /** The package that declared it, so a bad path can be attributed. */
  package: string
  /** Absolute directory. */
  dir: string
}

interface DiscoveredEntry {
  root?: string
  views?: string | string[]
  migrations?: string | string[]
  components?: string | string[]
}

/**
 * Directories a package is taken to provide when it declares no explicit list.
 *
 * `components` is deliberately absent, which makes it the one opt-in surface.
 * The others are namespaced at the point of use - a view is reached by its
 * path, a model by its name, a migration by its filename - and a package
 * contributing one it did not mean to is inert until something asks for it.
 * Components are reached by BARE TAG NAME across every template in the process,
 * so implying `resources/components` would enrol any package that happens to
 * have that directory into global tag resolution. A package has to say
 * `"components": [...]` and mean it.
 */
const IMPLIED_DIRS: Record<string, readonly string[] | undefined> = {
  views: ['resources/views'],
  models: ['app/Models'],
  migrations: ['database/migrations'],
}

export interface PackageResourceOptions {
  manifestPath?: string
  projectRoot?: string
  exists?: (candidate: string) => boolean
}

/**
 * Read the discovery manifest.
 *
 * Every failure degrades to "no packages". A missing manifest is the normal
 * state of an application that has never run discovery, and an unreadable one
 * is not a reason to refuse to serve the application's own views.
 */
function readManifest(manifestPath: string): Record<string, DiscoveredEntry> {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      packages?: Record<string, DiscoveredEntry>
    }
    return parsed?.packages ?? {}
  }
  catch {
    return {}
  }
}

/**
 * Resolve each discovered package's declared view directories.
 *
 * A package's `root` is recorded relative to the project, so the committed
 * manifest carries no machine-specific path. An absolute root is honoured as
 * written, which is what a manifest built inside a test holds.
 *
 * A declared directory that is not on disk is skipped rather than fatal: stx
 * would glob it and find nothing anyway, just more slowly, and a package
 * shipping an optional subtree is not an error.
 */
function resourceRoots(
  field: 'views' | 'models' | 'migrations' | 'components',
  options: PackageResourceOptions = {},
): PackageResourceRoot[] {
  const manifestPath = options.manifestPath ?? path.storagePath('framework/discovered-packages.json')
  const projectRoot = options.projectRoot ?? path.projectPath()
  const exists = options.exists ?? existsSync

  const roots: PackageResourceRoot[] = []

  for (const [name, meta] of Object.entries(readManifest(manifestPath))) {
    // Models have no manifest key of their own, so a package that ships them
    // is taken to put them where every Stacks application does. Views keep
    // their explicit key, which a package uses to ship more than one subtree.
    // Components have no implied directory at all, so a package that does not
    // declare them contributes none - see IMPLIED_DIRS.
    const declared = (meta as Record<string, unknown>)?.[field] ?? IMPLIED_DIRS[field]
    if (!declared)
      continue

    const root = meta.root
    if (!root || typeof root !== 'string')
      continue

    const base = isAbsolute(root) ? root : join(projectRoot, root)

    for (const entry of Array.isArray(declared) ? declared : [declared]) {
      if (typeof entry !== 'string' || !entry)
        continue

      // A leading slash or a `..` segment would escape the package and
      // register a directory the application never installed. The same guard
      // `resolveViewPatterns` applies to the framework's own default subtrees.
      const cleaned = entry.replace(/^[/\\]+/, '')
      if (!cleaned || cleaned.split(/[/\\]/).includes('..'))
        continue

      const dir = join(base, cleaned)
      if (exists(dir))
        roots.push({ package: name, dir })
    }
  }

  // Sorted by package so two packages contributing the same kind of directory
  // resolve in the same order on every machine, rather than by manifest order.
  return roots.sort((a, b) => a.package.localeCompare(b.package))
}

/**
 * Migration directories each discovered package contributes.
 *
 * These are read, never written. The migration runner deletes and rewrites
 * files in the corpus it runs - SQLite preprocessing drops statements it
 * cannot execute and prunes duplicate CREATEs - so a package's own directory
 * is copied out of before any of that happens. Doing otherwise would have the
 * framework mutating an installed package's files, which a reinstall silently
 * undoes.
 */
export function packageMigrationRoots(options: PackageResourceOptions = {}): PackageResourceRoot[] {
  return resourceRoots('migrations', options)
}

/**
 * Component directories each discovered package contributes.
 *
 * Opt-in, unlike every other surface here: a package contributes components
 * only by declaring `"components"` in its `stacks` key. Components resolve by
 * bare tag name across every template in the process, so a directory picked up
 * by convention would silently enter that namespace.
 *
 * The caller decides precedence. Placing these AFTER the framework's own
 * component directories makes a package purely additive, which is what the
 * shipped stx plugin does - stx searches its component list in order and takes
 * the first match.
 */
export function packageComponentRoots(options: PackageResourceOptions = {}): PackageResourceRoot[] {
  return resourceRoots('components', options)
}

/** View directories each discovered package contributes. */
export function packageViewRoots(options: PackageResourceOptions = {}): PackageResourceRoot[] {
  return resourceRoots('views', options)
}

/**
 * Model directories each discovered package contributes.
 *
 * One reader rather than one per consumer. The migration side and the
 * auto-import barrel both need this answer, and they are in different packages;
 * two copies of the resolution rule would eventually disagree about where a
 * package lives, and routes and models would then point at different trees.
 */
export function packageModelRoots(options: PackageResourceOptions = {}): PackageResourceRoot[] {
  return resourceRoots('models', options)
}
