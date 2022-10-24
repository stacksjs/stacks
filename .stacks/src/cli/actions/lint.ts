import { console as consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { NpmScript } from '@stacksjs/types'

export async function lint(debug: 'ignore' | 'inherit' = 'inherit') {
  consola.info('Linting your codebase...')
  await runNpmScript(NpmScript.Lint, debug)
  consola.success('Successfully linted your codebase.')
}

export async function lintFix(debug: 'ignore' | 'inherit' = 'inherit') {
  if (debug !== 'ignore')
    consola.info('Fixing lint errors...')

  await runNpmScript(NpmScript.LintFix, debug)

  if (debug !== 'ignore')
    consola.success('Fixed lint errors.')
}
