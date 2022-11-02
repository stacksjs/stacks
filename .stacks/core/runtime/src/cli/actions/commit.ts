import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import type { CleanOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

export async function invoke(options: CleanOptions) {
  consola.info('Committing...')
  await runNpmScript(NpmScript.Commit, options)
  consola.success('Committed.')
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function commit(options: CleanOptions) {
  return invoke(options)
}
