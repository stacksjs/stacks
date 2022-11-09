import { intro, outro, runCommands } from '@stacksjs/cli'
import type { CliOptions as FreshOptions } from '@stacksjs/types'

export async function invoke(options?: FreshOptions) {
  const perf = intro('stx fresh')
  await runCommands(['pnpm run clean', 'pnpm install'], options)
  outro('Freshly reinstalled your dependencies.', { startTime: perf, useSeconds: true })

  // if (results.isOk()) {
  //   outro('Freshly reinstalled your dependencies.', { startTime: perf, useSeconds: true })
  //   process.exit(ExitCode.Success)
  // }

  // if (results.isErr()) {
  //   outro('while running the fresh command, there was a cleaning issue', { startTime: perf, useSeconds: true, isError: true })
  //   handleError(results.error, 'while running the fresh command, there was a cleaning issue')
  //   process.exit(ExitCode.FatalError)
  // }
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function fresh(options: FreshOptions) {
  return invoke(options)
}
