import type { CLI, LintOptions } from '@stacksjs/types'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'

async function lint(buddy: CLI) {
  const descriptions = {
    lint: 'Automagically lints your project codebase',
    lintFix: 'Automagically fixes all lint errors',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('lint', descriptions.lint)
    .option('-f, --fix', descriptions.lintFix, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions) => {
      const startTime = await intro('buddy lint')
      const result = await runAction(Action.Lint, { ...options, showSpinner: true, spinnerText: 'Linting...' })
      // console.log('res', result)
      if (result.isErr()) {
        outro('While running `buddy lint`, there was an issue', { startTime, useSeconds: true, isError: true }, result.error as Error)
        process.exit()
      }

      outro('Linted your project', { startTime, useSeconds: true })
    })

  buddy
    .command('lint:fix', descriptions.lintFix)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions) => {
      log.info('Fixing lint errors...')
      const result = await runAction(Action.LintFix, { ...options, showSpinner: true, spinnerText: 'Linting...' })

      if (result.isErr()) {
        log.error('There was an error lint fixing your code.', result.error as Error)
        process.exit()
      }

      log.success('Fixed lint errors')
    })
}

export { lint }
