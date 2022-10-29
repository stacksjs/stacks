import { consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import type { LintOptions } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/types'

export async function invoke(options: LintOptions) {
  if (options?.fix)
    await lintFix(options)
  else
    await lint(options)
}

export async function lint(options: LintOptions) {
  consola.info('Linting...')
  await runNpmScript(NpmScript.Lint, options)
  consola.success('Linted.')
}

export async function lintFix(options: LintOptions) {
  consola.info('Fixing lint errors...')
  await runNpmScript(NpmScript.LintFix, options)
  consola.success('Fixed lint errors.')
}
