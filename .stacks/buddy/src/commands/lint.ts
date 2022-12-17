import type { CLI, LintOptions } from '@stacksjs/types'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'

async function lint(buddy: CLI) {
  const descriptions = {
    lint: 'Automagically lints your codebase',
    lintFix: 'Automagically fixes lint errors',
    debug: 'Enable debug mode',
  }

  buddy
    .command('lint', descriptions.lint)
    .option('-f, --fix', descriptions.lintFix, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: LintOptions) => {
      const perf = intro('buddy lint')
      const result = await runAction(Action.Lint, options)

      if (result.isErr()) {
        outro('While running `buddy lint`, there was an issue', { startTime: perf, useSeconds: true, isError: true })
        process.exit()
      }

      outro('Linted', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('lint:fix', descriptions.lintFix)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: LintOptions) => {
      log.info('Fixing lint errors...')
      const result = await runAction(Action.LintFix, options)

      if (result.isErr()) {
        log.error('There was an error lint fixing your code.', result.error)
        process.exit()
      }

      log.success('Fixed lint errors')
    })
}

export { lint }
