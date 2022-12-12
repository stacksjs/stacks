import { intro, outro, runCommands } from '@stacksjs/cli'
import type { CliOptions as FreshOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'

export async function invoke(options?: FreshOptions) {
  const perf = intro('buddy fresh')
  const results = await runCommands(['pnpm run clean', 'pnpm install'], options)

  for (const result of results) {
    if (result.isErr()) {
      outro('While running the fresh command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      process.exit(ExitCode.FatalError)
    }
  }

  outro('Freshly reinstalled your dependencies.', { startTime: perf, useSeconds: true })
  process.exit(ExitCode.Success)
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function fresh(options: FreshOptions) {
  return invoke(options)
}
