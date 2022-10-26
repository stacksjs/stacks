import { console as consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { NpmScript } from '@stacksjs/types'

export async function clean() {
  consola.info('Cleaning...')
  await runNpmScript(NpmScript.Clean)
  consola.success('Cleaned.')
}
