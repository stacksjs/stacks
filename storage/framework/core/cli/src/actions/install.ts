import process from 'node:process'

interface InstallPackageOptions {
  cwd?: string
  dev?: boolean
  silent?: boolean
  packageManager?: string
  preferOffline?: boolean
  additionalArgs?: string[]
}

async function runInstall(name: string, options: InstallPackageOptions = { silent: true }): Promise<void> {
  const pm = options.packageManager ?? 'bun'
  const args: string[] = [pm === 'npm' ? 'install' : 'add']

  if (options.dev)
    args.push('-D')

  if (options.preferOffline && pm !== 'bun')
    args.push('--prefer-offline')

  if (options.additionalArgs)
    args.push(...options.additionalArgs)

  args.push(name)

  const proc = Bun.spawn([pm, ...args], {
    cwd: options.cwd ?? process.cwd(),
    stdout: options.silent ? 'ignore' : 'inherit',
    stderr: options.silent ? 'ignore' : 'inherit',
    stdin: 'ignore',
    env: process.env,
  })

  const exitCode = await proc.exited

  if (exitCode !== 0)
    throw new Error(`Failed to install ${name} (exit code ${exitCode})`)
}

/**
 * Install an npm package.
 *
 * @param name - The package name to install.
 * @param options - The options to pass to the install.
 * @returns The result of the install.
 */
export async function installPackage(name: string, options?: InstallPackageOptions): Promise<void> {
  return runInstall(name, options ?? { silent: true })
}

/**
 * Install a Stack into your project.
 *
 * @param name - The Stack name to install.
 * @param options - The options to pass to the install.
 * @returns The result of the install.
 */
export async function installStack(name: string, options?: InstallPackageOptions): Promise<void> {
  return runInstall(`@stacksjs/${name}`, options ?? { silent: true })
}
