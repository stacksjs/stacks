import { log } from '@stacksjs/logging'
import { runNpmScript } from '@stacksjs/utils'
import type { CliOptions as ReleaseOptions } from '@stacksjs/types'
import { ExitCode, NpmScript } from '@stacksjs/types'

export async function invoke(options: ReleaseOptions) {
  try {
    log.info('Releasing...')
    await runNpmScript(NpmScript.Release, options)
    log.success('Triggered release workflow')
  }
  catch (error) {
    log.error('There was an error releasing your stack.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function release(options: ReleaseOptions) {
  return invoke(options)
}
