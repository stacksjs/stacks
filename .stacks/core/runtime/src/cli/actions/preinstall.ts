import { consola, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { ExitCode, type PreinstallOptions } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'

export async function invoke(options?: PreinstallOptions) {
  try {
    consola.info('Preinstall check...')
    await spawn('npx only-allow pnpm', { stdio: debugLevel(options), cwd: projectPath() })
    consola.success('Environment ready.')
  }
  catch (error) {
    consola.error('There was an error preinstalling your stack.')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function preinstall(options: PreinstallOptions) {
  return invoke(options)
}
