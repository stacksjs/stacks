import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { NpmScript } from '@stacksjs/types'

export async function invoke() {
  consola.info('Releasing...')
  await runNpmScript(NpmScript.Release)
  consola.success('Triggered release workflow')
}
