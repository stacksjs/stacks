import consola from 'consola'
import { NpmScript } from '../types'
import { runNpmScript } from './run-npm-script'

export async function generateTypes() {
  await runNpmScript(NpmScript.GenerateTypes).then(() => {
    consola.success('Types were generated successfully.')
  }).catch((error) => {
    consola.error('There was an error generating your types')
    consola.error(error)
  })
}
