import { log } from '@stacksjs/logging'
import { runNpmScript } from '@stacksjs/utils'
import type { CleanOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

export async function invoke(options: CleanOptions) {
  log.info('Committing...')
  await runNpmScript(NpmScript.Commit, options)
  log.success('Committed.')
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function commit(options: CleanOptions) {
  return invoke(options)
}
