import consola from 'consola'
import { NpmScript } from '../../src/types'
import { runNpmScript } from './run-npm-script'

export async function updateNpmDependencies() {
  consola.info('Updating your npm dependencies...')
  await runNpmScript(NpmScript.Update)
  consola.success('Updated your npm dependencies.')
}
