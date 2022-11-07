import { consola, runShortLivedCommand } from '@stacksjs/cli'
import type { CommandResult, Result } from '@stacksjs/types'
import { type CleanOptions, ExitCode } from '@stacksjs/types'

export async function invoke(options?: CleanOptions) {
  consola.info('Running clean command...')
  const result = await runShortLivedCommand('rimraf ./pnpm-lock.yaml ./node_modules/ ./.stacks/**/node_modules', options) as Result<CommandResult<string>, Error>

  if (result.isOk()) {
    consola.success('Cleaned up.')
    process.exit(ExitCode.Success)
  }

  consola.error('Failed to clean up.', result.error.message)

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
