import { log } from '@stacksjs/x-ray'
import { runNpmScript } from '@stacksjs/utils'
import { ExitCode, NpmScript, type PrepublishOptions } from '@stacksjs/types'

export async function invoke(options?: PrepublishOptions) {
  log.info('Running prepublish command...')
  const result = await runNpmScript(NpmScript.BuildStacks, options)

  if (result.isErr()) {
    log.error('There was an error prepublishing your stack', result.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Prepublishing completed')
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function prepublish(options: PrepublishOptions) {
  return invoke(options)
}
