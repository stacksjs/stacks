import type { AddOptions } from '@stacksjs/types'
import { runCommand } from './run'

/**
 * Install an npm package.
 *
 * @param pkg - The package name to install.
 * @returns The result of the install.
 */
export async function installPackage(pkg: string, options: AddOptions) {
  return runCommand(`pnpm install ${pkg}`, options)
}

/**
 * Install a Stack into your project.
 *
 * @param pkg - The Stack name to install.
 * @returns The result of the install.
 */
export async function installStack(name: string) {
  return runCommand(`pnpm install @stacksjs/${name}`)
}
