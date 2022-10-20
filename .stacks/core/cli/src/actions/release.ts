import consola from 'consola'
import { runNpmScript } from 'utils'
import { NpmScript } from 'types'

export async function release() {
  consola.info('Releasing...')
  await runNpmScript(NpmScript.Release)
  consola.success('Triggered release workflow')
}
