import consola from 'consola'
import { NpmScript } from '../../src/types'
import { runNpmScript } from './run-npm-script'

export async function generate() {
  consola.info('Generating key...')
  await runNpmScript(NpmScript.KeyGenerate)
  consola.success('Key generated')
}
