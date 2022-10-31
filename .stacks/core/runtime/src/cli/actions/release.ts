import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import type { CliOptions as ReleaseOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

export async function invoke(options: ReleaseOptions) {
  consola.info('Releasing...')
  await runNpmScript(NpmScript.Release, options)
  consola.success('Triggered release workflow')
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function release(options: ReleaseOptions) {
  return invoke(options)
}
