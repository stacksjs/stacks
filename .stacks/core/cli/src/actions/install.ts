import { installPackage as installPkg } from '@antfu/install-pkg'
import type { CommandReturnValue } from '@stacksjs/types'

/**
 * Install an npm package.
 *
 * @param pkg - The package name to install.
 * @returns The result of the install.
 */
export async function installPackage(pkg: string): Promise<CommandReturnValue> {
  return await installPkg(pkg, { silent: true })
}

/**
 * Install a Stack into your project.
 *
 * @param pkg - The Stack name to install.
 * @returns The result of the install.
 */
export async function installStack(name: string): Promise<CommandReturnValue> {
  return await installPkg(`@stacksjs/${name}`, { silent: true })
}
