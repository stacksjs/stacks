import consola from 'consola'
import { NpmScript } from '../types'
import { runNpmScript } from './run-npm-script'

export async function release() {
  consola.info('Releasing...')
  await runNpmScript(NpmScript.Release)
  consola.success('Successfully triggered the GitHub Release workflow.')
}
