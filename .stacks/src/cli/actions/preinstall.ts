import { consola, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { ExitCode, type CliOptions as PreinstallOptions } from '@stacksjs/types'
import { debugLevel } from '@stacksjs/config'

export async function invoke(options?: PreinstallOptions) {
  try {
    consola.info('Preinstall check...')
    await spawn.async('npx only-allow pnpm', { stdio: debugLevel(options), cwd: projectPath() })
    consola.success('Environment ready.')
  }
  catch (error) {
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function generate(options: PreinstallOptions) {
  return invoke(options)
}
