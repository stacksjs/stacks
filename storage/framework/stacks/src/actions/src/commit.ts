import { log } from 'src/logging/src'
import { runNpmScript } from 'src/utils/src'
import type { CleanOptions } from 'src/types/src'
import { NpmScript } from 'src/enums/src'

export async function invoke(options: CleanOptions) {
  log.info('Committing...')
  await runNpmScript(NpmScript.Commit, options)
  log.success('Committed')
}

export async function commit(options: CleanOptions) {
  return invoke(options)
}
