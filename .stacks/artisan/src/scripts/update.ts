import consola from 'consola'
import * as ezSpawn from '@jsdevtools/ez-spawn'
import { NpmScript, copyFiles } from '../../../src'
import { runNpmScript } from './run-npm-script'

export async function stacks() {
  await runNpmScript(NpmScript.Update)

  // make this a conditional?
  consola.success('Downloading framework updates...')
  await ezSpawn.async('giget stacks updates', { stdio: 'ignore' }) // TODO: stdio should inherit when APP_DEBUG or debug flag is true
  copyFiles('./updates/.stacks', '../../../../.stacks') // overwrite the core framework files
  consola.success('Updated the Stacks framework.')

  // TODO: how to gracefully handle potential overwrites?
  // Even though they should not happen due to usage of
  // configurations, when they do, how should they be handled?
}
