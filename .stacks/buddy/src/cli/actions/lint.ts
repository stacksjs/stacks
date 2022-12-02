import { log } from '@stacksjs/x-ray'
import { intro, outro, runCommand } from '@stacksjs/cli'
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
  const perf = intro('buddy lint')
  const result = await runCommand(NpmScript.Lint, { ...options, debug: true })

  if (result.isErr()) {
    outro('While running `buddy lint`, there was an issue', { startTime: perf, useSeconds: true, isError: true })
    process.exit(ExitCode.FatalError)
  }

  outro('Linted', { startTime: perf, useSeconds: true })
}

export async function lintFix(options?: LintOptions) {
  log.info('Fixing lint errors...')
  const result = await runNpmScript(NpmScript.LintFix, options)

  if (result.isErr()) {
    log.error('There was an error lint fixing your code', result.error)
    process.exit()
  }

  log.success('Fixed lint errors')
}
