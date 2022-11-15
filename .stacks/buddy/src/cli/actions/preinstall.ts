import { log, spawn } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { ExitCode, type PreinstallOptions } from '@stacksjs/types'
import { determineDebugMode } from '@stacksjs/config'

export async function invoke(options?: PreinstallOptions) {
  try {
    const stdio = determineDebugMode(options) ? 'inherit' : 'ignore'

    log.info('Preinstall check...')
    await spawn('npx only-allow pnpm', { stdio, cwd: projectPath() })
    log.success('Environment ready.')
  }
  catch (error) {
    log.error('There was an error pre-installing your stack.')
    log.error(error)
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
