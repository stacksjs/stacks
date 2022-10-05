import consola from 'consola'
import { NpmScript } from '../../../core/types/cli'
import { runNpmScript } from './run-npm-script'

export async function lint() {
  consola.info('Linting your codebase...')
  await runNpmScript(NpmScript.Lint)
  consola.success('Successfully linted your codebase.')
}

export async function lintFix() {
  consola.info('Fixing lint errors...')
  await runNpmScript(NpmScript.LintFix)
  consola.success('Fixed lint errors.')
}
