import { intro, outro, runCommand, runShortLivedCommand } from '@stacksjs/cli'
import type { CliOptions as FreshOptions, SpinnerOptions as Spinner } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'

export async function invoke(options?: FreshOptions) {
  const perf = intro('stx fresh', { showPerformance: true })
  const spinner = runShortLivedCommand('pnpm run clean', { loadingAnimation: true, ...options }, true)

  const result = (spinner as Spinner)?.isSpinning
    ? runCommand('pnpm install', { loadingAnimation: spinner as Spinner, ...options })
    : runCommand('pnpm install', options)
  const res = await result

  if (res.isOk()) {
    outro('Freshly reinstalled your dependencies.', { startTime: perf, useSeconds: true })
    process.exit(ExitCode.Success)
  }

  outro(res.error.message, { startTime: perf, useSeconds: true, isError: true })
  process.exit(ExitCode.FatalError)
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function fresh(options: FreshOptions) {
  return invoke(options)
}
