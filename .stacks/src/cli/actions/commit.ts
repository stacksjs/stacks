import consola from 'consola'
import { runNpmScript } from '@stacksjs/helpers'
import { NpmScript } from '@stacksjs/types'

export async function commit() {
  consola.info('Committing...')
  await runNpmScript(NpmScript.Commit)
  consola.success('Committed.')
}
