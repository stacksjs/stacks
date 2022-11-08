import { intro, log, outro, runCommand } from '@stacksjs/cli'
import type { CliOptions as FreshOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'

export async function invoke(options?: FreshOptions) {
  const perf = intro('stx fresh')
  const newOptions = { shouldBeAnimated: true, ...options }
  const result = await runCommand('pnpm run clean', newOptions, true)

  if (result.isErr()) {
    log.error('while running the fresh command, there was a cleaning issue', result.error)
    process.exit(ExitCode.FatalError)
  }

  // console.log('result is ', result.value.spinner)

  const r = result

  // .resource.spinner.succeed('Cleaned up the project.')

  const res = r.spinner.isSpinning
    ? await runCommand('pnpm install', options, true)
    : await runCommand('pnpm install', options)

  if (res.isOk()) {
    outro('Freshly reinstalled your dependencies.', { startTime: perf, useSeconds: true })
    process.exit(ExitCode.Success)
  }

  outro(res, { startTime: perf, useSeconds: true, isError: true })
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
