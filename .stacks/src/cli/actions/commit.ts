import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { NpmScript } from '@stacksjs/types'

export async function invoke() {
  consola.info('Committing...')
  await runNpmScript(NpmScript.Commit)
  consola.success('Committed.')
}
