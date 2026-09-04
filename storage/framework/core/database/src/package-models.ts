import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { path } from '@stacksjs/path'

/**
 * The model directories that discovered packages contribute.
 *
 * A package that declares a `stacks` key in its package.json can ship models
 * the way it already ships routes, so `bun add loghq` brings LogHQ's schema
 * with it rather than asking the application to copy files in.
 *
 * The manifest is READ, not imported. `discoverPackages()` lives in
 * `@stacksjs/actions`, which depends on this package, so importing it here
 * would close a cycle. The router resolves package routes the same way, from
 * the same file, for the same reason.
 */

/** One package's model directory. */
export interface PackageModelRoot {
  /** The package name, used to name the package in a collision error. */
  package: string
  /** Absolute path to the package's `app/Models`. */
  dir: string
}

interface DiscoveredEntry {
  root?: string
  directories?: string[]
}

/**
 * Read the discovery manifest.
 *
 * Every failure here degrades to "no packages": a missing manifest is the
 * normal state of an application that has never run discovery, and an
 * unreadable one is not a reason to refuse to generate migrations from the
 * models the application does have.
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
 * Resolve each discovered package's `app/Models`, skipping those that ship none.
 *
 * A package's `root` is recorded relative to the project so the committed
 * manifest carries no machine-specific path. An absolute root is honoured
 * anyway rather than joined onto the project, since that is what a manifest
 * written by hand during a test is likely to hold.
 */
export function packageModelRoots(options: {
  manifestPath?: string
  projectRoot?: string
} = {}): PackageModelRoot[] {
  const manifestPath = options.manifestPath ?? path.storagePath('framework/discovered-packages.json')
  const projectRoot = options.projectRoot ?? path.projectPath()

  const roots: PackageModelRoot[] = []

  for (const [name, meta] of Object.entries(readManifest(manifestPath))) {
    const root = meta?.root
    if (!root || typeof root !== 'string')
      continue

    const base = isAbsolute(root) ? root : join(projectRoot, root)
    const dir = join(base, 'app', 'Models')
    if (existsSync(dir))
      roots.push({ package: name, dir })
  }

  // Sorted so a collision between two packages is reported the same way on
  // every machine, rather than depending on manifest key order.
  return roots.sort((a, b) => a.package.localeCompare(b.package))
}
