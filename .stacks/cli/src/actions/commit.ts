import consola from 'consola'
import { NpmScript } from '../../../types'
import { runNpmScript } from '../../../utils/run-npm-script'

export async function commit() {
  consola.info('Committing...')
  await runNpmScript(NpmScript.Commit)
  consola.success('Committed.')
}
