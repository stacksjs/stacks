import consola from 'consola'
import { runNpmScript } from 'utils'
import { NpmScript } from 'types'

export async function reinstallNpmDependencies() {
  consola.info('Reinstalling your npm dependencies...')
  await runNpmScript(NpmScript.Fresh)
  consola.success('Successfully reinstalled your npm dependencies.')
}
