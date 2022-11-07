import { log } from '@stacksjs/logging'
import { runNpmScript } from '@stacksjs/utils'
import { ExitCode, NpmScript, type PrepublishOptions } from '@stacksjs/types'

export async function invoke(options?: PrepublishOptions) {
  try {
    log.info('Running prepublish command...')
    await runNpmScript(NpmScript.BuildStacks, options)
    log.success('prepublish command completed.')
  }
  catch (error) {
    log.error('There was an error prepublish your stack.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function prepublish(options: PrepublishOptions) {
  return invoke(options)
}
