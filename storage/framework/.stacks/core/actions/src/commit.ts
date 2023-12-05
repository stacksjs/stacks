import { log } from 'stacks:logging'
import { runNpmScript } from 'stacks:utils'
import type { CleanOptions } from 'stacks:types'
import { NpmScript } from 'stacks:enums'

export async function invoke(options: CleanOptions) {
  log.info('Committing...')
  await runNpmScript(NpmScript.Commit, options)
  log.success('Committed')
}

export async function commit(options: CleanOptions) {
  return invoke(options)
}
