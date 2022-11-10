import { installPackage as installPkg } from '@antfu/install-pkg'
import type { CommandResult } from 'stacks'

/**
 * Install an npm package.
 *
 * @param pkg - The package name to install.
 * @returns The result of the install.
 */
export async function installPackage(pkg: string): Promise<CommandResult<string>> {
  return await installPkg(pkg, { silent: true })
}

/**
 * Install a Stack into your project.
 *
 * @param pkg - The Stack name to install.
 * @returns The result of the install.
 */
export async function installStack(name: string): Promise<CommandResult<string>> {
  return await installPkg(`@stacksjs/${name}`, { silent: true })
}
