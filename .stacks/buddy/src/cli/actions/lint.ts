import { log } from '@stacksjs/x-ray'
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
    log.info('Linting...')
    await runNpmScript(NpmScript.Lint, options)
    log.success('Linted.')
  }
  catch (error) {
    log.error('There was an error linting your code.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function lintFix(options?: LintOptions) {
  try {
    log.info('Fixing lint errors...')
    await runNpmScript(NpmScript.LintFix, options)
    log.success('Fixed lint errors.')
  }
  catch (error) {
    log.error('There was an error lint fixing your code.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}
