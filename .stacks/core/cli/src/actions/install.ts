import { installPackage as installPkg } from '@antfu/install-pkg'

interface InstallPackageOptions {
  cwd?: string
  dev?: boolean
  silent?: boolean
  packageManager?: string
  packageManagerVersion?: string
  preferOffline?: boolean
  additionalArgs?: string[]
}

/**
 * Install an npm package.
 *
 * @param pkg - The package name to install.
 * @param pkg - The options to pass to the install.The options to pass to the install.
 * @returns The result of the install.
 */
export async function installPackage(pkg: string, options?: InstallPackageOptions) {
  if (options)
    return await installPkg(pkg, options)

  return await installPkg(pkg, { silent: true })
}

/**
 * Install a Stack into your project.
 *
 * @param pkg - The Stack name to install.
 * @param options - The options to pass to the install.
 * @returns The result of the install.
 */
export async function installStack(name: string, options?: InstallPackageOptions) {
  if (options)
    return await installPkg(`@stacksjs/${name}`, options)

  return await installPkg(`@stacksjs/${name}`, { silent: true })
}
