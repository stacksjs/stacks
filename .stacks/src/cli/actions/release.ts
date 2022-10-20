import consola from 'consola'
import { runNpmScript } from '@stacksjs/helpers'
import { NpmScript } from '@stacksjs/types'

export async function release() {
  consola.info('Releasing...')
  await runNpmScript(NpmScript.Release)
  consola.success('Triggered release workflow')
}
