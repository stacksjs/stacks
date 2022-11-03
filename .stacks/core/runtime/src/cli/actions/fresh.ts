import { runCommand, runShortLivedCommand } from '@stacksjs/cli'
import type { CliOptions as FreshOptions } from '@stacksjs/types'
import { intro, outro } from '../helpers'

export async function invoke(options?: FreshOptions) {
  const perf = await intro('stx fresh', true)
  await runShortLivedCommand('pnpm run clean', options)
  await runCommand('pnpm install', options)
  outro('Freshly reinstalled your dependencies.', { startTime: perf, useSeconds: true })
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function fresh(options: FreshOptions) {
  return invoke(options)
}
