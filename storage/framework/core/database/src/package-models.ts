import { packageModelRoots as resolvePackageModelRoots } from '@stacksjs/config'

/**
 * The model directories that discovered packages contribute.
 *
 * The resolution itself lives in `@stacksjs/config`, which is the one package
 * both this and the auto-import barrel in `@stacksjs/server` can reach. Two
 * copies of the rule would eventually disagree about where a package is
 * installed, and the migration side and the globals side would then describe
 * different trees.
 *
 * Re-exported under the local name the callers here already use.
 */

/** One package's model directory. */
export interface PackageModelRoot {
  /** The package name, used to name the package in a collision error. */
  package: string
  /** Absolute path to the package's models directory. */
  dir: string
}

export function packageModelRoots(options: {
  manifestPath?: string
  projectRoot?: string
} = {}): PackageModelRoot[] {
  return resolvePackageModelRoots(options)
}
