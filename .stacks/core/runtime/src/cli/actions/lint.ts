import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import type { LintOptions } from '@stacksjs/types'
import { ExitCode, NpmScript } from '@stacksjs/types'

export async function invoke(options: LintOptions) {
  if (options?.fix)
    await lintFix(options)
  else
    await lint(options)
}

export async function lint(options: LintOptions) {
  try {
    consola.info('Linting...')
    await runNpmScript(NpmScript.Lint, options)
    consola.success('Linted.')
  }
  catch (error) {
    consola.error('There was an error linting your code.')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function lintFix(options?: LintOptions) {
  try {
    consola.info('Fixing lint errors...')
    await runNpmScript(NpmScript.LintFix, options)
    consola.success('Fixed lint errors.')
  }
  catch (error) {
    consola.error('There was an error lint fixing your code.')
    consola.error(error)
    process.exit(ExitCode.FatalError)
  }
}
