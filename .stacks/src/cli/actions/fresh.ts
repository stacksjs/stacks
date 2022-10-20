import consola from 'consola'
import { runNpmScript } from '@stacksjs/helpers'
import { NpmScript } from '@stacksjs/types'

export async function reinstallNpmDependencies() {
  consola.info('Reinstalling your npm dependencies...')
  await runNpmScript(NpmScript.Fresh)
  consola.success('Successfully reinstalled your npm dependencies.')
}
