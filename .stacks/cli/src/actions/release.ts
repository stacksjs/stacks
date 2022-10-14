import consola from 'consola'
import { NpmScript } from '../../../types'
import { runNpmScript } from '../../../utils/run-npm-script'

export async function release() {
  consola.info('Releasing...')
  await runNpmScript(NpmScript.Release)
  consola.success('Triggered release workflow')
}
