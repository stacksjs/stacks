import { intro, log, outro } from '@stacksjs/cli'
import { runAction } from '@stacksjs/actions'
import type { CliOptions as ReleaseOptions } from '@stacksjs/types'
import { ExitCode, NpmScript } from '@stacksjs/types'

export async function invoke(options: ReleaseOptions) {
  const perf = intro('buddy release')
  const result = await runAction(NpmScript.Release, { ...options, debug: true })

  if (result.isOk()) {
    outro('Triggered CI/CD release workflow', { startTime: perf, useSeconds: true })
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
export async function release(options: ReleaseOptions) {
  return invoke(options)
}
