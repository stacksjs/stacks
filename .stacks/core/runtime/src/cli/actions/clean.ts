import { log, runCommand } from '@stacksjs/cli'
import type { CommandResult, Result } from '@stacksjs/types'
import { type CleanOptions, ExitCode } from '@stacksjs/types'

export async function invoke(options?: CleanOptions) {
  log.info('Running clean command...')

  const command = 'rimraf ./pnpm-lock.yaml ./node_modules/ ./.stacks/**/node_modules'
  const result = (await runCommand(command, options)) as Result<CommandResult<string>, Error>

  if (result.isOk()) {
    log.success('Cleaned up.')
    process.exit(ExitCode.Success)
  }

  log.error(result.error.message)

  // todo: log error (stack trace, etc.)
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
