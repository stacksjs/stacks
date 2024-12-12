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

// TODO: improve return types here

/**
 * Install an npm package.
 *
 * @param name - The package name to install.
 * @param options - The options to pass to the install.The options to pass to the install.
 * @returns The result of the install.
 */
export async function installPackage(name: string, options?: InstallPackageOptions): Promise<any> {
  if (options)
    return await installPkg(name, options)

  return await installPkg(name, { silent: true })
}

/**
 * Install a Stack into your project.
 *
 * @param name - The Stack name to install.
 * @param options - The options to pass to the install.
 * @returns The result of the install.
 */
export async function installStack(name: string, options?: InstallPackageOptions): Promise<any> {
  if (options)
    return await installPkg(`@stacksjs/${name}`, options)

  return await installPkg(`@stacksjs/${name}`, { silent: true })
}
