import consola from 'consola'
import { NpmScript } from '../types/cli'
import { runNpmScript } from './run-npm-script'

export async function typecheck() {
  consola.info('Typechecking your codebase...')

  try {
    await runNpmScript(NpmScript.TestTypes)
    consola.success('Finished typechecking your codebase.')
  }
  catch (error) {
    consola.error(error)
  }
}
