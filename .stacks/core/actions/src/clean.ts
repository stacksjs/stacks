import { log, runCommand } from '@stacksjs/cli'
import { type CleanOptions, ExitCode, NpmScript } from '@stacksjs/types'

export async function invoke(options?: CleanOptions) {
  log.info('Running clean command...')

  const result = await runCommand(NpmScript.Clean, options)

  if (result.isOk()) {
    log.success('Cleaned up')
    process.exit(ExitCode.Success)
  }

  log.error(result.error)
  process.exit(ExitCode.FatalError)
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function clean(options: CleanOptions) {
  return invoke(options)
}
