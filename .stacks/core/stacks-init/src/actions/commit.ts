import consola from 'consola'
import { runNpmScript } from 'utils'
import { NpmScript } from 'types'

export async function commit() {
  consola.info('Committing...')
  await runNpmScript(NpmScript.Commit)
  consola.success('Committed.')
}
