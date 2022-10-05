import consola from 'consola'
import { NpmScript } from '../helpers'
import { runNpmScript } from './run-npm-script'

export async function release() {
  consola.info('Releasing...')
  await runNpmScript(NpmScript.Release)
  consola.success('Triggered Release workflow')
}
