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
export function packageViewRoots(options: PackageResourceOptions = {}): PackageResourceRoot[] {
  const manifestPath = options.manifestPath ?? path.storagePath('framework/discovered-packages.json')
  const projectRoot = options.projectRoot ?? path.projectPath()
  const exists = options.exists ?? existsSync

  const roots: PackageResourceRoot[] = []

  for (const [name, meta] of Object.entries(readManifest(manifestPath))) {
    const declared = meta?.views
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

  // Sorted by package so two packages contributing views resolve in the same
  // order on every machine, rather than by whatever order the manifest holds.
  return roots.sort((a, b) => a.package.localeCompare(b.package))
}
