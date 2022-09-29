import consola from 'consola'
import { NpmScript } from '../../../src/types'
import { runNpmScript } from './run-npm-script'

export async function updateStack() {
  consola.info('Updating your Stack...')
  await runNpmScript(NpmScript.Update)
  consola.success('Updated your Stack.')
}
